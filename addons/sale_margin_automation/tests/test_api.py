import json

from odoo.tests.common import HttpCase, new_test_user, tagged


@tagged('post_install', '-at_install')
class TestAutomationApi(HttpCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.manager = new_test_user(cls.env, login='auto_api_manager', password='automation_test_password',
                                   groups='sale_margin_approval.group_approver')
        cls.sales = new_test_user(cls.env, login='auto_api_sales', password='automation_test_password',
                                 groups='sales_team.group_sale_salesman')

    def test_auth_role_and_csrf(self):
        self.authenticate(None, None)
        self.assertEqual(self.url_open('/api/automation').status_code, 401)
        self.authenticate('auto_api_sales', 'automation_test_password')
        self.assertEqual(self.url_open('/api/automation').status_code, 403)
        self.authenticate('auto_api_manager', 'automation_test_password')
        overview = self.url_open('/api/automation')
        self.assertEqual(overview.status_code, 200, overview.text)
        self.assertTrue(overview.json()['available'])
        response = self.url_open('/api/automation/policy', data=json.dumps({'enabled': False}),
                                 headers={'Content-Type': 'application/json'})
        self.assertEqual(response.status_code, 403)
        token = self.url_open('/api/auth/session').json()['csrf_token']
        response = self.url_open('/api/automation/policy', data=json.dumps({'enabled': False}),
                                 headers={'Content-Type': 'application/json', 'X-CSRF-Token': token})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertFalse(response.json()['enabled'])
