const fs = require('fs');

const content = `from odoo import http
from odoo.http import request
import json

def build_cors_response(data, status=200):
    headers = [
        ('Content-Type', 'application/json'),
        ('Access-Control-Allow-Origin', 'http://localhost:5173'),
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
        
        uid = request.session.authenticate(db, login, password)
        if not uid:
            return build_cors_response({'error': 'Invalid credentials'}, status=401)
            
        user = request.env['res.users'].browse(uid)
        return build_cors_response({
            'uid': uid,
            'name': user.name,
            'session_id': request.session.sid,
            'is_manager': user.has_group('sale_margin_approval.group_margin_manager')
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
                
            order = request.env['sale.order'].with_user(request.session.uid).create({
                'partner_id': partner_id,
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
        if not user.has_group('sale_margin_approval.group_margin_manager'):
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
        if not user.has_group('sale_margin_approval.group_margin_manager'):
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
`

fs.writeFileSync('C:/Users/PC/.gemini/antigravity/scratch/odoo-distribution-erp/addons/optika_rest_api/controllers/api_controller.py', content, 'utf8');
