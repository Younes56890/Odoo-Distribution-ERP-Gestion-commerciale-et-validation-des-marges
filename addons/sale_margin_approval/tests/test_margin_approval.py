from odoo.tests.common import TransactionCase
from odoo.exceptions import AccessError, UserError
from odoo import fields


class TestMarginApproval(TransactionCase):
    """Tests metier du module sale_margin_approval."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        # Societe avec seuil a 15%
        cls.company = cls.env.company
        cls.company.margin_approval_threshold = 15.0
        cls.company.email = 'company@test.com'

        # Produit de test avec cout standard = 80 MAD
        cls.product = cls.env['product.product'].create({
            'name': 'Monture Test',
            'type': 'product',
            'list_price': 100.0,
            'standard_price': 80.0,
        })

        # Commercial
        cls.commercial = cls.env['res.users'].create({
            'name': 'Commercial Test',
            'login': 'commercial_test@test.com', 'email': 'commercial_test@test.com',
            'groups_id': [(4, cls.env.ref('sales_team.group_sale_salesman').id)],
        })

        # Responsable (approbateur)
        cls.manager = cls.env['res.users'].create({
            'name': 'Manager Test',
            'login': 'manager_test@test.com', 'email': 'manager_test@test.com',
            'groups_id': [
                (4, cls.env.ref('sales_team.group_sale_manager').id),
                (4, cls.env.ref('sale_margin_approval.group_approver').id),
            ],
        })

        # Client de test
        cls.partner = cls.env['res.partner'].create({'name': 'Client Test'})

    def _create_order(self, price_unit=100.0, discount=0.0, qty=10.0):
        """Helper : cree un devis avec une ligne."""
        order = self.env['sale.order'].with_user(self.commercial).create({
            'partner_id': self.partner.id,
            'order_line': [(0, 0, {
                'product_id': self.product.id,
                'product_uom_qty': qty,
                'price_unit': price_unit,
                'discount': discount,
                'purchase_price': self.product.standard_price,
            })],
        })
        return order

    # ------------------------------------------------------------------
    # Test 1 : marge superieure au seuil -> confirmation directe
    # ------------------------------------------------------------------
    def test_01_above_threshold_direct_confirm(self):
        """Marge 20% >= seuil 15% : confirmation autorisee sans approbation."""
        order = self._create_order(price_unit=100.0, discount=0.0)
        # marge = (1000 - 800) / 1000 = 20%
        self.assertFalse(order.margin_approval_required)
        order.with_user(self.commercial).action_confirm()
        self.assertEqual(order.state, 'sale')

    # ------------------------------------------------------------------
    # Test 2 : marge exactement au seuil -> confirmation autorisee
    # ------------------------------------------------------------------
    def test_02_at_threshold_direct_confirm(self):
        """Marge exactement a 15% : confirmation autorisee."""
        # Pour 15% : price = 80 / (1 - 0.15) = 94.12
        # Simplement : cout 80, vente 94.12 -> margin = 14.12/94.12 ~ 15%
        # On pose : vente 100, remise = 1 - 80/(100*0.85) -> simplifie
        # marge = (100 - 80)/100 = 20% sans remise
        # Pour avoir 15% : price_unit=100, discount=~5.88% -> trop complexe
        # Approche simple : cout 85, vente 100 -> margin = 15%
        product = self.product
        product.standard_price = 85.0
        order = self._create_order(price_unit=100.0, discount=0.0)
        self.assertAlmostEqual(order.margin_percent, 0.15, delta=0.01)
        self.assertFalse(order.margin_approval_required)
        order.action_confirm()
        self.assertEqual(order.state, 'sale')
        product.standard_price = 80.0  # reset

    # ------------------------------------------------------------------
    # Test 3 : marge < seuil sans accord -> confirmation bloquee
    # ------------------------------------------------------------------
    def test_03_below_threshold_blocks_confirm(self):
        """Marge 11% < seuil 15% : confirmation refusee sans approbation."""
        order = self._create_order(price_unit=100.0, discount=10.0)
        # montant HT = 900, cout = 800, marge = 100, taux = 11.11%
        self.assertTrue(order.margin_approval_required)
        with self.assertRaises(UserError):
            order.with_user(self.commercial).action_confirm()

    # ------------------------------------------------------------------
    # Test 4 : accord donne par responsable -> confirmation autorisee
    # ------------------------------------------------------------------
    def test_04_approved_allows_confirm(self):
        """Marge < seuil, approbation accordee : confirmation autorisee."""
        order = self._create_order(price_unit=100.0, discount=10.0)
        # Soumettre la demande
        order.with_user(self.commercial)._do_request_approval(
            justification='Client strategique, accord exceptionnel'
        )
        self.assertEqual(order.margin_approval_state, 'waiting')
        # Approbation par le manager
        order.with_user(self.manager)._do_decide('approved', 'Accorde pour fidelisation client')
        self.assertEqual(order.margin_approval_state, 'approved')
        # Confirmation doit reussir
        order.with_user(self.commercial).action_confirm()
        self.assertEqual(order.state, 'sale')

    # ------------------------------------------------------------------
    # Test 5 : accord tente par commercial -> erreur serveur
    # ------------------------------------------------------------------
    def test_05_commercial_cannot_approve(self):
        """Un commercial ne peut pas approuver : erreur AccessError."""
        order = self._create_order(price_unit=100.0, discount=10.0)
        order.with_user(self.commercial)._do_request_approval(
            justification='Demande test'
        )
        with self.assertRaises(AccessError):
            order.with_user(self.commercial)._check_can_decide()

    # ------------------------------------------------------------------
    # Test 6 : modification d une ligne apres accord -> accord invalide
    # ------------------------------------------------------------------
    def test_06_line_modification_invalidates_approval(self):
        """Modifier une ligne apres approbation remet l etat a to_request."""
        order = self._create_order(price_unit=100.0, discount=10.0)
        order._do_request_approval(justification='Test invalidation')
        order.with_user(self.manager)._do_decide('approved', 'Accorde')
        self.assertEqual(order.margin_approval_state, 'approved')
        # Modifier le prix sur la ligne
        order.order_line[0].price_unit = 95.0
        self.assertEqual(order.margin_approval_state, 'to_request')

    # ------------------------------------------------------------------
    # Test 7 : duplication ne reutilise pas l approbation
    # ------------------------------------------------------------------
    def test_07_duplicate_resets_approval(self):
        """Un devis duplique repart a no_required, sans approbation heritee."""
        order = self._create_order(price_unit=100.0, discount=10.0)
        order._do_request_approval(justification='Test duplication')
        order.with_user(self.manager)._do_decide('approved', 'Accorde')
        copy = order.copy()
        self.assertEqual(copy.margin_approval_state, 'no_required')
        self.assertFalse(copy.margin_approval_ids)

    # ------------------------------------------------------------------
    # Test 8 : devis vide -> message clair
    # ------------------------------------------------------------------
    def test_08_empty_order_raises_error(self):
        """Un devis vide ne peut pas etre soumis a approbation."""
        order = self.env['sale.order'].create({'partner_id': self.partner.id})
        with self.assertRaises(UserError):
            order._check_can_request_approval()

    # ------------------------------------------------------------------
    # Test 9 : refus conserve, confirmation bloquee
    # ------------------------------------------------------------------
    def test_09_refused_blocks_confirm(self):
        """Une demande refusee bloque toujours la confirmation."""
        order = self._create_order(price_unit=100.0, discount=10.0)
        order._do_request_approval(justification='Demande test refus')
        order.with_user(self.manager)._do_decide('refused', 'Marge insuffisante pour justifier l exception')
        self.assertEqual(order.margin_approval_state, 'refused')
        with self.assertRaises(UserError):
            order.with_user(self.commercial).action_confirm()
