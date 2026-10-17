"""Real concurrent transactions. Run inside the isolated Odoo test container only."""
import os
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4


def main():
    import odoo
    from odoo import api
    from psycopg2.errors import SerializationFailure

    database = 'optika_automation_test'
    odoo.tools.config.parse_config(['-d', database, '--db_host', os.environ['HOST'],
        '--db_user', os.environ['USER'], '--db_password', os.environ['PASSWORD'],
        '--addons-path=/usr/lib/python3/dist-packages/odoo/addons,/mnt/extra-addons'])
    registry = odoo.registry(database)
    from odoo.addons.sale_margin_automation.models.automation_event import create_once
    prefix = 'concurrency-check-' + uuid4().hex
    with registry.cursor() as cr:
        env = api.Environment(cr, odoo.SUPERUSER_ID, {})
        runner = env.ref('sale_margin_automation.user_automation')
        runner_id, company_id = runner.id, env.company.id
        if env['sale.margin.automation.policy'].search_count([('company_id', '=', company_id)]):
            raise RuntimeError('Expected an empty isolated test database, not a configured application.')
        policy = env['sale.margin.automation.policy'].create({})
        values = {'name': 'Concurrency fixture', 'policy_id': policy.id, 'company_id': company_id,
                  'kind': 'report_csv', 'payload': {'test': True}, 'event_key': prefix}
        job = env['sale.margin.automation.job'].with_context(mail_create_nolog=True, mail_create_nosubscribe=True).create(values)
        policy_id, job_id = policy.id, job.id
        cr.commit()

    context = {'allowed_company_ids': [company_id]}
    try:
        with registry.cursor() as first, registry.cursor() as second:
            env1 = api.Environment(first, runner_id, context)
            env2 = api.Environment(second, runner_id, context)
            assert env1['sale.margin.automation.engine']._claim(env1['sale.margin.automation.job'].browse(job_id))
            assert not env2['sale.margin.automation.engine']._claim(env2['sale.margin.automation.job'].browse(job_id))
            first.rollback()
            assert env2['sale.margin.automation.engine']._claim(env2['sale.margin.automation.job'].browse(job_id))
        gate = Barrier(2)

        def race():
            gate.wait(timeout=15)
            for _ in range(3):
                try:
                    with registry.cursor() as cr:
                        env = api.Environment(cr, runner_id, context)
                        result = create_once(env['sale.margin.automation.job'].sudo().with_context(
                            mail_create_nolog=True, mail_create_nosubscribe=True),
                            {**values, 'event_key': prefix + '-race'})
                        identifier = result.id
                        cr.commit()
                        return identifier
                except SerializationFailure:
                    continue
            raise AssertionError('Concurrent insert did not converge.')

        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = [executor.submit(race) for _ in range(2)]
            identifiers = [future.result(timeout=30) for future in futures]
        assert identifiers[0] == identifiers[1] and identifiers[0]
        with registry.cursor() as cr:
            env = api.Environment(cr, odoo.SUPERUSER_ID, {})
            assert env['sale.margin.automation.job'].search_count([('event_key', '=', prefix + '-race')]) == 1
        print('Concurrency OK: SKIP LOCKED excludes a second worker; concurrent inserts converge to one job.')
    finally:
        with registry.cursor() as cr:
            # Only this script's two fixture rows; no ORM deletion of immutable production logs.
            cr.execute('DELETE FROM sale_margin_automation_job WHERE policy_id = %s AND event_key LIKE %s',
                       [policy_id, prefix + '%'])
            cr.execute('DELETE FROM sale_margin_automation_policy WHERE id = %s', [policy_id])
            cr.commit()


if __name__ == '__main__':
    main()
