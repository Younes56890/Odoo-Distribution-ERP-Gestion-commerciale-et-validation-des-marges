import codecs

with codecs.open('C:/Users/PC/.gemini/antigravity/scratch/odoo-distribution-erp/addons/optika_rest_api/controllers/api_controller.py', 'r', 'utf-8') as f:
    content = f.read()

new_routes = """

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
"""

content += new_routes

with codecs.open('C:/Users/PC/.gemini/antigravity/scratch/odoo-distribution-erp/addons/optika_rest_api/controllers/api_controller.py', 'w', 'utf-8') as f:
    f.write(content)
