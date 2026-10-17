"""Internal API automation. No desktop robot, customer mail or approval decision."""
import csv
import io
import logging
import traceback
from datetime import timedelta

from odoo import _, api, fields, models
from odoo.exceptions import AccessError, ValidationError

from ..rules import completed_windows, csv_cell, event_key, retry_at, waiting_kind
from .automation_event import create_once, snapshot

_logger = logging.getLogger(__name__)


class AutomationEngine(models.AbstractModel):
    _name = 'sale.margin.automation.engine'
    _description = 'Moteur de suivi interne des marges'

    def _preview(self, policy):
        policy._check_manager()
        domain = [('company_id', '=', policy.company_id.id)]
        approvals = self.env['sale.margin.approval']
        waiting = domain + [('state', '=', 'waiting'), ('requested_at', '>=', policy.activation_from)]
        return {
            'waiting': approvals.search_count(waiting),
            'overdue': approvals.search_count(waiting + [('requested_at', '<=', fields.Datetime.now()
                                                        - timedelta(hours=policy.reminder_hours))]),
            'to_request': self.env['sale.order'].search_count(domain + [
                ('state', 'in', ['draft', 'sent']), ('margin_approval_state', '=', 'to_request')]),
            'pending_jobs': self.env['sale.margin.automation.job'].search_count(domain + [('state', '=', 'pending')]),
            'failed_jobs': self.env['sale.margin.automation.job'].search_count(domain + [('state', '=', 'failed')]),
        }

    def _run_as_runner(self, policy, trigger_uid):
        policy._check_manager()
        engine = self.with_user(policy.runner_id).with_context(allowed_company_ids=[policy.company_id.id])
        policy = policy.with_env(engine.env)
        engine._discover(policy, trigger_uid)
        return engine._process(policy, trigger_uid)

    def _check_runner(self, policy):
        policy.check_access_rights('read')
        policy.check_access_rule('read')
        if self.env.su or self.env.uid != policy.runner_id.id or policy.company_id != self.env.company:
            raise AccessError(_('Contexte du compte technique invalide.'))
        policy._validate_configuration()
        if not policy.enabled:
            raise ValidationError(_('La politique est désactivée.'))

    @api.model
    def _cron_discover(self):
        self._cron('discover')

    @api.model
    def _cron_process(self):
        self._cron('process')

    def _cron(self, operation):
        policies = self.env['sale.margin.automation.policy'].search([
            ('enabled', '=', True), ('runner_id', '=', self.env.uid)])
        for policy in policies:
            engine = self.with_context(allowed_company_ids=[policy.company_id.id])
            started = fields.Datetime.now()
            try:
                with self.env.cr.savepoint():
                    getattr(engine, '_' + operation)(policy.with_env(engine.env), self.env.uid)
            except Exception as error:
                engine._trace(policy, 'discovery', 'error', started, self.env.uid,
                              error_code=type(error).__name__, detail=engine._safe_trace(error))

    def _trace(self, policy, kind, state, started, trigger_uid, **values):
        return self.env['sale.margin.automation.run'].sudo().create({
            'policy_id': policy.id, 'company_id': policy.company_id.id, 'kind': kind, 'state': state,
            'started_at': started, 'finished_at': fields.Datetime.now(), 'triggered_by': trigger_uid, **values,
        })

    def _safe_trace(self, error):
        # Frames identify the failure without persisting exception messages, secrets or customer data.
        frames = traceback.extract_tb(error.__traceback__)
        detail = '\n'.join(f'{frame.filename.rsplit("/", 1)[-1]}:{frame.lineno} {frame.name}' for frame in frames[-12:])
        _logger.error('Margin automation failure: %s; frames=%s', type(error).__name__, detail)
        return detail

    def _queue(self, policy, kind, approval=None, recipient=None, period=None):
        key = event_key(policy.id, kind, approval.id if approval else '',
                        approval.order_version_at_request if approval else '',
                        recipient.id if recipient else '', *(period or []),
                        policy.report_frequency if period else '', policy.timezone if period else '')
        values = {'event_key': key, 'policy_id': policy.id, 'company_id': policy.company_id.id,
                  'kind': kind, 'name': f'{kind} / {approval.order_id.name if approval else policy.company_id.name}',
                  'payload': snapshot(approval) if approval else {'timezone': policy.timezone},
                  'recipient_id': recipient.id if recipient else False}
        if approval:
            values.update(order_id=approval.order_id.id, approval_id=approval.id)
        if period:
            values.update(period_start=period[0], period_end=period[1])
        return create_once(self.env['sale.margin.automation.job'].sudo().with_context(
            mail_create_nosubscribe=True, mail_create_nolog=True), values)

    def _discover(self, policy, trigger_uid):
        self._check_runner(policy)
        started = fields.Datetime.now()
        # Serialize cursor advancement and policy edits. SQL is preceded by ACL/company checks.
        self.env.cr.execute('SELECT id FROM sale_margin_automation_policy WHERE id = %s FOR UPDATE', [policy.id])
        policy.invalidate_recordset()
        self._check_runner(policy)
        approvals = self.env['sale.margin.approval']
        base = [('company_id', '=', policy.company_id.id)]
        # A scan cursor is deliberately unnecessary: unique jobs make rescans safe.
        if policy.notifications_enabled:
            waiting = approvals.search(base + [('state', '=', 'waiting'), ('requested_at', '>=', policy.activation_from)])
            for approval in waiting:
                kind = waiting_kind(approval.requested_at, started, policy.reminder_hours)
                for recipient in policy.recipient_ids:
                    self._queue(policy, kind, approval, recipient)
        if policy.pdf_enabled:
            for approval in approvals.search(base + [('state', '=', 'approved'), ('decided_at', '>=', policy.activation_from)]):
                self._queue(policy, 'quote_pdf', approval, approval.order_id.user_id)
        if policy.reports_enabled:
            for start, end in completed_windows(policy.report_cursor or policy.activation_from, started,
                                                policy.timezone, policy.report_frequency):
                self._queue(policy, 'report_csv', period=(start, end))
                policy.sudo().write({'report_cursor': end})
        self._trace(policy, 'discovery', 'success', started, trigger_uid, detail='Détection terminée.')

    def _current(self, job):
        approval, order = job.approval_id, job.order_id
        if not approval or not order or order.company_id != job.company_id:
            return False
        expected = 'approved' if job.kind == 'quote_pdf' else 'waiting'
        return (approval.state == expected and order.margin_approval_state == expected
                and order.commercial_revision == job.payload.get('revision')
                and approval.commercial_fingerprint == job.payload.get('fingerprint')
                and order._commercial_fingerprint() == job.payload.get('fingerprint'))

    def _recipient(self, job, approver=False):
        user = job.recipient_id
        if (not user or not user.active or user.share or job.company_id not in user.company_ids
                or (approver and (user not in job.policy_id.recipient_ids
                                 or not user.has_group('sale_margin_approval.group_approver')))):
            raise ValidationError(_('Destinataire interne indisponible ou non autorisé.'))
        target = job.order_id.with_user(user).with_context(allowed_company_ids=[job.company_id.id])
        target.check_access_rights('read')
        target.check_access_rule('read')
        doc = job.with_user(user).with_context(allowed_company_ids=[job.company_id.id])
        doc.check_access_rights('read')
        doc.check_access_rule('read')
        return user

    def _activity(self, job, summary, approver=False):
        user = self._recipient(job, approver)
        self.env['mail.activity'].with_context(mail_activity_quick_update=True).create({
            'res_model_id': self.env['ir.model']._get_id(job._name), 'res_id': job.id,
            'activity_type_id': self.env.ref('mail.mail_activity_data_todo').id,
            'user_id': user.id, 'summary': summary, 'date_deadline': fields.Date.context_today(job),
            'note': 'Suivi interne. Consultez le devis et effectuez toute décision dans le workflow habituel.',
        })

    def _attach(self, job, name, content, mimetype):
        attachment = self.env['ir.attachment'].sudo().create({
            'name': name, 'raw': content, 'mimetype': mimetype, 'type': 'binary', 'public': False,
            'res_model': job._name, 'res_id': job.id, 'company_id': job.company_id.id,
        })
        job.sudo().write({'artifact_id': attachment.id})

    def _execute(self, job):
        policy = job.policy_id
        enabled = {'waiting': policy.notifications_enabled, 'overdue': policy.notifications_enabled,
                   'quote_pdf': policy.pdf_enabled, 'report_csv': policy.reports_enabled}
        if not enabled[job.kind]:
            return 'skipped', 'Traitement désactivé dans la politique.'
        if job.kind != 'report_csv':
            job.order_id.check_access_rights('read')
            job.order_id.check_access_rule('read')
            if job.order_id:
                self.env.cr.execute('SELECT id FROM sale_order WHERE id = %s FOR UPDATE', [job.order_id.id])
                job.order_id.invalidate_recordset()
                job.approval_id.invalidate_recordset()
            if not self._current(job):
                return 'skipped', 'Approbation ou version du devis devenue obsolète.'
            eligible_at = job.approval_id.decided_at if job.kind == 'quote_pdf' else job.approval_id.requested_at
            if eligible_at < policy.activation_from:
                return 'skipped', 'Demande exclue par la nouvelle date de reprise.'
        if job.kind in ('waiting', 'overdue'):
            if job.recipient_id not in policy.recipient_ids:
                return 'skipped', 'Destinataire retiré de la politique.'
            if job.kind == 'waiting' and waiting_kind(job.approval_id.requested_at, fields.Datetime.now(), policy.reminder_hours) == 'overdue':
                return 'skipped', 'La relance prolongée remplace cette notification initiale.'
            if job.kind == 'overdue' and waiting_kind(job.approval_id.requested_at, fields.Datetime.now(), policy.reminder_hours) != 'overdue':
                return 'skipped', 'Le nouveau délai configuré n’est pas encore atteint.'
            self._activity(job, 'Validation de marge en attente' if job.kind == 'waiting' else 'Validation de marge à relancer', True)
            return 'succeeded', 'Activité interne créée, aucun e-mail envoyé.'
        if job.kind == 'quote_pdf':
            self._recipient(job)
            data, output = self.env['ir.actions.report']._render_qweb_pdf('sale.action_report_saleorder', res_ids=job.order_id.ids)
            if output != 'pdf' or not data.startswith(b'%PDF-'):
                raise ValidationError(_('Le moteur de rapport n’a pas produit de PDF.'))
            self._attach(job, f'devis-{job.order_id.id}-v{job.payload["revision"]}.pdf', data, 'application/pdf')
            self._activity(job, 'Devis approuvé : document prêt pour suivi')
            return 'succeeded', 'PDF privé préparé. Envoi client laissé au commercial.'
        self._attach(job, f'marges-{job.period_start.date()}-{job.period_end.date()}.csv', self._csv(job), 'text/csv')
        return 'succeeded', 'Rapport CSV privé généré.'

    def _csv(self, job):
        generated = fields.Datetime.now()
        output = io.StringIO(newline='')
        writer = csv.writer(output, delimiter=';')
        writer.writerow(['population', 'etat', 'devis', 'client', 'commercial', 'demande_utc', 'decision_utc',
                         'evenement_utc', 'montant_ht', 'marge', 'taux_marque_pct', 'seuil_pct', 'devise',
                         'revision', 'debut_periode_utc', 'fin_periode_exclue_utc', 'generation_utc'])

        def row(population, state, data, occurred=''):
            writer.writerow([csv_cell(value) for value in [population, state, data.get('order_name'),
                data.get('partner_name'), data.get('salesman'), data.get('requested_at'), data.get('decided_at'),
                occurred, data.get('amount'), data.get('margin'), data.get('rate'), data.get('threshold'),
                data.get('currency'), data.get('revision'), str(job.period_start), str(job.period_end), str(generated)]])

        for approval in self.env['sale.margin.approval'].search([('company_id', '=', job.company_id.id), ('state', '=', 'waiting')]):
            row('pending_at_generation', 'waiting', snapshot(approval))
        for event in self.env['sale.margin.automation.event'].search([
                ('company_id', '=', job.company_id.id), ('event_type', 'in', ['approved', 'refused', 'cancelled']),
                ('occurred_at', '>=', job.period_start), ('occurred_at', '<', job.period_end)]):
            row('decision_event_in_period', event.event_type, event.payload, str(event.occurred_at))
        return ('\ufeff' + output.getvalue()).encode('utf-8')

    def _claim(self, job):
        job.check_access_rights('read')
        job.check_access_rule('read')
        if job.company_id != self.env.company:
            raise AccessError(_('Société non autorisée.'))
        self.env.cr.execute('SELECT id FROM sale_margin_automation_job WHERE id = %s FOR UPDATE SKIP LOCKED', [job.id])
        if not self.env.cr.fetchone():
            return False
        job.invalidate_recordset()
        return (job.state in ('pending', 'failed') and job.attempts < job.policy_id.max_attempts
                and job.next_attempt_at <= fields.Datetime.now())

    def _process(self, policy, trigger_uid):
        self._check_runner(policy)
        self.env.cr.execute('SELECT id FROM sale_margin_automation_policy WHERE id = %s FOR SHARE', [policy.id])
        policy.invalidate_recordset()
        self._check_runner(policy)
        jobs = self.env['sale.margin.automation.job'].search([
            ('policy_id', '=', policy.id), ('state', 'in', ['pending', 'failed']),
            ('attempts', '<', policy.max_attempts), ('next_attempt_at', '<=', fields.Datetime.now())],
            limit=policy.batch_size, order='id')
        results = {'processed': 0, 'succeeded': 0, 'failed': 0, 'skipped': 0}
        for job in jobs:
            if not self._claim(job):
                continue
            started, attempt = fields.Datetime.now(), job.attempts + 1
            code = False
            try:
                with self.env.cr.savepoint():
                    state, detail = self._execute(job)
                    job.sudo().write({'state': state, 'attempts': attempt, 'finished_at': fields.Datetime.now(),
                                       'result': detail, 'error_code': False})
            except Exception as error:
                state, code = 'failed', type(error).__name__
                detail = self._safe_trace(error)
                job.sudo().write({'state': state, 'attempts': attempt, 'error_code': code,
                                   'result': 'Échec du traitement. Consultez les traces et la configuration.',
                                   'next_attempt_at': retry_at(started, attempt, policy.retry_delay_minutes)})
            self._trace(policy, 'attempt', 'error' if state == 'failed' else 'skipped' if state == 'skipped' else 'success',
                        started, trigger_uid, job_id=job.id, attempt=attempt, error_code=code, detail=detail)
            results['processed'] += 1
            results[state] += 1
        return results
