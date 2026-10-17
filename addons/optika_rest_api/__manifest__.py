{
    'name': 'Optika REST API',
    'version': '17.0.1.0.0',
    'category': 'Sales',
    'summary': 'Expose Odoo Sales and Approvals via REST API for React',
    'depends': ['base', 'web', 'sale_margin_approval', 'sale_stock', 'purchase_stock', 'account', 'crm'],
    'data': ['security/groups.xml'],
    'installable': True,
    'application': False,
    'license': 'LGPL-3',
}
