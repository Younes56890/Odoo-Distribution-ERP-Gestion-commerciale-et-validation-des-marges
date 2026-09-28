import codecs
content = """# Suivi d'implémentation - Optika ERP (Lot 0 et 1)

- [x] **1. Backend Odoo (API REST)**
  - [x] Ajouter les routes `/api/customers` (GET, POST)
  - [x] Modifier `/api/orders` (POST) pour inclure `partner_id` et l'action (brouillon / soumettre)
  - [x] Ajouter `/api/orders/<id>` pour le détail d'un devis
- [x] **2. Frontend React (Services)**
  - [x] Ajouter `getCustomers()`, `createCustomer()`
  - [x] Mettre à jour `createOrder()`
  - [x] Ajouter `getOrderDetails()`
- [x] **3. Frontend React (Interface)**
  - [x] Composant de sélection / création de client
  - [x] Onglet "Mes Devis" (Liste des devis)
  - [x] Modification du panier (boutons Enregistrer vs Soumettre)
"""
with codecs.open('C:/Users/PC/.gemini/antigravity/brain/ac0cf3ac-0f87-49c4-aa1f-d3e689586e4a/task.md', 'w', 'utf-8') as f:
    f.write(content)
