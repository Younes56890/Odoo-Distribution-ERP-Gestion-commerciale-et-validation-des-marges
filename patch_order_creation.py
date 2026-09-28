import codecs
import re

with codecs.open('C:/Users/PC/.gemini/antigravity/scratch/odoo-distribution-erp/addons/optika_rest_api/controllers/api_controller.py', 'r', 'utf-8') as f:
    content = f.read()

# Replace the create call in POST /api/orders
old_code = """
            order = request.env['sale.order'].with_user(request.session.uid).create({
                'partner_id': partner_id,
                'order_line': order_lines
            })
"""
new_code = """
            partner = request.env['res.partner'].sudo().browse(partner_id)
            order = request.env['sale.order'].with_user(request.session.uid).create({
                'partner_id': partner.id,
                'partner_invoice_id': partner.address_get(['invoice'])['invoice'] if partner.address_get(['invoice']) else partner.id,
                'partner_shipping_id': partner.address_get(['delivery'])['delivery'] if partner.address_get(['delivery']) else partner.id,
                'order_line': order_lines
            })
"""

content = content.replace(old_code.strip(), new_code.strip())

with codecs.open('C:/Users/PC/.gemini/antigravity/scratch/odoo-distribution-erp/addons/optika_rest_api/controllers/api_controller.py', 'w', 'utf-8') as f:
    f.write(content)
