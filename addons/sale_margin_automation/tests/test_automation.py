from datetime import timedelta
from unittest.mock import patch

from odoo import fields
from odoo.exceptions import AccessError, ValidationError
from odoo.tests.common import TransactionCase, new_test_user, tagged


@tagged('post_install', '-at_install')
class TestAutomation(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.company = cls.env.company
        cls.company.email = 'internal@example.test'
        cls.company.margin_approval_threshold = 15
        cls.manager = new_test_user(cls.env, login='automation_manager', groups='sale_margin_approval.group_approver')
        cls.sales = new_test_user(cls.env, login='automation_sales', groups='sales_team.group_sale_salesman')
        cls.runner = cls.env.ref('sale_margin_automation.user_automation')
        cls.partner = cls.env['res.partner'].create({'name': '=UNTRUSTED()', 'email': 'customer@example.test'})
        cls.product = cls.env['product.product'].create({'name': 'Automation product', 'list_price': 100, 'standard_price': 90})

    def setUp(self):
        super().setUp()
        self.policy = self.env['sale.margin.automation.policy'].with_user(self.manager).create({
            'recipient_ids': [(6, 0, self.manager.ids)], 'activation_from': fields.Datetime.now() - timedelta(days=2),
            'enabled': True, 'pdf_enabled': False, 'reports_enabled': False,
        })
        self.engine = self.env['sale.margin.automation.engine'].with_user(self.runner).with_context(allowed_company_ids=self.company.ids)
        self.runner_policy = self.policy.with_env(self.engine.env)

    def quote(self, request=True, age=0):
        order = self.env['sale.order'].with_user(self.sales).create({
            'partner_id': self.partner.id, 'user_id': self.sales.id,
            'order_line': [(0, 0, {'product_id': self.product.id, 'product_uom_qty': 1,
                                  'price_unit': 100, 'purchase_price': 90})],
        })
        if request:
            order._do_request_approval('Décision humaine nécessaire')
            if age:
                order.margin_approval_ids.sudo().write({'requested_at': fields.Datetime.now() - timedelta(hours=age)})
        return order

    def jobs(self):
        return self.env['sale.margin.automation.job'].search([('policy_id', '=', self.policy.id)])

    def test_defaults_and_no_robot_business_write(self):
        self.assertFalse(self.env.ref('sale_margin_automation.cron_discover').active)
        self.assertFalse(self.env.ref('sale_margin_automation.cron_process').active)
        self.assertFalse(self.runner.has_group('sale_margin_approval.group_approver'))
        self.assertFalse(self.runner.has_group('base.group_system'))
        self.assertFalse(self.env['sale.order'].with_user(self.runner).check_access_rights('write', raise_exception=False))
        order = self.quote()
        with self.assertRaises(AccessError):
            order.with_user(self.runner)._do_decide('approved', 'Robot interdit')
        with self.assertRaises(AccessError):
            self.policy.with_user(self.sales)._run_batch()

    def test_initial_activity_idempotent_and_no_customer_email(self):
        order = self.quote()
        before = self.env['mail.mail'].search_count([])
        first = self.policy._run_batch()
        self.assertEqual(first['succeeded'], 1)
        self.assertEqual(self.policy._run_batch()['processed'], 0)
        jobs = self.jobs()
        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs.kind, 'waiting')
        self.assertEqual(len(jobs.activity_ids), 1)
        self.assertEqual(jobs.activity_ids.user_id, self.manager)
        self.assertEqual(self.env['mail.mail'].search_count([]), before)
        self.assertEqual(order.margin_approval_state, 'waiting')
        self.assertEqual(order.state, 'draft')
        self.assertNotIn(self.partner, jobs.message_partner_ids)

    def test_native_cron_runs_as_readonly_technical_user(self):
        order = self.quote()
        self.env.ref('sale_margin_automation.cron_discover').method_direct_trigger()
        self.assertEqual(self.jobs().state, 'pending')
        self.env.ref('sale_margin_automation.cron_process').method_direct_trigger()
        self.assertEqual(self.jobs().state, 'succeeded')
        self.assertEqual(order.margin_approval_state, 'waiting')
        trace = self.env['sale.margin.automation.run'].search([('job_id', '=', self.jobs().id)], limit=1)
        self.assertEqual(trace.triggered_by, self.runner)

    def test_old_waiting_only_one_overdue_and_no_auto_submission(self):
        self.quote(age=25)
        unsubmitted = self.quote(request=False)
        self.policy._run_batch()
        self.assertEqual(self.jobs().mapped('kind'), ['overdue'])
        self.assertEqual(unsubmitted.margin_approval_state, 'to_request')
        self.assertEqual(self.policy.action_preview()['to_request'], 1)

    def test_transition_events_survive_invalidation(self):
        order = self.quote()
        order.with_user(self.manager)._do_decide('approved', 'Accord humain')
        order.order_line.with_user(self.sales).write({'discount': 1})
        events = self.env['sale.margin.automation.event'].search([('order_id', '=', order.id)], order='id')
        self.assertEqual(events.mapped('event_type'), ['waiting', 'approved', 'cancelled'])
        self.assertAlmostEqual(events[1].payload['rate'], 10)
        self.assertEqual(events[1].payload['decided_by'], self.manager.name)
        with self.assertRaises(AccessError):
            events[0].write({'payload': {}})

    def test_obsolete_pending_job_is_skipped(self):
        order = self.quote()
        self.engine._discover(self.runner_policy, self.manager.id)
        order.with_user(self.manager)._do_decide('refused', 'Refus humain')
        self.assertEqual(self.engine._process(self.runner_policy, self.manager.id)['skipped'], 1)
        self.assertFalse(self.jobs().activity_ids)

    def test_retry_rollback_and_bounded_attempts(self):
        self.quote()
        original = type(self.engine)._execute

        def fail_after_activity(engine, job):
            original(engine, job)
            raise RuntimeError('SECRET_MUST_NOT_BE_LOGGED')

        with patch.object(type(self.engine), '_execute', fail_after_activity):
            result = self.policy._run_batch()
        job = self.jobs()
        self.assertEqual(result['failed'], 1)
        self.assertFalse(job.activity_ids)
        self.assertEqual(job.attempts, 1)
        self.assertGreater(job.next_attempt_at, fields.Datetime.now())
        self.assertEqual(self.policy._run_batch()['processed'], 0)
        run = self.env['sale.margin.automation.run'].search([('job_id', '=', job.id)], limit=1)
        self.assertNotIn('SECRET', run.detail)
        job.with_user(self.manager).action_retry()
        self.assertEqual(self.policy._run_batch()['succeeded'], 1)
        self.assertEqual(len(job.activity_ids), 1)
        with self.assertRaises(ValidationError):
            job.with_user(self.manager).action_retry()

    def test_csv_snapshot_and_formula_escaping(self):
        order = self.quote()
        order.with_user(self.manager)._do_decide('refused', 'Motif humain')
        pending = self.quote()
        job = self.engine._queue(self.runner_policy, 'report_csv', period=(
            fields.Datetime.now() - timedelta(days=1), fields.Datetime.now() + timedelta(seconds=1)))
        data = self.engine._csv(job).decode('utf-8-sig')
        self.assertIn('decision_event_in_period;refused;', data)
        self.assertIn('pending_at_generation;waiting;', data)
        self.assertIn("'=UNTRUSTED()", data)
        self.assertIn(pending.name, data)
        self.assertIn(';10.0;15.0;', data)

    def test_multicompany_isolation(self):
        other = self.env['res.company'].create({'name': 'Other automation company'})
        event = self.env['sale.margin.automation.event'].sudo().create({
            'event_key': 'other-company-event', 'company_id': other.id,
            'event_type': 'waiting', 'payload': {'private': True}})
        visible = self.env['sale.margin.automation.event'].with_user(self.runner).search([('id', '=', event.id)])
        self.assertFalse(visible)
        with self.assertRaises(AccessError):
            event.with_user(self.manager).check_access_rule('read')

    def test_retry_limit_stops_automatic_attempts(self):
        self.quote()
        with patch.object(type(self.engine), '_execute', side_effect=RuntimeError('masked')):
            for attempt in range(1, self.policy.max_attempts + 1):
                self.policy._run_batch()
                self.assertEqual(self.jobs().attempts, attempt)
                self.jobs().sudo().write({'next_attempt_at': fields.Datetime.now() - timedelta(minutes=1)})
            self.assertEqual(self.policy._run_batch()['processed'], 0)
        self.assertEqual(len(self.env['sale.margin.automation.run'].search([
            ('job_id', '=', self.jobs().id), ('kind', '=', 'attempt')])), self.policy.max_attempts)

    def test_report_cursor_and_private_artifact_are_idempotent(self):
        self.policy.write({'notifications_enabled': False, 'reports_enabled': True, 'report_frequency': 'daily'})
        self.policy._run_batch()
        jobs = self.jobs()
        self.assertTrue(jobs)
        self.assertTrue(all(job.state == 'succeeded' and job.artifact_id and not job.artifact_id.public for job in jobs))
        self.assertLessEqual(max(jobs.mapped('period_end')), fields.Datetime.now())
        cursor = self.policy.report_cursor
        self.assertEqual(self.policy._run_batch()['processed'], 0)
        self.assertEqual(self.jobs(), jobs)
        self.assertEqual(self.policy.report_cursor, cursor)

    def test_unsafe_runner_and_external_recipient_rejected(self):
        with self.assertRaises(ValidationError), self.env.cr.savepoint():
            self.policy.sudo().write({'runner_id': self.manager.id})
        portal = new_test_user(self.env, login='automation_portal', groups='base.group_portal')
        with self.assertRaises(ValidationError), self.env.cr.savepoint():
            self.policy.write({'recipient_ids': [(6, 0, portal.ids)]})

    def test_pdf_real_render_and_stale_download_rejected(self):
        self.policy.write({'pdf_enabled': True, 'notifications_enabled': False})
        order = self.quote()
        order.with_user(self.manager)._do_decide('approved', 'Accord humain')
        result = self.policy.with_context(force_report_rendering=True)._run_batch()
        job = self.jobs()
        self.assertEqual(result['succeeded'], 1, job.result)
        self.assertTrue(job.artifact_id.raw.startswith(b'%PDF-'))
        self.assertFalse(job.artifact_id.public)
        self.assertFalse(job.artifact_id.access_token)
        job.with_user(self.manager)._check_artifact()
        order.order_line.with_user(self.sales).write({'discount': 2})
        with self.assertRaises(ValidationError):
            job.with_user(self.manager)._check_artifact()
        with self.assertRaises(ValidationError):
            job.artifact_id.with_user(self.manager).read(['datas'])
        with self.assertRaises(ValidationError):
            self.env['ir.binary'].with_user(self.manager)._find_record(
                res_model='ir.attachment', res_id=job.artifact_id.id)
