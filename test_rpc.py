import json
import urllib.request
req = urllib.request.Request('http://localhost:8069/jsonrpc', data=json.dumps({
    "jsonrpc": "2.0",
    "method": "call",
    "params": {
        "service": "object",
        "method": "execute_kw",
        "args": ["optika_demo", 1, "admin", "res.partner", "address_get", [[1], ["invoice"]], {}]
    },
    "id": 1
}).encode('utf-8'), headers={'Content-Type': 'application/json'})
res = urllib.request.urlopen(req)
print(res.read().decode())
