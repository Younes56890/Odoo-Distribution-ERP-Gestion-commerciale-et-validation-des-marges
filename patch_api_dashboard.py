import codecs
import json

with codecs.open('C:/Users/PC/.gemini/antigravity/scratch/odoo-distribution-erp/addons/optika_rest_api/controllers/api_controller.py', 'r', 'utf-8') as f:
    content = f.read()

new_routes = """

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
"""

if 'def get_dashboard' not in content:
    content += new_routes

with codecs.open('C:/Users/PC/.gemini/antigravity/scratch/odoo-distribution-erp/addons/optika_rest_api/controllers/api_controller.py', 'w', 'utf-8') as f:
    f.write(content)
