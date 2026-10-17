from odoo import _, api, fields, models
from odoo.exceptions import AccessError, ValidationError


class AutomationJob(models.Model):
    _name = 'sale.margin.automation.job'
    _description = 'Traitement interne de suivi des marges'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'id desc'

    name = fields.Char(required=True)
    event_key = fields.Char(required=True, index=True, copy=False)
    policy_id = fields.Many2one('sale.margin.automation.policy', required=True, ondelete='restrict')
    company_id = fields.Many2one('res.company', required=True, index=True, ondelete='restrict')
    kind = fields.Selection([('waiting', 'Nouvelle attente'), ('overdue', 'Attente prolongée'),
                             ('quote_pdf', 'PDF commercial'), ('report_csv', 'Rapport CSV')], required=True)
    order_id = fields.Many2one('sale.order', ondelete='set null')
    approval_id = fields.Many2one('sale.margin.approval', ondelete='set null')
    recipient_id = fields.Many2one('res.users', ondelete='set null')
    payload = fields.Json(required=True)
    period_start = fields.Datetime()
    period_end = fields.Datetime()
    artifact_id = fields.Many2one('ir.attachment', ondelete='set null', readonly=True)
    state = fields.Selection([('pending', 'À traiter'), ('succeeded', 'Réussi'), ('failed', 'Échec'),
                              ('skipped', 'Obsolète')], default='pending', required=True, index=True)
    attempts = fields.Integer(default=0)
    next_attempt_at = fields.Datetime(default=fields.Datetime.now, index=True)
    finished_at = fields.Datetime()
    result = fields.Text()
    error_code = fields.Char()

    _sql_constraints = [('event_key_uniq', 'unique(event_key)', 'Ce traitement existe déjà.')]

    @api.model_create_multi
    def create(self, vals_list):
        if not self.env.su:
            raise AccessError(_('Les traitements sont créés par le moteur interne.'))
        return super().create(vals_list)

    def write(self, vals):
        if not self.env.su:
            raise AccessError(_('Utilisez les actions de supervision.'))
        return super().write(vals)

    def unlink(self):
        raise AccessError(_('Le journal des traitements est conservé.'))

    def action_retry(self):
        self.ensure_one()
        self.check_access_rights('read')
        self.check_access_rule('read')
        self.policy_id._check_manager()
        self.env.cr.execute('SELECT id FROM sale_margin_automation_job WHERE id = %s FOR UPDATE', [self.id])
        self.invalidate_recordset()
        if self.state != 'failed' or not self.policy_id.enabled:
            raise ValidationError(_('Seul un échec avec une politique active peut être relancé.'))
        self.env['sale.margin.automation.run'].sudo().create({
            'company_id': self.company_id.id, 'policy_id': self.policy_id.id,
            'job_id': self.id, 'kind': 'manual_retry', 'state': 'success',
            'triggered_by': self.env.uid, 'finished_at': fields.Datetime.now(),
            'detail': 'Reprise explicitement demandée par un approbateur.',
        })
        self.sudo().write({'state': 'pending', 'attempts': 0, 'error_code': False,
                           'next_attempt_at': fields.Datetime.now(), 'finished_at': False})
        return True

    def _check_artifact(self):
        self.ensure_one()
        self.check_access_rights('read')
        self.check_access_rule('read')
        if self.company_id not in self.env.companies or not self.artifact_id or self.state != 'succeeded':
            raise AccessError(_('Document indisponible.'))
        if self.kind == 'quote_pdf':
            self.order_id.check_access_rights('read')
            self.order_id.check_access_rule('read')
            if self.order_id:
                self.env.cr.execute('SELECT id FROM sale_order WHERE id = %s FOR SHARE', [self.order_id.id])
                self.order_id.invalidate_recordset()
                self.approval_id.invalidate_recordset()
            if not self.env['sale.margin.automation.engine']._current(self):
                raise ValidationError(_('Ce PDF correspond à une approbation devenue obsolète.'))
        return self.artifact_id
