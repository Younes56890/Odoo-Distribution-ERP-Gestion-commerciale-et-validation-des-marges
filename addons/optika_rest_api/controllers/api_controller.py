"""Session API. Every business operation executes with the actual user's Odoo rights."""
import json
import logging
import math
import os
from functools import wraps

from odoo import fields, http
from odoo.exceptions import AccessDenied, AccessError, MissingError, UserError, ValidationError
from odoo.http import request

_logger = logging.getLogger(__name__)
GROUPS = {
    'sales': 'sales_team.group_sale_salesman',
    'approve': 'sale_margin_approval.group_approver',
    'stock': 'stock.group_stock_user',
    'purchase': 'purchase.group_purchase_user',
    'finance': 'account.group_account_user',
    'admin': 'optika_rest_api.group_operations_manager',
}


class ApiError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def allowed_origin():
    origin = request.httprequest.headers.get('Origin')
    same_origin = request.httprequest.host_url.rstrip('/')
    origins = {same_origin, *filter(None, os.getenv('OPTIKA_ALLOWED_ORIGINS', '').split(','))}
    return not origin or origin in origins


def response(data, status=200):
    headers = [('Content-Type', 'application/json; charset=utf-8'),
               ('Cache-Control', 'no-store'), ('X-Content-Type-Options', 'nosniff'), ('Vary', 'Origin')]
    origin = request.httprequest.headers.get('Origin')
    if origin and allowed_origin():
        headers += [('Access-Control-Allow-Origin', origin), ('Access-Control-Allow-Credentials', 'true'),
                    ('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'),
                    ('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token')]
    return request.make_response(json.dumps(data, ensure_ascii=False, default=str), headers, status=status)


def can(capability):
    return request.env.user.has_group(GROUPS[capability])


def endpoint(capability=None, anonymous=False, transactional=True):
    """JSON errors and savepoint rollback prevent partial commits on business failures."""
    def decorate(method):
        @wraps(method)
        def guarded(self, *args, **kwargs):
            try:
                if not allowed_origin():
                    raise ApiError('Origine non autorisée.', 403)
                if request.httprequest.method == 'OPTIONS':
                    return response({})
                if not anonymous:
                    if not request.session.uid:
                        raise ApiError('Votre session a expiré. Reconnectez-vous.', 401)
                    request.update_env(user=request.session.uid, su=False)
                    if not request.env.user.has_group('base.group_user'):
                        raise ApiError('Un compte interne est nécessaire.', 403)
                    if capability and not can(capability):
                        raise ApiError('Votre rôle ne permet pas cette opération.', 403)
                if request.httprequest.method == 'POST':
                    if request.httprequest.mimetype != 'application/json':
                        raise ApiError('Un corps JSON est nécessaire.', 415)
                    if not anonymous and not request.validate_csrf(
                            request.httprequest.headers.get('X-CSRF-Token')):
                        raise ApiError('Jeton de session invalide. Actualisez la page.', 403)
                # Odoo Session.authenticate commits its cursor; it cannot run inside a savepoint.
                if not transactional:
                    return response(method(self, *args, **kwargs))
                with request.env.cr.savepoint():
                    return response(method(self, *args, **kwargs))
            except ApiError as error:
                return response({'error': str(error)}, error.status)
            except AccessDenied:
                return response({'error': 'Identifiants incorrects.'}, 401)
            except AccessError:
                return response({'error': 'Accès refusé par les droits Odoo.'}, 403)
            except MissingError:
                return response({'error': 'Cet élément n’existe plus.'}, 404)
            except (UserError, ValidationError) as error:
                return response({'error': str(error)}, 422)
            except (ValueError, TypeError, KeyError):
                return response({'error': 'Les données envoyées sont invalides.'}, 400)
            except Exception:
                _logger.exception('Optika API failure at %s', request.httprequest.path)
                return response({'error': 'Une erreur serveur est survenue. Consultez le journal Odoo.'}, 500)
        return guarded
    return decorate


def body():
    if request.httprequest.content_length and request.httprequest.content_length > 1_000_000:
        raise ApiError('Requête trop volumineuse.', 413)
    data = json.loads(request.httprequest.data or b'{}')
    if not isinstance(data, dict):
        raise ApiError('Un objet JSON est nécessaire.')
    return data


def number(value, label, minimum=0, maximum=None, positive=False):
    value = float(value)
    if not math.isfinite(value) or value < minimum or (positive and value <= 0):
        raise ApiError(f'{label} : valeur non autorisée.')
    if maximum is not None and value > maximum:
        raise ApiError(f'{label} dépasse la limite autorisée.')
    return value


def record(model, identifier, operation='read'):
    item = request.env[model].browse(int(identifier)).exists()
    if not item:
        raise ApiError('Élément introuvable.', 404)
    item.check_access_rights(operation)
    item.check_access_rule(operation)
    if 'company_id' in item._fields and item.company_id and item.company_id != request.env.company:
        raise ApiError('Cet élément appartient à une autre société.', 403)
    return item


def page(model, domain, serializer, order='id desc'):
    query = request.httprequest.args
    limit = min(max(int(query.get('limit', 20)), 1), 200)
    offset = max(int(query.get('offset', 0)), 0)
    records = request.env[model]
    return {'items': [serializer(item) for item in records.search(domain, order=order, limit=limit, offset=offset)],
            'total': records.search_count(domain), 'limit': limit, 'offset': offset}


def company_domain():
    return [('company_id', '=', request.env.company.id)]


def user_payload():
    user = request.env.user
    capabilities = [name for name in GROUPS if can(name)]
    role = ('manager' if 'approve' in capabilities else 'accountant' if 'finance' in capabilities
            else 'logistics' if 'stock' in capabilities else 'commercial')
    return {'uid': user.id, 'name': user.name, 'role': role, 'capabilities': capabilities,
            'company': request.env.company.name, 'currency': request.env.company.currency_id.name,
            'threshold': request.env.company.margin_approval_threshold,
            'csrf_token': request.csrf_token()}


def order_payload(order, details=False):
    data = {'id': order.id, 'name': order.name, 'partner_id': order.partner_id.id,
            'partner_name': order.partner_id.name, 'salesman': order.user_id.name,
            'state': order.state, 'margin_approval_state': order.margin_approval_state,
            'amount_total': order.amount_total, 'amount_untaxed': order.amount_untaxed,
            'currency': order.currency_id.name, 'date_order': order.date_order,
            'revision': order.commercial_revision, 'invoice_status': order.invoice_status}
    if can('sales'):
        data.update(margin=order.margin, margin_percent=order.margin_percent * 100)
    if details:
        data['lines'] = [{'id': line.id, 'product_id': line.product_id.id, 'name': line.name,
                          'qty': line.product_uom_qty, 'price': line.price_unit, 'discount': line.discount,
                          'cost': line.purchase_price}
                         for line in order.order_line if not line.display_type]
        data['history'] = [{'id': a.id, 'state': a.state, 'requested_at': a.requested_at,
                            'requested_by': a.requested_by.name, 'justification': a.justification,
                            'decided_at': a.decided_at, 'decided_by': a.decided_by.name,
                            'reason': a.decision_reason, 'revision': a.order_version_at_request}
                           for a in order.margin_approval_ids]
    return data


class ApiController(http.Controller):
    @http.route('/api/auth/login', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    @endpoint(anonymous=True, transactional=False)
    def login(self, **kwargs):
        data = body()
        uid = request.session.authenticate(request.db, data.get('login'), data.get('password'))
        if not request.session.uid:
            raise ApiError('Ce compte nécessite une connexion multifacteur via Odoo.', 401)
        request.update_env(user=uid, su=False)
        if not request.env.user.has_group('base.group_user'):
            request.session.logout(keep_db=True)
            raise ApiError('Un compte interne est nécessaire.', 403)
        payload = user_payload()
        # Authentication rotates the session cookie after this response. Fetch a fresh CSRF token next.
        payload.pop('csrf_token', None)
        return payload

    @http.route('/api/auth/session', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    @endpoint()
    def session(self, **kwargs):
        return user_payload()

    @http.route('/api/auth/logout', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    @endpoint()
    def logout(self, **kwargs):
        request.session.logout(keep_db=True)
        return {'status': 'ok'}

    @http.route('/api/customers', type='http', auth='public', methods=['GET', 'POST', 'OPTIONS'], csrf=False)
    @endpoint()
    def customers(self, **kwargs):
        if not any(can(c) for c in ('sales', 'purchase', 'finance', 'stock')):
            raise ApiError('Accès refusé.', 403)
        if request.httprequest.method == 'POST':
            if not can('sales'):
                raise ApiError('Accès refusé.', 403)
            data = body()
            name = str(data.get('name', '')).strip()
            if not name:
                raise ApiError('Le nom du client est nécessaire.')
            partner = request.env['res.partner'].create({
                'name': name, 'email': data.get('email', ''), 'phone': data.get('phone', ''),
                'customer_rank': 1, 'company_id': request.env.company.id,
            })
            return {'id': partner.id, 'name': partner.name}
        domain = [('company_id', 'in', [False, request.env.company.id])]
        query = request.httprequest.args.get('q', '').strip()
        if query:
            domain += [('name', 'ilike', query)]
        return page('res.partner', domain, lambda p: {
            'id': p.id, 'name': p.name, 'email': p.email or '', 'phone': p.phone or '',
            'city': p.city or '', 'supplier': p.supplier_rank > 0,
        }, order='name')

    @http.route('/api/products', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    @endpoint()
    def products(self, **kwargs):
        if not any(can(c) for c in ('sales', 'purchase', 'stock')):
            raise ApiError('Accès refusé.', 403)
        domain = [('sale_ok', '=', True), ('company_id', 'in', [False, request.env.company.id])]
        query = request.httprequest.args.get('q', '').strip()
        if query:
            domain += ['|', '|', ('name', 'ilike', query), ('default_code', 'ilike', query), ('barcode', '=', query)]
        def serialize(product):
            result = {'id': product.id, 'name': product.name, 'reference': product.default_code or '',
                      'barcode': product.barcode or '', 'category': product.categ_id.name,
                      'price': product.list_price, 'qty_available': product.qty_available,
                      'currency': product.currency_id.name}
            if can('sales') or can('purchase'):
                result['cost'] = product.standard_price
            return result
        return page('product.product', domain, serialize, order='name')

    @http.route('/api/orders', type='http', auth='public', methods=['GET', 'POST', 'OPTIONS'], csrf=False)
    @endpoint()
    def orders(self, **kwargs):
        if not (can('sales') or can('finance')):
            raise ApiError('Accès refusé.', 403)
        if request.httprequest.method == 'GET':
            domain = company_domain()
            if can('sales') and not request.env.user.has_group('sales_team.group_sale_manager'):
                domain += [('user_id', '=', request.env.uid)]
            query = request.httprequest.args.get('q', '')
            if query:
                domain += ['|', ('name', 'ilike', query), ('partner_id.name', 'ilike', query)]
            return page('sale.order', domain, order_payload)
        if not can('sales'):
            raise ApiError('Accès refusé.', 403)
        data = body()
        action = data.get('action', 'draft')
        if action not in ('draft', 'submit'):
            raise ApiError('Action non autorisée.')
        partner = record('res.partner', data['partner_id'])
        lines = self._order_lines(data.get('lines', []))
        order = request.env['sale.order'].create({
            'partner_id': partner.id, 'user_id': request.env.uid,
            'company_id': request.env.company.id, 'order_line': lines,
        })
        if order.currency_id != request.env.company.currency_id:
            raise ApiError('Ce client utilise une liste de prix dans une autre devise. Établissez ce devis dans Odoo.')
        if action == 'submit':
            self._submit_order(order, data.get('justification', ''))
        return order_payload(order, details=True)

    def _order_lines(self, lines):
        if not isinstance(lines, list) or not 0 < len(lines) <= 100:
            raise ApiError('Ajoutez entre 1 et 100 lignes au devis.')
        result = []
        for line in lines:
            product = record('product.product', line['product_id'])
            if not product.sale_ok:
                raise ApiError('Ce produit ne peut pas être vendu.')
            result.append((0, 0, {'product_id': product.id,
                                  'product_uom_qty': number(line['qty'], 'Quantité', positive=True),
                                  'price_unit': number(line['price'], 'Prix', positive=True),
                                  'discount': number(line.get('discount', 0), 'Remise', maximum=100)}))
        return result

    def _submit_order(self, order, justification):
        if order.state not in ('draft', 'sent'):
            raise ApiError('Seul un devis peut être soumis.')
        if order.margin_approval_required and order.margin_approval_state != 'approved':
            order._do_request_approval(justification)
        else:
            order.action_confirm()

    @http.route('/api/orders/<int:order_id>', type='http', auth='public', methods=['GET', 'POST', 'OPTIONS'], csrf=False)
    @endpoint('sales')
    def order_detail(self, order_id, **kwargs):
        order = record('sale.order', order_id, 'write' if request.httprequest.method == 'POST' else 'read')
        if request.httprequest.method == 'POST':
            if order.state not in ('draft', 'sent'):
                raise ApiError('Une commande confirmée ne peut pas être modifiée ici.')
            if order.currency_id != request.env.company.currency_id:
                raise ApiError('Modifiez ce devis en devise étrangère directement dans Odoo.')
            data = body()
            vals = {'order_line': [(5, 0, 0)] + self._order_lines(data['lines'])}
            if data.get('partner_id'):
                vals['partner_id'] = record('res.partner', data['partner_id']).id
            order.write(vals)
        return order_payload(order, details=True)

    @http.route('/api/orders/<int:order_id>/submit', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    @endpoint('sales')
    def submit_order(self, order_id, **kwargs):
        order = record('sale.order', order_id, 'write')
        self._submit_order(order, body().get('justification', ''))
        return order_payload(order, details=True)

    @http.route('/api/approvals', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    @endpoint('approve')
    def approvals(self, **kwargs):
        domain = company_domain()
        query = request.httprequest.args.get('q', '').strip()
        if query:
            domain += ['|', ('order_id.name', 'ilike', query), ('order_id.partner_id.name', 'ilike', query)]
        state = request.httprequest.args.get('state', 'waiting')
        if state != 'all':
            domain += [('state', '=', state)]
        return page('sale.margin.approval', domain, lambda a: {
            'id': a.id, 'order_id': a.order_id.id, 'order_name': a.order_id.name,
            'partner_name': a.order_id.partner_id.name, 'salesman': a.requested_by.name,
            'margin_rate': a.margin_rate_at_request * 100, 'margin': a.margin_at_request,
            'threshold': a.threshold_at_request, 'amount': a.amount_untaxed_at_request,
            'currency': a.currency_id.name, 'justification': a.justification, 'state': a.state,
            'requested_at': a.requested_at, 'revision': a.order_version_at_request,
            'reason': a.decision_reason, 'decided_by': a.decided_by.name,
            'decided_at': a.decided_at,
        })

    @http.route('/api/approvals/<int:approval_id>/decide', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    @endpoint('approve')
    def decide(self, approval_id, **kwargs):
        approval = record('sale.margin.approval', approval_id)
        data = body()
        if approval.state != 'waiting':
            raise ApiError('Cette demande a déjà été traitée.')
        approval.order_id._do_decide(data.get('decision'), data.get('reason'))
        # Approval and confirmation are separate, reviewable business events.
        return {'id': approval.id, 'state': approval.state}

    def _pickings(self, code):
        return page('stock.picking', company_domain() + [('picking_type_code', '=', code)], lambda p: {
            'id': p.id, 'name': p.name, 'origin': p.origin or '', 'state': p.state,
            'partner_name': p.partner_id.name or '', 'scheduled_date': p.scheduled_date,
            'backorder_id': p.backorder_id.id,
            'lines': [{'move_id': m.id, 'product_name': m.product_id.name,
                       'barcode': m.product_id.barcode or '', 'product_uom_qty': m.product_uom_qty,
                       'quantity': m.quantity, 'tracking': m.product_id.tracking}
                      for m in p.move_ids if m.state != 'cancel'],
        })

    @http.route('/api/deliveries', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    @endpoint('stock')
    def deliveries(self, **kwargs):
        return self._pickings('outgoing')

    @http.route('/api/receptions', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    @endpoint('stock')
    def receptions(self, **kwargs):
        return self._pickings('incoming')

    @http.route(['/api/deliveries/<int:picking_id>/validate', '/api/receptions/<int:picking_id>/validate'],
                type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    @endpoint('stock')
    def validate_picking(self, picking_id, **kwargs):
        picking = record('stock.picking', picking_id, 'write')
        code = 'outgoing' if '/deliveries/' in request.httprequest.path else 'incoming'
        if picking.picking_type_code != code or picking.state not in ('confirmed', 'assigned', 'waiting'):
            raise ApiError('Ce mouvement ne peut pas être validé.')
        if picking.move_ids.filtered(lambda m: m.product_id.tracking != 'none'):
            raise ApiError('Saisissez les lots ou numéros de série dans Odoo avant la validation.')
        data = body()
        quantities = data.get('lines', [])
        ids = [int(line['move_id']) for line in quantities]
        if len(set(ids)) != len(ids) or set(ids) != set(picking.move_ids.filtered(lambda m: m.state != 'cancel').ids):
            raise ApiError('Renseignez chaque ligne du mouvement une seule fois.')
        if not any(float(line['qty_done']) > 0 for line in quantities):
            raise ApiError('Préparez au moins une unité.')
        if data.get('backorder') != 'create':
            raise ApiError('Confirmez la création d’un reliquat pour les quantités restantes.')
        for line in quantities:
            move = picking.move_ids.filtered(lambda m: m.id == int(line['move_id']))
            move.quantity = number(line['qty_done'], 'Quantité préparée', maximum=move.product_uom_qty)
            move.picked = move.quantity > 0
        result = picking.with_context(skip_backorder=True, picking_ids_not_to_backorder=[]).button_validate()
        if isinstance(result, dict) and result.get('res_model'):
            raise ApiError('Cette validation nécessite une étape supplémentaire dans Odoo.', 422)
        return {'status': 'ok', 'state': picking.state,
                'backorders': request.env['stock.picking'].search([('backorder_id', '=', picking.id)]).mapped('name')}

    @http.route('/api/purchases', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    @endpoint('purchase')
    def purchase(self, **kwargs):
        data = body()
        partner = record('res.partner', data['partner_id'])
        product = record('product.product', data['product_id'])
        if not product.purchase_ok:
            raise ApiError('Ce produit ne peut pas être acheté.')
        order = request.env['purchase.order'].create({
            'partner_id': partner.id, 'company_id': request.env.company.id,
            'currency_id': request.env.company.currency_id.id,
            'order_line': [(0, 0, {'product_id': product.id, 'name': product.display_name,
                                  'product_uom': product.uom_po_id.id, 'date_planned': fields.Datetime.now(),
                                  'product_qty': number(data['qty'], 'Quantité', positive=True),
                                  'price_unit': number(data['price'], 'Prix', positive=True)})],
        })
        order.button_confirm()
        return {'id': order.id, 'name': order.name, 'state': order.state}

    @http.route('/api/invoices', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    @endpoint('finance')
    def invoices(self, **kwargs):
        today = fields.Date.today()
        return page('account.move', company_domain() + [('move_type', '=', 'out_invoice')], lambda inv: {
            'id': inv.id, 'name': inv.name, 'partner_name': inv.partner_id.name,
            'state': inv.state, 'payment_state': inv.payment_state, 'currency': inv.currency_id.name,
            'amount_total': inv.amount_total, 'amount_residual': inv.amount_residual,
            'due_date': inv.invoice_date_due, 'invoice_date': inv.invoice_date,
            'overdue_days': max((today - inv.invoice_date_due).days, 0)
                if inv.invoice_date_due and inv.amount_residual > 0 and inv.state == 'posted' else 0,
        })

    @http.route('/api/orders/<int:order_id>/invoice', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    @endpoint('finance')
    def invoice_order(self, order_id, **kwargs):
        order = record('sale.order', order_id)
        if order.state != 'sale' or order.invoice_status != 'to invoice':
            raise ApiError('Cette commande n’a pas de quantité à facturer.')
        invoices = order._create_invoices()
        invoices.action_post()
        return {'status': 'ok', 'invoices': invoices.mapped('name')}

    @http.route('/api/invoices/<int:invoice_id>/pay', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    @endpoint('finance')
    def pay(self, invoice_id, **kwargs):
        invoice = record('account.move', invoice_id, 'write')
        if invoice.state != 'posted' or invoice.amount_residual <= 0 or invoice.move_type != 'out_invoice':
            raise ApiError('Cette facture ne peut pas recevoir de paiement.')
        amount = number(body()['amount'], 'Paiement', positive=True, maximum=invoice.amount_residual)
        wizard = request.env['account.payment.register'].with_context(
            active_model='account.move', active_ids=invoice.ids).create({'amount': amount})
        wizard.action_create_payments()
        return {'status': 'ok', 'residual': invoice.amount_residual}

    @http.route('/api/crm/leads', type='http', auth='public', methods=['GET', 'POST', 'OPTIONS'], csrf=False)
    @endpoint('sales')
    def leads(self, **kwargs):
        if request.httprequest.method == 'POST':
            data = body()
            name = str(data.get('name', '')).strip()
            if not name:
                raise ApiError('Nommez cette opportunité.')
            lead = request.env['crm.lead'].create({
                'name': name, 'type': 'opportunity', 'user_id': request.env.uid,
                'company_id': request.env.company.id,
                'partner_id': record('res.partner', data['partner_id']).id if data.get('partner_id') else False,
                'expected_revenue': number(data.get('expected_revenue', 0), 'Revenu estimé'),
            })
            return {'id': lead.id, 'name': lead.name}
        domain = company_domain() + [('type', '=', 'opportunity')]
        if not request.env.user.has_group('sales_team.group_sale_manager'):
            domain += [('user_id', '=', request.env.uid)]
        return page('crm.lead', domain, lambda lead: {
            'id': lead.id, 'name': lead.name, 'partner_id': lead.partner_id.id,
            'partner_name': lead.partner_id.name or '', 'expected_revenue': lead.expected_revenue,
            'probability': lead.probability, 'stage_name': lead.stage_id.name,
            'won': lead.stage_id.is_won, 'salesman': lead.user_id.name,
        })

    @http.route('/api/crm/leads/<int:lead_id>/<string:action>', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    @endpoint('sales')
    def lead_action(self, lead_id, action, **kwargs):
        lead = record('crm.lead', lead_id, 'write')
        if action == 'won':
            lead.action_set_won()
        elif action == 'lost':
            lead.action_set_lost()
        else:
            raise ApiError('Action inconnue.')
        return {'status': 'ok'}

    @http.route('/api/dashboard', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    @endpoint('finance')
    def dashboard(self, **kwargs):
        domain = company_domain() + [('move_type', '=', 'out_invoice'), ('state', '=', 'posted')]
        aggregate = (request.env['account.move'].read_group(domain,
            ['amount_untaxed_signed:sum', 'amount_total_signed:sum', 'amount_residual_signed:sum'], []) or [{}])[0]
        totals = {key: aggregate.get(key, 0) or 0 for key in (
            'amount_untaxed_signed', 'amount_total_signed', 'amount_residual_signed')}
        overdue = (request.env['account.move'].read_group(domain + [
            ('invoice_date_due', '<', fields.Date.today()), ('amount_residual', '>', 0)],
            ['amount_residual_signed:sum'], []) or [{}])[0]
        trend = request.env['account.move'].read_group(domain, ['amount_untaxed_signed:sum'],
            ['invoice_date:month'], orderby='invoice_date', lazy=False)[-6:]
        result = {
            'currency': request.env.company.currency_id.name,
            'kpis': {'invoiced': totals['amount_untaxed_signed'],
                     'settled': totals['amount_total_signed'] - totals['amount_residual_signed'],
                     'receivable': totals['amount_residual_signed'],
                     'overdue': overdue.get('amount_residual_signed', 0) or 0},
            'trend': [{'name': row['invoice_date:month'], 'value': row['amount_untaxed_signed']} for row in trend],
            'pending_approvals': request.env['sale.margin.approval'].search_count(
                company_domain() + [('state', '=', 'waiting')]) if can('approve') else None,
            'pending_deliveries': request.env['stock.picking'].search_count(company_domain() + [
                ('picking_type_code', '=', 'outgoing'), ('state', 'not in', ['done', 'cancel'])]) if can('stock') else None,
        }
        today = fields.Date.today()
        intervals = [
            ('Non échues', ['|', ('invoice_date_due', '=', False), ('invoice_date_due', '>=', today)]),
            ('1–30 jours', [('invoice_date_due', '<', today), ('invoice_date_due', '>=', fields.Date.subtract(today, days=30))]),
            ('31–60 jours', [('invoice_date_due', '<', fields.Date.subtract(today, days=30)), ('invoice_date_due', '>=', fields.Date.subtract(today, days=60))]),
            ('Plus de 60 jours', [('invoice_date_due', '<', fields.Date.subtract(today, days=60))]),
        ]
        result['aging'] = []
        for name, interval in intervals:
            bucket = (request.env['account.move'].read_group(domain + [('amount_residual', '>', 0)] + interval,
                ['amount_residual_signed:sum'], []) or [{}])[0]
            result['aging'].append({'name': name, 'value': bucket.get('amount_residual_signed', 0) or 0})
        return result

    @http.route('/api/settings', type='http', auth='public', methods=['GET', 'POST', 'OPTIONS'], csrf=False)
    @endpoint('admin')
    def settings(self, **kwargs):
        if request.httprequest.method == 'POST':
            threshold = number(body()['threshold'], 'Seuil', maximum=99.99)
            # Only this company setting is elevated, after explicit operations-manager authorization.
            request.env.company.sudo().write({'margin_approval_threshold': threshold})
        return {'company': request.env.company.name, 'threshold': request.env.company.margin_approval_threshold,
                'currency': request.env.company.currency_id.name}
