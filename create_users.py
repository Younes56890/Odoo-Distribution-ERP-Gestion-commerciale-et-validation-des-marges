import xmlrpc.client

url = 'http://localhost:8069'
db = 'optika_demo'
username = 'admin'
password = 'admin_master_2024'  # Usually admin/admin or admin/admin_master_2024

try:
    common = xmlrpc.client.ServerProxy('{}/xmlrpc/2/common'.format(url))
    uid = common.authenticate(db, username, password, {})
    if not uid:
        print("Auth failed with admin_master_2024, trying admin...")
        password = 'admin'
        uid = common.authenticate(db, username, password, {})
        
    models = xmlrpc.client.ServerProxy('{}/xmlrpc/2/object'.format(url))
    
    users = [
        {'name': 'Logistique Demo', 'login': 'logistics@optika.ma', 'password': 'demo123'},
        {'name': 'Compta Demo', 'login': 'compta@optika.ma', 'password': 'demo123'}
    ]
    
    for u in users:
        # check if exists
        exists = models.execute_kw(db, uid, password, 'res.users', 'search', [[('login', '=', u['login'])]])
        if exists:
            print(f"User {u['login']} already exists.")
        else:
            user_id = models.execute_kw(db, uid, password, 'res.users', 'create', [{
                'name': u['name'],
                'login': u['login'],
                'password': u['password'],
                'sel_groups_1_8_9': 8 # internal user
            }])
            print(f"Created user {u['login']} with ID {user_id}")
            
except Exception as e:
    print(f"Error: {e}")
