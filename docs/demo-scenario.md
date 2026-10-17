# Démonstration : une remise exceptionnelle, un parcours contrôlé

## Préparation

Démarrer le frontend, ouvrir `http://127.0.0.1:5173`, choisir **Direction** puis **Réinitialiser la démo**. Les exemples sont fictifs et enregistrés uniquement dans ce navigateur.

## Scénario principal

1. **Cockpit** : présenter la différence entre facturation, montant réglé et solde client. Ouvrir les priorités.
2. **Commercial** : se déconnecter puis choisir Commercial. Ouvrir Nouveau devis, sélectionner Optique Atlas et ajouter Monture Aurora.
3. Saisir 10 unités, un prix de 100 MAD et une remise de 10 %. Le montant HT est 900 MAD, le coût 800 MAD, la marge 100 MAD et le taux de marque environ 11,1 %, sous le seuil de 15 %.
4. Justifier « Première commande pour un partenariat annuel » et demander l’approbation. Montrer le devis en attente et son historique.
5. **Direction** : se déconnecter puis choisir Direction. Examiner la demande, consulter les lignes et approuver avec un motif. Montrer que l’accord ne confirme pas automatiquement la commande.
6. **Invalidation** : ouvrir le devis et modifier la remise à 12 %. Enregistrer le brouillon. Montrer l’accord invalidé dans l’historique, puis demander un nouvel accord avec justification.
7. Approuver de nouveau, puis ouvrir le devis et confirmer la commande.
8. **Logistique** : changer de rôle. Ouvrir la livraison correspondante, saisir 4 unités préparées sur 10, confirmer le reliquat et valider. Montrer le reliquat de 6 unités. Le scan de démonstration de Monture Aurora est `6110000000011`.
9. **Finance** : changer de rôle, ouvrir Commandes à facturer, créer la facture. La facturation concerne les 4 unités livrées. Enregistrer un paiement partiel, puis montrer le solde restant.
10. **Cockpit** : revenir en Direction et montrer la mise à jour des montants.

## Version vidéo de 90 secondes

- 0–10 s : besoin métier et cockpit.
- 10–35 s : devis à faible marge et demande motivée.
- 35–55 s : décision et invalidation après modification.
- 55–75 s : livraison partielle et reliquat.
- 75–90 s : facture, paiement partiel et résumé de l’architecture.

Présenter ce parcours comme une démonstration locale tant que les tests d’intégration Odoo n’ont pas été exécutés. Pour filmer le mode connecté, configurer d’abord les données, la comptabilité et les droits dans une base de démonstration distincte.
