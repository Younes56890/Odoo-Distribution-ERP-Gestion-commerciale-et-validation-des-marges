# Présentation CV et entretien

## Proposition de description

**Optika Operations — application de distribution optique avec React et Odoo 17**

Conception d’un parcours commercial intégrant CRM, devis, contrôle de marge, approbation, livraison et facturation. Développement d’interfaces par rôle, d’un circuit de dérogation avec historique protégé et invalidation après modification, d’une API de session avec contrôles d’accès et d’une démonstration interactive locale. Configuration Docker et vérifications automatisées frontend et serveur.

Avant de publier cette description, distinguer les fonctions démontrées localement de celles vérifiées sur Odoo. Ne revendiquer des tests serveur réussis qu’après leur exécution effective.

## Ce que montrer à un recruteur

| Élément | Preuve concrète |
| --- | --- |
| Compréhension métier | Une remise exceptionnelle bloque la confirmation et nécessite une décision justifiée |
| Développement frontend | Pages par domaine, composants communs, états de chargement/erreur, recherche et pagination |
| Développement Odoo | Modèles hérités, calculs, assistants, ACL, règles et tests |
| Intégration | Contrat API homogène, session personnelle, CSRF et rollback des erreurs métier |
| Qualité | Scénarios d’accès interdit, accord falsifié, accord invalidé et livraison partielle |
| Communication | Schéma d’architecture, limites explicites, lancement reproductible et vidéo courte |

## Questions d’entretien à préparer

1. Pourquoi distinguer approbation et confirmation de commande ?
2. Pourquoi un accord doit-il porter sur les conditions précises du devis ?
3. Pourquoi les permissions du menu ne suffisent-elles pas à protéger une API ?
4. Comment éviter de conserver une commande partiellement créée après une erreur ?
5. Quelle différence entre montant facturé, solde client et flux bancaire ?
6. Pourquoi les tests de démonstration ne remplacent-ils pas les tests d’intégration Odoo ?
7. Comment gérer plusieurs devises, des lots et un catalogue plus volumineux ?

## Mesures à collecter avant publication

Noter les résultats réellement obtenus : nombre de tests réussis par environnement, taille du bundle, temps d’installation sur une machine neuve et temps de réponse API sur un jeu de données décrit. Éviter les gains de productivité ou pourcentages de performance non mesurés.

Captures utiles : cockpit, devis sous seuil, décision motivée, historique invalidé et livraison partielle. Ajouter ensuite le lien du dépôt et celui de la démonstration publiée, quand ils existent.
