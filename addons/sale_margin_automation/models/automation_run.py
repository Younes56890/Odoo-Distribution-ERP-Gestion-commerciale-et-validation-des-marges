from odoo import _, api, fields, models
from odoo.exceptions import AccessError


class AutomationRun(models.Model):
    _name = 'sale.margin.automation.run'
    _description = 'Journal des exécutions automatiques'
    _order = 'id desc'

    policy_id = fields.Many2one('sale.margin.automation.policy', required=True, ondelete='restrict')
    company_id = fields.Many2one('res.company', required=True, index=True, ondelete='restrict')
    job_id = fields.Many2one('sale.margin.automation.job', ondelete='restrict')
    kind = fields.Selection([('discovery', 'Détection'), ('attempt', 'Tentative'),
                             ('manual_retry', 'Reprise demandée')], required=True)
    state = fields.Selection([('success', 'Réussi'), ('error', 'Échec'), ('skipped', 'Obsolète')], required=True)
    triggered_by = fields.Many2one('res.users', ondelete='set null')
    started_at = fields.Datetime(required=True, default=fields.Datetime.now)
    finished_at = fields.Datetime(required=True, default=fields.Datetime.now)
    attempt = fields.Integer()
    error_code = fields.Char()
    detail = fields.Text()

    @api.model_create_multi
    def create(self, vals_list):
        if not self.env.su:
            raise AccessError(_('Le journal est alimenté par le moteur interne.'))
        return super().create(vals_list)

    def write(self, vals):
        raise AccessError(_('Les traces d’exécution sont immuables.'))

    def unlink(self):
        raise AccessError(_('Les traces d’exécution sont conservées.'))
