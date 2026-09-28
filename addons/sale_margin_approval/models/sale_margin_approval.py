from odoo import api, fields, models


class SaleMarginApproval(models.Model):
    """Historique des demandes et decisions d approbation de marge."""

    _name = 'sale.margin.approval'
    _description = 'Approbation de marge commerciale'
    _order = 'requested_at desc'
    _rec_name = 'order_id'

    order_id = fields.Many2one(
        'sale.order',
        string='Devis',
        required=True,
        ondelete='cascade',
        index=True,
    )
    state = fields.Selection(
        selection=[
            ('waiting', 'En attente'),
            ('approved', 'Approuvee'),
            ('refused', 'Refusee'),
            ('cancelled', 'Annulee'),
        ],
        string='Etat',
        required=True,
        default='waiting',
        copy=False,
    )

    # --- Demande ---
    requested_by = fields.Many2one('res.users', string='Demande par', required=True, copy=False)
    requested_at = fields.Datetime(string='Date de demande', required=True, copy=False)
    justification = fields.Text(string='Justification du commercial', required=True)

    # --- Decision ---
    decided_by = fields.Many2one('res.users', string='Decide par', copy=False)
    decided_at = fields.Datetime(string='Date de decision', copy=False)
    decision_reason = fields.Text(string='Motif de la decision')

    # --- Valeurs au moment de la demande (snapshot) ---
    threshold_at_request = fields.Float(string='Seuil au moment de la demande (%)', copy=False)
    amount_untaxed_at_request = fields.Monetary(
        string='Montant HT a la demande',
        currency_field='currency_id',
        copy=False,
    )
    margin_at_request = fields.Monetary(
        string='Marge a la demande',
        currency_field='currency_id',
        copy=False,
    )
    margin_rate_at_request = fields.Float(string='Taux de marque a la demande (%)', copy=False)
    order_version_at_request = fields.Integer(string='Version du devis', copy=False)

    currency_id = fields.Many2one(
        related='order_id.currency_id',
        string='Devise',
        store=True,
    )

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        for record in records:
            record.order_id.message_post(
                body=f"Demande d approbation soumise par {record.requested_by.name}. "
                     f"Taux de marque : {record.margin_rate_at_request * 100:.1f}% "
                     f"(seuil : {record.threshold_at_request:.1f}%). "
                     f"Justification : {record.justification}",
            )
        return records
