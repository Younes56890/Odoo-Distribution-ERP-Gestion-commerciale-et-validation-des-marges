"""Provision distinct Odoo accounts through XML-RPC. Credentials come only from the environment."""
import os
import xmlrpc.client


def main():
    url = os.environ.get('ODOO_URL', 'http://localhost:8069')
    database = os.environ.get('OPTIKA_DB', 'optika_demo')
    login = os.environ.get('ODOO_ADMIN_LOGIN', 'admin')
    password = os.environ.get('ODOO_ADMIN_PASSWORD')
    user_password = os.environ.get('OPTIKA_USER_PASSWORD')
    if not password or not user_password:
        raise SystemExit('Renseignez ODOO_ADMIN_PASSWORD et OPTIKA_USER_PASSWORD dans l’environnement.')
    common = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/common')
    uid = common.authenticate(database, login, password, {})
    if not uid:
        raise SystemExit('Authentification administrateur refusée.')
    models = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/object')

    def call(model, method, args, kwargs=None):
        return models.execute_kw(database, uid, password, model, method, args, kwargs or {})

    def group(xmlid):
        module, name = xmlid.split('.')
        result = call('ir.model.data', 'search_read', [[('module', '=', module), ('name', '=', name)]],
                      {'fields': ['res_id'], 'limit': 1})
        if not result:
            raise SystemExit(f'Groupe absent : {xmlid}. Installez optika_rest_api.')
        return result[0]['res_id']

    accounts = [
        ('Direction Optika', 'manager@optika.ma', ['optika_rest_api.group_operations_manager']),
        ('Commercial Optika', 'commercial@optika.ma', ['sales_team.group_sale_salesman']),
        ('Logistique Optika', 'logistique@optika.ma', ['stock.group_stock_user', 'purchase.group_purchase_user']),
        ('Finance Optika', 'compta@optika.ma', ['account.group_account_user']),
    ]
    internal = group('base.group_user')
    for name, identifier, groups in accounts:
        existing = call('res.users', 'search', [[('login', '=', identifier)]])
        if existing:
            print(f'Compte existant conservé : {identifier}. Vérifiez ses groupes dans Odoo.')
            continue
        call('res.users', 'create', [{
            'name': name, 'login': identifier, 'email': identifier, 'password': user_password,
            'groups_id': [(6, 0, [internal, *(group(xmlid) for xmlid in groups)])],
        }])
        print(f'Compte créé avec ses groupes propres : {identifier}')


if __name__ == '__main__':
    main()
