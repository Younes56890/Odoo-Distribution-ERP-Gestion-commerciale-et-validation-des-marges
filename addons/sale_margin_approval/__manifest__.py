{
    'name': 'Sale Margin Approval',
    'version': '17.0.1.0.0',
    'summary': 'Circuit d approbation des devis a marge insuffisante',
    'description': '''
        Ce module bloque la confirmation d un devis dont le taux de marque
        est inferieur au seuil configure sur la societe.
        Un responsable autorise doit approuver la derogation.
    ''',
    'author': 'Optika Distribution',
    'category': 'Sales/Sales',
    'depends': [
        'sale_management',
        'sale_margin',
    ],
    'data': [
        'security/security.xml',
        'security/ir.model.access.csv',
        'views/res_config_settings_views.xml',
        'views/sale_margin_approval_views.xml',
        'views/sale_order_views.xml',
        'views/menus.xml',
        'report/approval_report.xml',
        'report/approval_report_template.xml',
        'data/demo_data.xml',
    ],
    'demo': [],
    'installable': True,
    'application': False,
    'auto_install': False,
    'license': 'LGPL-3',
}
