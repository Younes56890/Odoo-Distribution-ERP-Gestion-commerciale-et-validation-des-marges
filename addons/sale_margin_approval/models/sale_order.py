import hashlib
import json

from odoo import _, api, fields, models
from odoo.exceptions import AccessError, UserError

INVALIDATING_FIELDS = {
    'partner_id', 'order_line', 'pricelist_id', 'currency_id', 'company_id',
    'payment_term_id', 'fiscal_position_id',
}
PROTECTED_FIELDS = {'margin_approval_state', 'commercial_revision', 'margin_approval_ids'}


class SaleOrder(models.Model):
    _inherit = 'sale.order'

    margin_approval_state = fields.Selection([
        ('no_required', 'Non requise'), ('to_request', 'À demander'),
        ('waiting', 'En attente'), ('approved', 'Approuvée'), ('refused', 'Refusée'),
    ], default='no_required', copy=False, tracking=True, index=True, readonly=True)
    commercial_revision = fields.Integer(default=1, copy=False, readonly=True)
    margin_approval_ids = fields.One2many('sale.margin.approval', 'order_id', copy=False)
    margin_approval_required = fields.Boolean(compute='_compute_margin_approval_required', store=True)
    active_approval_id = fields.Many2one('sale.margin.approval', compute='_compute_active_approval_id')

    @api.depends('margin_percent', 'amount_untaxed', 'company_id.margin_approval_threshold')
    def _compute_margin_approval_required(self):
        for order in self:
            order.margin_approval_required = bool(
                order.amount_untaxed > 0
                and order.margin_percent * 100 + 1e-7 < order.company_id.margin_approval_threshold
            )

    @api.depends('margin_approval_ids.state')
    def _compute_active_approval_id(self):
        for order in self:
            order.active_approval_id = order.margin_approval_ids.filtered(
                lambda approval: approval.state in ('waiting', 'approved'))[:1]

    @api.model_create_multi
    def create(self, vals_list):
        if not self.env.su and any(PROTECTED_FIELDS.intersection(vals) for vals in vals_list):
            raise AccessError(_('Les champs d’approbation sont gérés par le circuit métier.'))
        orders = super().create(vals_list)
        orders.action_check_margin_and_update_state()
        return orders

    def write(self, vals):
        if not self.env.su and PROTECTED_FIELDS.intersection(vals):
            raise AccessError(_('Les champs d’approbation sont gérés par le circuit métier.'))
        result = super().write(vals)
        if INVALIDATING_FIELDS.intersection(vals):
            self._invalidate_approval(_('Modification des conditions commerciales'))
        return result

    def _set_approval_state(self, state):
        # Private methods cannot be invoked through Odoo RPC. No context flag bypasses this guard.
        return super(SaleOrder, self).write({'margin_approval_state': state})

    def _lock_for_approval(self):
        self.ensure_one()
        self.check_access_rights('write')
        self.check_access_rule('write')
        self.env.cr.execute('SELECT id FROM sale_order WHERE id = %s FOR UPDATE', (self.id,))
        self.invalidate_recordset()

    def _commercial_fingerprint(self):
        self.ensure_one()
        payload = {
            'partner': self.partner_id.id, 'company': self.company_id.id,
            'currency': self.currency_id.id, 'pricelist': self.pricelist_id.id,
            'payment_term': self.payment_term_id.id, 'fiscal_position': self.fiscal_position_id.id,
            'threshold': self.company_id.margin_approval_threshold,
            'amount': self.amount_untaxed, 'margin': self.margin,
            'lines': [(line.id, line.product_id.id, line.product_uom.id,
                       line.product_uom_qty, line.price_unit, line.discount,
                       line.purchase_price, sorted(line.tax_id.ids))
                      for line in self.order_line.sorted('id') if not line.display_type],
        }
        return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()

    def _invalidate_approval(self, reason=''):
        for order in self:
            active = order.margin_approval_ids.filtered(lambda a: a.state in ('waiting', 'approved'))
            # Narrow elevation: cancellations follow an already authorized commercial edit.
            if active:
                active.sudo().write({'state': 'cancelled', 'decision_reason': reason})
                order.message_post(body=_('Approbation invalidée : %s', reason))
            super(SaleOrder, order).write({'commercial_revision': order.commercial_revision + 1})
            if active or order.margin_approval_state != 'refused':
                order._set_approval_state('to_request' if order.margin_approval_required else 'no_required')

    def action_check_margin_and_update_state(self):
        for order in self:
            if order.margin_approval_state in ('no_required', 'to_request', 'refused'):
                order._set_approval_state('to_request' if order.margin_approval_required else 'no_required')

    def _check_can_request_approval(self):
        self.ensure_one()
        self.check_access_rights('write')
        self.check_access_rule('write')
        if self.state not in ('draft', 'sent'):
            raise UserError(_('Seul un devis peut faire l’objet d’une demande.'))
        if not self.order_line or self.amount_untaxed <= 0:
            raise UserError(_('Ajoutez des lignes avec un montant HT positif.'))
        if not self.margin_approval_required:
            raise UserError(_('La marge respecte le seuil ; aucune dérogation n’est nécessaire.'))
        if self.margin_approval_state in ('waiting', 'approved'):
            raise UserError(_('Une demande active existe déjà.'))

    def action_request_approval(self):
        self._check_can_request_approval()
        return {'name': _('Demander une approbation'), 'type': 'ir.actions.act_window',
                'res_model': 'sale.approval.request.wizard', 'view_mode': 'form', 'target': 'new',
                'context': {'default_order_id': self.id}}

    def _do_request_approval(self, justification):
        self._lock_for_approval()
        self._check_can_request_approval()
        if not justification or not justification.strip():
            raise UserError(_('Expliquez la raison de cette dérogation.'))
        self.env['sale.margin.approval'].sudo().create({
            'order_id': self.id, 'state': 'waiting', 'requested_by': self.env.uid,
            'requested_at': fields.Datetime.now(), 'justification': justification.strip(),
            'threshold_at_request': self.company_id.margin_approval_threshold,
            'amount_untaxed_at_request': self.amount_untaxed, 'margin_at_request': self.margin,
            'margin_rate_at_request': self.margin_percent,
            'order_version_at_request': self.commercial_revision,
            'commercial_fingerprint': self._commercial_fingerprint(),
        })
        self._set_approval_state('waiting')

    def _check_can_decide(self):
        self.ensure_one()
        self.check_access_rights('write')
        self.check_access_rule('write')
        if not self.env.user.has_group('sale_margin_approval.group_approver'):
            raise AccessError(_('Seul un approbateur peut décider une dérogation.'))
        if self.state not in ('draft', 'sent') or self.margin_approval_state != 'waiting':
            raise UserError(_('Ce devis n’est pas en attente d’approbation.'))

    def _decision_wizard(self, decision):
        self._check_can_decide()
        return {'name': _('Décision de marge'), 'type': 'ir.actions.act_window',
                'res_model': 'sale.approval.decision.wizard', 'view_mode': 'form', 'target': 'new',
                'context': {'default_order_id': self.id, 'default_decision': decision}}

    def action_approve_margin(self):
        return self._decision_wizard('approved')

    def action_refuse_margin(self):
        return self._decision_wizard('refused')

    def _do_decide(self, decision, reason):
        self._lock_for_approval()
        self._check_can_decide()
        if decision not in ('approved', 'refused') or not reason or not reason.strip():
            raise UserError(_('Choisissez une décision et renseignez son motif.'))
        waiting = self.margin_approval_ids.filtered(lambda a: a.state == 'waiting')[:1]
        if not waiting or waiting.commercial_fingerprint != self._commercial_fingerprint():
            raise UserError(_('Les conditions ont changé. Une nouvelle demande est nécessaire.'))
        waiting.sudo().write({'state': decision, 'decided_by': self.env.uid,
                              'decided_at': fields.Datetime.now(), 'decision_reason': reason.strip()})
        self._set_approval_state(decision)
        self.message_post(body=_('Décision : %(decision)s. Motif : %(reason)s',
                                decision=decision, reason=reason.strip()))

    def action_confirm(self):
        for order in self:
            order._lock_for_approval()
            order._assert_margin_approval_ok()
        return super().action_confirm()

    def _assert_margin_approval_ok(self):
        self.ensure_one()
        if not self.margin_approval_required:
            return
        active = self.margin_approval_ids.filtered(lambda a: a.state == 'approved')[:1]
        if self.margin_approval_state != 'approved' or not active:
            raise UserError(_('La marge est inférieure au seuil. Demandez une approbation.'))
        if active.commercial_fingerprint != self._commercial_fingerprint():
            raise UserError(_('Les conditions du devis ont changé depuis l’accord. Demandez une nouvelle approbation.'))

    def copy(self, default=None):
        return super().copy(default=default)
