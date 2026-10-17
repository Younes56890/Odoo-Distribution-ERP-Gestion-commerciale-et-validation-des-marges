from odoo import _, api, fields, models
from odoo.exceptions import ValidationError


class ResCompany(models.Model):
    _inherit = 'res.company'

    margin_approval_threshold = fields.Float(
        string='Seuil de marge (%)',
        default=15.0,
        help='Taux de marque minimum (en %) en dessous duquel une approbation est requise.',
    )

    @api.constrains('margin_approval_threshold')
    def _check_margin_threshold(self):
        for company in self:
            if not 0 <= company.margin_approval_threshold < 100:
                raise ValidationError(_('Le seuil doit être compris entre 0 et 100 % exclu.'))
