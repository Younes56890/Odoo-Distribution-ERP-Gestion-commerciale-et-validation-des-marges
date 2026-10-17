import json

from odoo.tests import HttpCase, tagged


@tagged('post_install', '-at_install')
class TestOptikaApi(HttpCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.env.company.margin_approval_threshold = 15
        cls.env.company.email = 'company@example.test'
        cls.commercial = cls.env['res.users'].create({
            'name': 'API Commercial', 'login': 'api_commercial', 'password': 'api_test_password', 'email': 'sales@example.test',
            'groups_id': [(6, 0, [cls.env.ref('sales_team.group_sale_salesman').id])],
        })
        cls.manager = cls.env['res.users'].create({
            'name': 'API Manager', 'login': 'api_manager', 'password': 'api_test_password', 'email': 'manager@example.test',
            'groups_id': [(6, 0, [cls.env.ref('optika_rest_api.group_operations_manager').id])],
        })
        cls.partner = cls.env['res.partner'].create({'name': 'API Client'})
        cls.product = cls.env['product.product'].create({
            'name': 'API Monture', 'type': 'product', 'list_price': 100, 'standard_price': 80,
        })

    def _connect(self, login):
        self.authenticate(login, 'api_test_password')
        session = self.url_open('/api/auth/session')
        self.assertEqual(session.status_code, 200)
        return session.json()['csrf_token']

    def _post(self, path, data, token=None, origin=None):
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['X-CSRF-Token'] = token
        if origin:
            headers['Origin'] = origin
        return self.url_open(path, data=json.dumps(data), headers=headers)

    def _quote(self, justification='Client stratégique'):
        return {'partner_id': self.partner.id, 'action': 'submit', 'justification': justification,
                'lines': [{'product_id': self.product.id, 'qty': 10, 'price': 100, 'discount': 10}]}

    def test_commercial_cannot_access_finance_or_stock(self):
        token = self._connect('api_commercial')
        self.assertEqual(self.url_open('/api/invoices').status_code, 403)
        self.assertEqual(self.url_open('/api/deliveries').status_code, 403)
        self.assertEqual(self._post('/api/purchases', {}, token).status_code, 403)
        self.assertEqual(self._post('/api/approvals/1/decide', {}, token).status_code, 403)

    def test_csrf_and_untrusted_origin_are_rejected(self):
        token = self._connect('api_commercial')
        self.assertEqual(self._post('/api/orders', self._quote()).status_code, 403)
        self.assertEqual(self._post('/api/orders', self._quote(), token, 'https://untrusted.example').status_code, 403)

    def test_failed_request_rolls_back_order(self):
        token = self._connect('api_commercial')
        before = self.env['sale.order'].search_count([('partner_id', '=', self.partner.id)])
        result = self._post('/api/orders', self._quote(''), token)
        self.assertEqual(result.status_code, 422)
        self.assertEqual(self.env['sale.order'].search_count([('partner_id', '=', self.partner.id)]), before)

    def test_approval_contract_and_separate_confirmation(self):
        token = self._connect('api_commercial')
        result = self._post('/api/orders', self._quote(), token)
        self.assertEqual(result.status_code, 200, result.text)
        order = result.json()
        self.assertEqual(order['state'], 'draft')
        self.assertEqual(order['margin_approval_state'], 'waiting')
        token = self._connect('api_manager')
        approvals = self.url_open('/api/approvals').json()['items']
        approval = next(a for a in approvals if a['order_id'] == order['id'])
        self.assertEqual(approval['salesman'], self.commercial.name)
        decision = self._post(f"/api/approvals/{approval['id']}/decide",
                              {'decision': 'approved', 'reason': 'Partenariat confirmé'}, token)
        self.assertEqual(decision.status_code, 200, decision.text)
        token = self._connect('api_commercial')
        confirmed = self._post(f"/api/orders/{order['id']}/submit", {}, token)
        self.assertEqual(confirmed.status_code, 200, confirmed.text)
        self.assertEqual(confirmed.json()['state'], 'sale')

    def test_logout_closes_session(self):
        token = self._connect('api_commercial')
        self.assertEqual(self._post('/api/auth/logout', {}, token).status_code, 200)
        self.assertEqual(self.url_open('/api/auth/session').status_code, 401)

    def test_login_uses_real_identity_and_refreshes_csrf_after_rotation(self):
        self.authenticate(None, None)
        # HttpCase adds a domainless cookie which would shadow the rotated host cookie.
        self.opener.cookies.clear(domain='', path='/', name='session_id')
        result = self._post('/api/auth/login', {'login': 'api_commercial', 'password': 'api_test_password'})
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()['uid'], self.commercial.id)
        self.assertNotIn('csrf_token', result.json())
        token = self.url_open('/api/auth/session').json()['csrf_token']
        created = self._post('/api/orders', {**self._quote(), 'action': 'draft'}, token)
        self.assertEqual(created.status_code, 200, created.text)
