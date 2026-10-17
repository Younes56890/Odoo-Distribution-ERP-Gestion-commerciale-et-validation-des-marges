from odoo import fields, models


class ApprovalRequestWizard(models.TransientModel):
    _name = 'sale.approval.request.wizard'
    _description = 'Demande de dérogation de marge'

    order_id = fields.Many2one('sale.order', required=True, readonly=True)
    justification = fields.Text(required=True)

    def action_submit(self):
        self.ensure_one()
        self.order_id._do_request_approval(self.justification)
        return {'type': 'ir.actions.act_window_close'}


class ApprovalDecisionWizard(models.TransientModel):
    _name = 'sale.approval.decision.wizard'
    _description = 'Décision de dérogation de marge'

    order_id = fields.Many2one('sale.order', required=True, readonly=True)
    decision = fields.Selection([('approved', 'Approuver'), ('refused', 'Refuser')], required=True)
    reason = fields.Text(required=True)

    def action_submit(self):
        self.ensure_one()
        self.order_id._do_decide(self.decision, self.reason)
        return {'type': 'ir.actions.act_window_close'}
