import codecs

with codecs.open('C:/Users/PC/.gemini/antigravity/scratch/odoo-distribution-erp/addons/optika_rest_api/controllers/api_controller.py', 'r', 'utf-8') as f:
    content = f.read()

old_code = "partner = request.env['res.partner'].sudo().browse(partner_id)"
new_code = "partner = request.env['res.partner'].sudo().browse(int(partner_id))"

content = content.replace(old_code, new_code)

with codecs.open('C:/Users/PC/.gemini/antigravity/scratch/odoo-distribution-erp/addons/optika_rest_api/controllers/api_controller.py', 'w', 'utf-8') as f:
    f.write(content)
