from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    margin_approval_threshold = fields.Float(
        related='company_id.margin_approval_threshold',
        readonly=False,
        string='Seuil de marge (%)',
    )
