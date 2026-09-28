from odoo import api, models

# Champs dont la modification sur une ligne invalide l approbation du devis
INVALIDATING_LINE_FIELDS = {
    'product_id',
    'product_uom_qty',
    'product_uom',
    'price_unit',
    'discount',
    'purchase_price',
}


class SaleOrderLine(models.Model):
    _inherit = 'sale.order.line'

    def write(self, vals):
        # Detecter si un champ critique change sur une ligne liee a un devis approuve/en attente
        orders_to_invalidate = self.env['sale.order']
        if set(vals.keys()) & INVALIDATING_LINE_FIELDS:
            orders_to_invalidate = self.mapped('order_id').filtered(
                lambda o: o.margin_approval_state in ('waiting', 'approved')
            )
        result = super().write(vals)
        if orders_to_invalidate:
            orders_to_invalidate._invalidate_approval(
                'Modification d une ligne commerciale (produit, quantite, prix, remise ou cout)'
            )
        return result
