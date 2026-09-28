from odoo import http
from odoo.http import request
import json

def build_cors_response(data, status=200):
    origin = request.httprequest.headers.get('Origin', '*')
    headers = [
        ('Content-Type', 'application/json'),
        ('Access-Control-Allow-Origin', origin),
        ('Access-Control-Allow-Credentials', 'true'),
        ('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE'),
        ('Access-Control-Allow-Headers', 'Content-Type, Authorization'),
    ]
    return request.make_response(json.dumps(data), headers=headers, status=status)

def check_auth():
    if not request.session.uid:
        return False
    return True

class ApiController(http.Controller):

    @http.route('/api/auth/login', type='http', auth='none', methods=['POST', 'OPTIONS'], csrf=False)
    def api_login(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return build_cors_response({})
            
        data = json.loads(request.httprequest.data)
        login = data.get('login')
        password = data.get('password')
        db = 'optika_demo'
        
        # --- MOCK DEMO USERS ---
        if login in ['logistique@optika.ma', 'compta@optika.ma'] and password == 'demo123':
            uid = request.session.authenticate(db, 'manager@optika.ma', 'demo123')
            role = 'logistics' if 'logistique' in login else 'accountant'
            name = 'Service Logistique' if 'logistique' in login else 'Service Comptabilité'
            return build_cors_response({
                'uid': uid,
                'name': name,
                'session_id': request.session.sid,
                'is_manager': False,
                'role': role
            })
        
        uid = request.session.authenticate(db, login, password)
        if not uid:
            return build_cors_response({'error': 'Invalid credentials'}, status=401)
            
        user = request.env['res.users'].browse(uid)
        is_manager = user.has_group('sale_margin_approval.group_approver')
        role = 'manager' if is_manager else 'commercial'
        return build_cors_response({
            'uid': uid,
            'name': user.name,
            'session_id': request.session.sid,
            'is_manager': is_manager,
            'role': role
        })

    @http.route('/api/customers', type='http', auth='public', methods=['GET', 'POST', 'OPTIONS'], csrf=False)
    def customers(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return build_cors_response({})
        if not check_auth():
            return build_cors_response({'error': 'Unauthorized'}, status=401)
            
        if request.httprequest.method == 'GET':
            partners = request.env['res.partner'].sudo().search([])
            data = [{'id': p.id, 'name': p.name, 'email': p.email or '', 'phone': p.phone or ''} for p in partners]
            return build_cors_response(data)
            
        if request.httprequest.method == 'POST':
            data = json.loads(request.httprequest.data)
            partner = request.env['res.partner'].sudo().create({
                'name': data.get('name'),
                'email': data.get('email', ''),
                'phone': data.get('phone', '')
            })
            return build_cors_response({'id': partner.id, 'name': partner.name, 'email': partner.email, 'phone': partner.phone})

    @http.route('/api/products', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    def get_products(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return build_cors_response({})
        if not check_auth():
            return build_cors_response({'error': 'Unauthorized'}, status=401)
            
        products = request.env['product.product'].sudo().search([('sale_ok', '=', True)])
        data = [{
            'id': p.id,
            'name': p.name,
            'price': p.list_price,
            'cost': p.standard_price,
            'qty_available': p.qty_available
        } for p in products]
        return build_cors_response(data)

    @http.route('/api/orders', type='http', auth='public', methods=['GET', 'POST', 'OPTIONS'], csrf=False)
    def orders(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return build_cors_response({})
        if not check_auth():
            return build_cors_response({'error': 'Unauthorized'}, status=401)
            
        if request.httprequest.method == 'GET':
            orders = request.env['sale.order'].sudo().search([('user_id', '=', request.session.uid)], order='id desc')
            data = [{
                'id': o.id, 
                'name': o.name, 
                'partner_name': o.partner_id.name,
                'state': o.state, 
                'margin_approval_state': getattr(o, 'margin_approval_state', False),
                'amount_total': o.amount_total,
                'date_order': o.date_order.strftime('%Y-%m-%d %H:%M') if o.date_order else ''
            } for o in orders]
            return build_cors_response(data)
            
        if request.httprequest.method == 'POST':
            data = json.loads(request.httprequest.data)
            partner_id = data.get('partner_id')
            lines = data.get('lines', [])
            action = data.get('action', 'submit')
            
            if not partner_id:
                return build_cors_response({'error': 'partner_id is required'}, status=400)
                
            order_lines = []
            for line in lines:
                order_lines.append((0, 0, {
                    'product_id': line['product_id'],
                    'product_uom_qty': line['qty'],
                    'price_unit': line['price'],
                    'discount': line['discount']
                }))
                
            partner = request.env['res.partner'].sudo().browse(int(partner_id))
            order = request.env['sale.order'].with_user(request.session.uid).create({
                'partner_id': partner.id,
                'partner_invoice_id': partner.address_get(['invoice'])['invoice'] if partner.address_get(['invoice']) else partner.id,
                'partner_shipping_id': partner.address_get(['delivery'])['delivery'] if partner.address_get(['delivery']) else partner.id,
                'order_line': order_lines
            })
            
            if action == 'submit' and getattr(order, 'margin_approval_state', '') != 'waiting':
                order.action_confirm()
                
            return build_cors_response({
                'id': order.id,
                'name': order.name,
                'state': order.state,
                'margin_approval_state': getattr(order, 'margin_approval_state', False),
                'margin_percent': getattr(order, 'margin_percent', 0) * 100
            })

    @http.route('/api/orders/<int:order_id>', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    def order_details(self, order_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return build_cors_response({})
        if not check_auth():
            return build_cors_response({'error': 'Unauthorized'}, status=401)
            
        order = request.env['sale.order'].sudo().browse(order_id)
        if not order.exists() or order.user_id.id != request.session.uid:
            return build_cors_response({'error': 'Not found'}, status=404)
            
        lines = [{
            'id': line.id,
            'product_id': line.product_id.id,
            'name': line.product_id.name,
            'qty': line.product_uom_qty,
            'price': line.price_unit,
            'discount': line.discount
        } for line in order.order_line]
        
        data = {
            'id': order.id,
            'name': order.name,
            'partner_id': order.partner_id.id,
            'partner_name': order.partner_id.name,
            'state': order.state,
            'margin_approval_state': getattr(order, 'margin_approval_state', False),
            'amount_total': order.amount_total,
            'lines': lines
        }
        return build_cors_response(data)

    @http.route('/api/approvals', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    def get_approvals(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return build_cors_response({})
        if not check_auth():
            return build_cors_response({'error': 'Unauthorized'}, status=401)
            
        user = request.env['res.users'].browse(request.session.uid)
        if not user.has_group('sale_margin_approval.group_approver'):
            return build_cors_response({'error': 'Forbidden'}, status=403)
            
        approvals = request.env['sale.margin.approval'].sudo().search([('state', '=', 'waiting')])
        data = [{
            'id': app.id,
            'order_id': app.order_id.id,
            'order_name': app.order_id.name,
            'salesman': app.request_user_id.name,
            'margin_rate': app.margin_rate,
            'amount': app.order_id.amount_untaxed
        } for app in approvals]
        return build_cors_response(data)

    @http.route('/api/approvals/<int:approval_id>/decide', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def decide_approval(self, approval_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return build_cors_response({})
        if not check_auth():
            return build_cors_response({'error': 'Unauthorized'}, status=401)
            
        user = request.env['res.users'].browse(request.session.uid)
        if not user.has_group('sale_margin_approval.group_approver'):
            return build_cors_response({'error': 'Forbidden'}, status=403)
            
        data = json.loads(request.httprequest.data)
        decision = data.get('decision')
        reason = data.get('reason', '')
        
        approval = request.env['sale.margin.approval'].sudo().browse(approval_id)
        if decision == 'approved':
            approval.with_user(request.session.uid).action_approve(reason)
            approval.order_id.with_user(request.session.uid).action_confirm()
        else:
            approval.with_user(request.session.uid).action_refuse(reason)
            
        return build_cors_response({'status': 'ok', 'state': approval.state})


    @http.route('/api/deliveries', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    def get_deliveries(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return build_cors_response({})
        if not check_auth():
            return build_cors_response({'error': 'Unauthorized'}, status=401)
            
        pickings = request.env['stock.picking'].sudo().search([
            ('picking_type_id.code', '=', 'outgoing'),
            ('state', 'not in', ['done', 'cancel'])
        ], order='id desc')
        
        data = []
        for p in pickings:
            lines = [{
                'move_id': m.id,
                'product_name': m.product_id.name,
                'product_uom_qty': m.product_uom_qty,
                'quantity': m.quantity
            } for m in p.move_ids]
            data.append({
                'id': p.id,
                'name': p.name,
                'origin': p.origin or '',
                'state': p.state,
                'partner_name': p.partner_id.name or '',
                'lines': lines
            })
        return build_cors_response(data)

    @http.route('/api/deliveries/<int:picking_id>/validate', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def validate_delivery(self, picking_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return build_cors_response({})
        if not check_auth():
            return build_cors_response({'error': 'Unauthorized'}, status=401)
            
        picking = request.env['stock.picking'].sudo().browse(picking_id)
        if not picking.exists() or picking.state in ['done', 'cancel']:
            return build_cors_response({'error': 'Invalid picking'}, status=400)
            
        data = json.loads(request.httprequest.data)
        lines_data = data.get('lines', [])
        
        for ld in lines_data:
            move = picking.move_ids.filtered(lambda m: m.id == ld.get('move_id'))
            if move:
                move.quantity = float(ld.get('qty_done', 0))
                
        res = picking.button_validate()
        
        if isinstance(res, dict) and res.get('res_model') == 'stock.backorder.confirmation':
            wizard = request.env['stock.backorder.confirmation'].with_context(res.get('context', {})).sudo().create({'pick_ids': [(4, picking.id)]})
            wizard.process()
            
        return build_cors_response({'status': 'ok', 'state': picking.state})


    @http.route('/api/purchases', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def create_purchase(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return build_cors_response({})
        if not check_auth():
            return build_cors_response({'error': 'Unauthorized'}, status=401)
            
        data = json.loads(request.httprequest.data)
        partner_id = data.get('partner_id')
        product_id = data.get('product_id')
        qty = float(data.get('qty', 1.0))
        price = float(data.get('price', 0.0))
        
        # Create PO
        po = request.env['purchase.order'].sudo().create({
            'partner_id': int(partner_id),
            'order_line': [(0, 0, {
                'product_id': int(product_id),
                'product_qty': qty,
                'price_unit': price,
            })]
        })
        # Confirm PO to generate receipt
        po.button_confirm()
        
        return build_cors_response({'id': po.id, 'name': po.name, 'state': po.state})

    @http.route('/api/receptions', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    def get_receptions(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return build_cors_response({})
        if not check_auth():
            return build_cors_response({'error': 'Unauthorized'}, status=401)
            
        pickings = request.env['stock.picking'].sudo().search([
            ('picking_type_id.code', '=', 'incoming'),
            ('state', 'not in', ['done', 'cancel'])
        ], order='id desc')
        
        data = []
        for p in pickings:
            lines = [{
                'move_id': m.id,
                'product_id': m.product_id.id,
                'product_name': m.product_id.name,
                'product_uom_qty': m.product_uom_qty,
                'quantity': m.quantity
            } for m in p.move_ids]
            data.append({
                'id': p.id,
                'name': p.name,
                'origin': p.origin or '',
                'state': p.state,
                'partner_name': p.partner_id.name or '',
                'lines': lines
            })
        return build_cors_response(data)

    @http.route('/api/receptions/<int:picking_id>/validate', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def validate_reception(self, picking_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return build_cors_response({})
        if not check_auth():
            return build_cors_response({'error': 'Unauthorized'}, status=401)
            
        picking = request.env['stock.picking'].sudo().browse(picking_id)
        if not picking.exists() or picking.state in ['done', 'cancel']:
            return build_cors_response({'error': 'Invalid picking'}, status=400)
            
        data = json.loads(request.httprequest.data)
        lines_data = data.get('lines', [])
        
        for ld in lines_data:
            move = picking.move_ids.filtered(lambda m: m.id == ld.get('move_id'))
            if move:
                move.quantity = float(ld.get('qty_done', 0))
                
        res = picking.button_validate()
        
        if isinstance(res, dict) and res.get('res_model') == 'stock.backorder.confirmation':
            wizard = request.env['stock.backorder.confirmation'].with_context(res.get('context', {})).sudo().create({'pick_ids': [(4, picking.id)]})
            wizard.process()
            
        return build_cors_response({'status': 'ok', 'state': picking.state})


    @http.route('/api/invoices', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    def get_invoices(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return build_cors_response({})
        if not check_auth():
            return build_cors_response({'error': 'Unauthorized'}, status=401)
            
        invoices = request.env['account.move'].sudo().search([('move_type', '=', 'out_invoice')], order='id desc')
        data = [{
            'id': inv.id,
            'name': inv.name,
            'partner_name': inv.partner_id.name,
            'state': inv.state,
            'payment_state': inv.payment_state,
            'amount_total': inv.amount_total,
            'amount_residual': inv.amount_residual,
        } for inv in invoices]
        return build_cors_response(data)

    @http.route('/api/orders/<int:order_id>/invoice', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def create_invoice(self, order_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return build_cors_response({})
        if not check_auth():
            return build_cors_response({'error': 'Unauthorized'}, status=401)
            
        order = request.env['sale.order'].sudo().browse(order_id)
        if order.exists() and order.state == 'sale':
            invoice = order._create_invoices()
            if invoice:
                invoice.action_post()
            return build_cors_response({'status': 'ok'})
        return build_cors_response({'error': 'Cannot invoice'}, status=400)

    @http.route('/api/invoices/<int:invoice_id>/pay', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def pay_invoice(self, invoice_id, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return build_cors_response({})
        if not check_auth():
            return build_cors_response({'error': 'Unauthorized'}, status=401)
            
        data = json.loads(request.httprequest.data)
        amount = float(data.get('amount', 0))
        
        invoice = request.env['account.move'].sudo().browse(invoice_id)
        if invoice.exists() and invoice.state == 'posted' and invoice.amount_residual > 0:
            wizard = request.env['account.payment.register'].with_context(active_model='account.move', active_ids=[invoice.id]).sudo().create({
                'amount': amount,
            })
            wizard.action_create_payments()
            return build_cors_response({'status': 'ok', 'residual': invoice.amount_residual})
            
        return build_cors_response({'error': 'Invalid invoice'}, status=400)


    @http.route('/api/crm/leads', type='http', auth='public', methods=['GET', 'POST', 'OPTIONS'], csrf=False)
    def crm_leads(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return build_cors_response({})
        if not check_auth():
            return build_cors_response({'error': 'Unauthorized'}, status=401)
            
        if request.httprequest.method == 'GET':
            domain = []
            if not request.env['res.users'].sudo().browse(request.session.uid).has_group('sales_team.group_sale_manager'):
                domain = [('user_id', '=', request.session.uid)]
                
            leads = request.env['crm.lead'].sudo().search(domain, order='id desc')
            data = [{
                'id': l.id,
                'name': l.name,
                'partner_name': l.partner_id.name if l.partner_id else '',
                'expected_revenue': l.expected_revenue,
                'probability': l.probability,
                'stage_name': l.stage_id.name if l.stage_id else 'Nouveau',
                'user_id': l.user_id.name if l.user_id else ''
            } for l in leads]
            return build_cors_response(data)
            
        if request.httprequest.method == 'POST':
            data = json.loads(request.httprequest.data)
            lead = request.env['crm.lead'].with_user(request.session.uid).create({
                'name': data.get('name'),
                'partner_id': int(data.get('partner_id')) if data.get('partner_id') else False,
                'expected_revenue': float(data.get('expected_revenue', 0)),
                'user_id': request.session.uid
            })
            return build_cors_response({'id': lead.id, 'name': lead.name})

    @http.route('/api/crm/leads/<int:lead_id>/<string:action>', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def crm_lead_action(self, lead_id, action, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return build_cors_response({})
        if not check_auth():
            return build_cors_response({'error': 'Unauthorized'}, status=401)
            
        lead = request.env['crm.lead'].sudo().browse(lead_id)
        if not lead.exists():
            return build_cors_response({'error': 'Not found'}, status=404)
            
        if action == 'won':
            lead.action_set_won()
        elif action == 'lost':
            lead.action_set_lost()
            
        return build_cors_response({'status': 'ok'})


    @http.route('/api/dashboard', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    def get_dashboard(self, **kwargs):
        if request.httprequest.method == 'OPTIONS':
            return build_cors_response({})
        if not check_auth():
            return build_cors_response({'error': 'Unauthorized'}, status=401)
            
        # Revenue
        sales = request.env['sale.order'].sudo().search([('state', 'in', ['sale', 'done'])])
        total_revenue = sum(sales.mapped('amount_untaxed'))
        
        # CRM
        leads = request.env['crm.lead'].sudo().search([])
        total_leads = len(leads)
        won_leads = len(leads.filtered(lambda l: l.probability == 100 or (l.stage_id and l.stage_id.is_won)))
        win_rate = round((won_leads / total_leads * 100), 1) if total_leads > 0 else 0
        
        # Top Products
        lines = request.env['sale.order.line'].sudo().search([('state', 'in', ['sale', 'done'])])
        prod_counts = {}
        for l in lines:
            if l.product_id:
                prod_counts[l.product_id.name] = prod_counts.get(l.product_id.name, 0) + l.product_uom_qty
        top_products = sorted([{'name': k, 'value': v} for k, v in prod_counts.items()], key=lambda x: x['value'], reverse=True)[:5]
        
        # Tasks
        pending_deliveries = request.env['stock.picking'].sudo().search_count([('picking_type_code', '=', 'outgoing'), ('state', 'in', ['confirmed', 'assigned'])])
        pending_approvals = request.env['sale.order'].sudo().search_count([('margin_approval_state', '=', 'waiting')])
        
        data = {
            'kpis': {
                'revenue': total_revenue,
                'win_rate': win_rate,
                'pending_deliveries': pending_deliveries,
                'pending_approvals': pending_approvals,
                'total_leads': total_leads
            },
            'top_products': top_products
        }
        return build_cors_response(data)
