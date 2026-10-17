from odoo import fields, http
from odoo.http import request
from odoo.addons.optika_rest_api.controllers.api_controller import ApiError, body, endpoint, page, record


def policy_record():
    return request.env['sale.margin.automation.policy'].search([('company_id', '=', request.env.company.id)], limit=1)


def policy_payload(policy):
    names = ['enabled', 'notifications_enabled', 'pdf_enabled', 'reports_enabled', 'reminder_hours',
             'report_frequency', 'timezone', 'batch_size', 'max_attempts', 'retry_delay_minutes', 'activation_from']
    if not policy:
        return None
    return {'id': policy.id, **{name: policy[name] for name in names},
            'recipient_ids': policy.recipient_ids.ids, 'report_cursor': policy.report_cursor}


def job_payload(job):
    return {'id': job.id, 'name': job.name, 'kind': job.kind, 'state': job.state,
            'order_name': job.payload.get('order_name'), 'recipient': job.recipient_id.name,
            'attempts': job.attempts, 'next_attempt_at': job.next_attempt_at, 'created_at': job.create_date,
            'finished_at': job.finished_at, 'error_code': job.error_code, 'result': job.result,
            'has_document': bool(job.artifact_id)}


class AutomationController(http.Controller):
    @http.route('/api/automation', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    @endpoint('approve')
    def overview(self, **kwargs):
        policy = policy_record()
        group = request.env.ref('sale_margin_approval.group_approver')
        users = request.env['res.users'].search([('active', '=', True), ('share', '=', False),
            ('company_ids', 'in', [request.env.company.id]), ('groups_id', 'in', [group.id])])
        crons = [request.env.ref('sale_margin_automation.' + name).sudo().active
                 for name in ('cron_discover', 'cron_process')]
        return {'available': True, 'policy': policy_payload(policy),
                'recipients': [{'id': user.id, 'name': user.name} for user in users],
                'scheduled': all(crons), 'preview': policy.action_preview() if policy else None}

    @http.route('/api/automation/policy', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    @endpoint('approve')
    def configure(self, **kwargs):
        data = body()
        allowed = {'enabled', 'notifications_enabled', 'pdf_enabled', 'reports_enabled', 'reminder_hours',
                   'report_frequency', 'timezone', 'batch_size', 'max_attempts', 'retry_delay_minutes',
                   'recipient_ids', 'activation_from'}
        if set(data) - allowed:
            raise ApiError('Champ de configuration non autorisé.')
        for name in ('enabled', 'notifications_enabled', 'pdf_enabled', 'reports_enabled'):
            if name in data and not isinstance(data[name], bool):
                raise ApiError('Une valeur booléenne est nécessaire.')
        for name in ('batch_size', 'max_attempts', 'retry_delay_minutes'):
            if name in data and (type(data[name]) is not int):
                raise ApiError('Une valeur entière est nécessaire.')
        if 'activation_from' in data:
            data['activation_from'] = fields.Datetime.to_datetime(data['activation_from'])
        if 'recipient_ids' in data:
            ids = data['recipient_ids']
            if not isinstance(ids, list) or any(type(identifier) is not int for identifier in ids):
                raise ApiError('Liste de destinataires invalide.')
            data['recipient_ids'] = [(6, 0, ids)]
        policy = policy_record()
        if policy:
            policy.write(data)
        else:
            policy = request.env['sale.margin.automation.policy'].create(data)
        return policy_payload(policy)

    @http.route('/api/automation/run', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    @endpoint('approve')
    def execute(self, **kwargs):
        policy = policy_record()
        if not policy:
            raise ApiError('Configurez une politique avant l’exécution.')
        return policy._run_batch()

    @http.route('/api/automation/jobs', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    @endpoint('approve')
    def jobs(self, **kwargs):
        return page('sale.margin.automation.job', [('company_id', '=', request.env.company.id)], job_payload)

    @http.route('/api/automation/runs', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    @endpoint('approve')
    def runs(self, **kwargs):
        return page('sale.margin.automation.run', [('company_id', '=', request.env.company.id)], lambda run: {
            'id': run.id, 'kind': run.kind, 'state': run.state, 'job_id': run.job_id.id,
            'started_at': run.started_at, 'attempt': run.attempt, 'error_code': run.error_code,
            'detail': run.detail, 'triggered_by': run.triggered_by.name})

    @http.route('/api/automation/jobs/<int:identifier>/retry', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    @endpoint('approve')
    def retry(self, identifier, **kwargs):
        record('sale.margin.automation.job', identifier).action_retry()
        return {'ok': True}

    @http.route('/api/automation/jobs/<int:identifier>/document', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    @endpoint('approve')
    def document(self, identifier, **kwargs):
        attachment = record('sale.margin.automation.job', identifier)._check_artifact()
        # Same authenticated JSON/CSRF/CORS mechanism as the existing API; no public URL/token.
        return {'name': attachment.name, 'mimetype': attachment.mimetype, 'data': attachment.datas.decode('ascii')}
