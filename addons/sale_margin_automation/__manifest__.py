{
    'name': 'Sale Margin Automation',
    'version': '17.0.1.0.0',
    'summary': 'Suivi interne des dérogations, documents et rapports périodiques',
    'depends': ['sale_margin_approval', 'optika_rest_api', 'mail'],
    'data': [
        'security/groups.xml',
        'data/automation_user.xml',
        'security/ir.model.access.csv',
        'security/rules.xml',
        'data/ir_cron.xml',
        'views/automation_views.xml',
    ],
    'license': 'LGPL-3',
    'installable': True,
    'application': False,
}
