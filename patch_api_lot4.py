import codecs
import json

with codecs.open('C:/Users/PC/.gemini/antigravity/scratch/odoo-distribution-erp/addons/optika_rest_api/controllers/api_controller.py', 'r', 'utf-8') as f:
    content = f.read()

new_routes = """

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
"""

content += new_routes

with codecs.open('C:/Users/PC/.gemini/antigravity/scratch/odoo-distribution-erp/addons/optika_rest_api/controllers/api_controller.py', 'w', 'utf-8') as f:
    f.write(content)
