import xmlrpc.client
models = xmlrpc.client.ServerProxy('http://localhost:8069/xmlrpc/2/object')
uid = 1
password = 'admin'
db = 'optika_demo'
manager_id = models.execute_kw(db, uid, password, 'res.users', 'search', [[['login', '=', 'manager@optika.ma']]])
if manager_id:
    user_data = models.execute_kw(db, uid, password, 'res.users', 'read', [manager_id, ['groups_id']])
    groups = models.execute_kw(db, uid, password, 'res.groups', 'read', [user_data[0]['groups_id'], ['name', 'category_id']])
    print([g['name'] for g in groups])
