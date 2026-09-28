from odoo import fields, models


class ResCompany(models.Model):
    _inherit = 'res.company'

    margin_approval_threshold = fields.Float(
        string='Seuil de marge (%)',
        default=15.0,
        help='Taux de marque minimum (en %) en dessous duquel une approbation est requise.',
    )
