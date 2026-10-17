from odoo import api, models

INVALIDATING_LINE_FIELDS = {
    'product_id', 'product_uom_qty', 'product_uom', 'price_unit', 'discount',
    'purchase_price', 'tax_id', 'order_id', 'display_type',
}


class SaleOrderLine(models.Model):
    _inherit = 'sale.order.line'

    @api.model_create_multi
    def create(self, vals_list):
        lines = super().create(vals_list)
        lines.mapped('order_id')._invalidate_approval('Ajout d’une ligne')
        return lines

    def write(self, vals):
        orders = self.mapped('order_id')
        result = super().write(vals)
        if INVALIDATING_LINE_FIELDS.intersection(vals):
            (orders | self.mapped('order_id'))._invalidate_approval('Modification d’une ligne commerciale')
        return result

    def unlink(self):
        orders = self.mapped('order_id')
        result = super().unlink()
        orders._invalidate_approval('Suppression d’une ligne')
        return result
