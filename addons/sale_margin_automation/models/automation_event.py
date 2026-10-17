from psycopg2 import IntegrityError
from psycopg2.errors import SerializationFailure

from odoo import _, api, fields, models
from odoo.exceptions import AccessError

from ..rules import event_key


def snapshot(approval):
    return {
        'order_name': approval.order_id.name, 'partner_name': approval.order_id.partner_id.name,
        'salesman': approval.requested_by.name, 'requested_by': approval.requested_by.id,
        'requested_at': fields.Datetime.to_string(approval.requested_at),
        'decided_at': fields.Datetime.to_string(approval.decided_at) if approval.decided_at else False,
        'decided_by': approval.decided_by.name or '',
        'revision': approval.order_version_at_request, 'fingerprint': approval.commercial_fingerprint or '',
        'amount': approval.amount_untaxed_at_request, 'margin': approval.margin_at_request,
        'rate': approval.margin_rate_at_request * 100, 'threshold': approval.threshold_at_request,
        'currency': approval.currency_id.name,
    }


def create_once(model, values):
    """The unique constraint, not a search/create race, owns idempotence."""
    existing = model.search([('event_key', '=', values['event_key'])], limit=1)
    if existing:
        return existing
    try:
        with model.env.cr.savepoint():
            return model.create(values)
    except IntegrityError as error:
        if error.diag.constraint_name != f'{model._table}_event_key_uniq':
            raise
        existing = model.search([('event_key', '=', values['event_key'])], limit=1)
        if not existing:
            # A concurrent winner may be newer than this REPEATABLE READ snapshot.
            raise SerializationFailure('Concurrent automation event; retry the transaction.') from error
        return existing


class AutomationEvent(models.Model):
    _name = 'sale.margin.automation.event'
    _description = 'Événement de dérogation de marge'
    _order = 'occurred_at desc, id desc'
    _rec_name = 'event_type'

    event_key = fields.Char(required=True, index=True, copy=False)
    company_id = fields.Many2one('res.company', required=True, index=True, ondelete='restrict')
    order_id = fields.Many2one('sale.order', ondelete='set null')
    approval_id = fields.Many2one('sale.margin.approval', ondelete='set null', index=True)
    event_type = fields.Selection([(s, s) for s in ('waiting', 'approved', 'refused', 'cancelled')], required=True, index=True)
    previous_state = fields.Char()
    occurred_at = fields.Datetime(required=True, default=fields.Datetime.now, index=True)
    actor_id = fields.Many2one('res.users', ondelete='set null')
    payload = fields.Json(required=True)

    _sql_constraints = [('event_key_uniq', 'unique(event_key)', 'Cet événement a déjà été enregistré.')]

    def _capture(self, approval, previous_state=False):
        # Called only from the already-authorized approval workflow, in the same transaction.
        return create_once(self.sudo(), {
            'event_key': event_key(approval.company_id.id, approval.id, approval.order_version_at_request, approval.state),
            'company_id': approval.company_id.id, 'order_id': approval.order_id.id,
            'approval_id': approval.id, 'event_type': approval.state, 'previous_state': previous_state,
            'actor_id': approval.decided_by.id if approval.state in ('approved', 'refused') else self.env.uid,
            'payload': snapshot(approval),
        })

    @api.model_create_multi
    def create(self, vals_list):
        if not self.env.su:
            raise AccessError(_('Les événements sont enregistrés uniquement par le workflow.'))
        return super().create(vals_list)

    def write(self, vals):
        raise AccessError(_('Les événements sont immuables.'))

    def unlink(self):
        raise AccessError(_('Les événements sont conservés pour l’audit.'))
