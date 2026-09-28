from odoo import _, api, fields, models
from odoo.exceptions import AccessError, UserError


APPROVAL_STATES = [
    ('no_required', 'Non requise'),
    ('to_request', 'A demander'),
    ('waiting', 'En attente'),
    ('approved', 'Approuvee'),
    ('refused', 'Refusee'),
]

# Champs dont la modification invalide une approbation existante
INVALIDATING_FIELDS = {
    'partner_id',
    'order_line',
}


class SaleOrder(models.Model):
    _inherit = 'sale.order'

    # ------------------------------------------------------------------
    # Champs d approbation
    # ------------------------------------------------------------------
    margin_approval_state = fields.Selection(
        selection=APPROVAL_STATES,
        string='Etat de l approbation',
        default='no_required',
        copy=False,
        tracking=True,
        index=True,
    )
    margin_approval_ids = fields.One2many(
        'sale.margin.approval',
        'order_id',
        string='Demandes d approbation',
        copy=False,
    )
    margin_approval_required = fields.Boolean(
        string='Approbation requise',
        compute='_compute_margin_approval_required',
        store=True,
    )
    active_approval_id = fields.Many2one(
        'sale.margin.approval',
        string='Approbation active',
        compute='_compute_active_approval_id',
        store=False,
    )

    # ------------------------------------------------------------------
    # Calculs
    # ------------------------------------------------------------------
    @api.depends('margin_percent', 'company_id.margin_approval_threshold')
    def _compute_margin_approval_required(self):
        for order in self:
            threshold = order.company_id.margin_approval_threshold
            order.margin_approval_required = bool(
                order.amount_untaxed and (order.margin_percent * 100) < threshold
            )

    @api.depends('margin_approval_ids', 'margin_approval_ids.state')
    def _compute_active_approval_id(self):
        for order in self:
            waiting = order.margin_approval_ids.filtered(
                lambda a: a.state in ('waiting', 'approved')
            )
            order.active_approval_id = waiting[:1] if waiting else False

    # ------------------------------------------------------------------
    # Invalidation automatique apres modification
    # ------------------------------------------------------------------
    def write(self, vals):
        # Si le devis est en attente ou approuve et qu un champ cle change,
        # on annule l approbation courante.
        orders_to_invalidate = self.env['sale.order']
        if set(vals.keys()) & INVALIDATING_FIELDS:
            orders_to_invalidate = self.filtered(
                lambda o: o.margin_approval_state in ('waiting', 'approved')
            )
        result = super().write(vals)
        if orders_to_invalidate:
            orders_to_invalidate._invalidate_approval('Modification des conditions commerciales')
        return result

    def _invalidate_approval(self, reason=''):
        """Annule les approbations actives et repasse l etat a to_request."""
        for order in self:
            active = order.margin_approval_ids.filtered(
                lambda a: a.state in ('waiting', 'approved')
            )
            active.sudo().write({'state': 'cancelled'})
            order.margin_approval_state = 'to_request'
            order.message_post(
                body=f"Approbation invalidee. Raison : {reason}. "
                     "Une nouvelle demande est necessaire."
            )

    # ------------------------------------------------------------------
    # Actions metier
    # ------------------------------------------------------------------
    def action_check_margin_and_update_state(self):
        """Recalcule et met a jour l etat d approbation apres une modification."""
        for order in self:
            if not order.margin_approval_required:
                if order.margin_approval_state in ('to_request', 'refused'):
                    order.margin_approval_state = 'no_required'
            else:
                if order.margin_approval_state == 'no_required':
                    order.margin_approval_state = 'to_request'

    def action_request_approval(self):
        """Ouvre le wizard de demande d approbation."""
        self.ensure_one()
        self._check_can_request_approval()
        return {
            'name': _('Demander une approbation'),
            'type': 'ir.actions.act_window',
            'res_model': 'sale.approval.request.wizard',
            'view_mode': 'form',
            'target': 'new',
            'context': {'default_order_id': self.id},
        }

    def _check_can_request_approval(self):
        self.ensure_one()
        if not self.order_line:
            raise UserError(_("Le devis est vide. Ajoutez des lignes avant de soumettre."))
        if self.amount_untaxed <= 0:
            raise UserError(_("Le montant HT doit etre positif pour calculer la marge."))
        if not self.margin_approval_required:
            raise UserError(_("La marge respecte le seuil. Aucune approbation n est requise."))
        if self.margin_approval_state == 'waiting':
            raise UserError(_("Une demande est deja en attente de validation."))

    def _do_request_approval(self, justification):
        """Cree l enregistrement d approbation et met a jour l etat."""
        self.ensure_one()
        self.env['sale.margin.approval'].sudo().create({
            'order_id': self.id,
            'state': 'waiting',
            'requested_by': self.env.uid,
            'requested_at': fields.Datetime.now(),
            'justification': justification,
            'threshold_at_request': self.company_id.margin_approval_threshold,
            'amount_untaxed_at_request': self.amount_untaxed,
            'margin_at_request': self.margin,
            'margin_rate_at_request': self.margin_percent,
            'order_version_at_request': self.write_date and 1 or 1,
        })
        self.margin_approval_state = 'waiting'

    def action_approve_margin(self):
        """Ouvre le wizard de decision (approbation)."""
        self.ensure_one()
        self._check_can_decide()
        return {
            'name': _('Approuver la derogation'),
            'type': 'ir.actions.act_window',
            'res_model': 'sale.approval.decision.wizard',
            'view_mode': 'form',
            'target': 'new',
            'context': {
                'default_order_id': self.id,
                'default_decision': 'approved',
            },
        }

    def action_refuse_margin(self):
        """Ouvre le wizard de decision (refus)."""
        self.ensure_one()
        self._check_can_decide()
        return {
            'name': _('Refuser la derogation'),
            'type': 'ir.actions.act_window',
            'res_model': 'sale.approval.decision.wizard',
            'view_mode': 'form',
            'target': 'new',
            'context': {
                'default_order_id': self.id,
                'default_decision': 'refused',
            },
        }

    def _check_can_decide(self):
        """Verifie que l utilisateur est approbateur et que le devis est en attente."""
        self.ensure_one()
        if not self.env.user.has_group('sale_margin_approval.group_approver'):
            raise AccessError(
                _("Seul un responsable commercial peut approuver ou refuser une derogation.")
            )
        if self.margin_approval_state != 'waiting':
            raise UserError(_("Ce devis n est pas en attente d approbation."))

    def _do_decide(self, decision, reason):
        """Enregistre la decision et met a jour l etat du devis et de l approbation."""
        self.ensure_one()
        waiting = self.margin_approval_ids.filtered(lambda a: a.state == 'waiting')
        if not waiting:
            raise UserError(_("Aucune demande en attente trouvee."))
        waiting[:1].write({
            'state': decision,
            'decided_by': self.env.uid,
            'decided_at': fields.Datetime.now(),
            'decision_reason': reason,
        })
        self.margin_approval_state = decision
        action_label = 'approuvee' if decision == 'approved' else 'refusee'
        self.message_post(
            body=f"Derogation {action_label} par {self.env.user.name}. Motif : {reason}"
        )

    # ------------------------------------------------------------------
    # Confirmation bloquee si necessaire
    # ------------------------------------------------------------------
    def action_confirm(self):
        for order in self:
            order._assert_margin_approval_ok()
        return super().action_confirm()

    def _assert_margin_approval_ok(self):
        """Leve une exception si la marge requiert une approbation non accordee."""
        self.ensure_one()
        if not self.margin_approval_required:
            return
        if self.margin_approval_state != 'approved':
            raise UserError(
                _(
                    "Ce devis ne peut pas etre confirme : le taux de marque (%(rate).1f %%) "
                    "est inferieur au seuil autorise (%(threshold).1f %%). "
                    "Veuillez demander une approbation.",
                    rate=self.margin_percent * 100,
                    threshold=self.company_id.margin_approval_threshold,
                )
            )
        # Verifier que les valeurs n ont pas change depuis l approbation
        active = self.margin_approval_ids.filtered(lambda a: a.state == 'approved')[:1]
        if active and abs(active.amount_untaxed_at_request - self.amount_untaxed) > 0.01:
            raise UserError(
                _(
                    "Les conditions du devis ont change depuis l approbation. "
                    "Une nouvelle approbation est necessaire."
                )
            )

    # ------------------------------------------------------------------
    # Duplication : reinitialiser l approbation
    # ------------------------------------------------------------------
    def copy(self, default=None):
        default = dict(default or {})
        default['margin_approval_state'] = 'no_required'
        return super().copy(default)
