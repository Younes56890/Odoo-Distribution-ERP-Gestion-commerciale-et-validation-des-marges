import json
import urllib.request
import urllib.error

data = json.dumps({'login': 'commercial@optika.ma', 'password': 'demo123'}).encode('utf-8')
req = urllib.request.Request('http://localhost:8069/api/auth/login', data=data, headers={'Content-Type': 'application/json'})

try:
    with urllib.request.urlopen(req) as response:
        print("STATUS:", response.status)
        print("BODY:", response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("HTTP ERROR:", e.code)
    print("BODY:", e.read().decode('utf-8'))
except Exception as e:
    print("ERROR:", e)
