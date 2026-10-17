from odoo import api, models


class SaleMarginApproval(models.Model):
    _inherit = 'sale.margin.approval'

    @api.model_create_multi
    def create(self, vals_list):
        approvals = super().create(vals_list)
        for approval in approvals:
            self.env['sale.margin.automation.event']._capture(approval)
        return approvals

    def write(self, vals):
        before = {approval.id: approval.state for approval in self} if 'state' in vals else {}
        result = super().write(vals)
        for approval in self:
            if approval.id in before and before[approval.id] != approval.state:
                self.env['sale.margin.automation.event']._capture(approval, before[approval.id])
        return result
