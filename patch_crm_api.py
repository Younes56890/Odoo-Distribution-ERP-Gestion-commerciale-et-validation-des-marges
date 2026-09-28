import codecs
import json

with codecs.open('C:/Users/PC/.gemini/antigravity/scratch/odoo-distribution-erp/addons/optika_rest_api/controllers/api_controller.py', 'r', 'utf-8') as f:
    content = f.read()

new_routes = """

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
"""

if 'def crm_leads' not in content:
    content += new_routes

with codecs.open('C:/Users/PC/.gemini/antigravity/scratch/odoo-distribution-erp/addons/optika_rest_api/controllers/api_controller.py', 'w', 'utf-8') as f:
    f.write(content)
