# Optika Operations

Plateforme de pilotage de distribution optique : **opportunité → devis → contrôle de marge → approbation → livraison → facture → paiement**.

Le projet associe un frontend React à Odoo 17 Community. Sa fonctionnalité centrale est un circuit de dérogation de marge : une remise qui fait passer le taux de marque sous le seuil de la société exige un accord motivé. Une modification commerciale invalide cet accord.

## Découvrir les interfaces sans installer Odoo

Prérequis : Node.js 22.12+ et npm.

```powershell
cd frontend
npm ci
npm run dev
```

Ouvrir **http://127.0.0.1:5173**, puis choisir un rôle dans « Découvrir le projet ». Aucun identifiant n’est nécessaire pour ce mode.

La démonstration utilise des données fictives stockées dans le navigateur. Elle permet de changer de rôle en se déconnectant, tout en conservant les dossiers. « Réinitialiser la démo » restaure les données initiales. Les factures de démonstration n’appliquent aucune taxe : elles illustrent le workflow, sans se substituer aux calculs comptables Odoo. Les limites des deux modes sont décrites dans [l’architecture](docs/architecture.md).

## Interfaces

| Espace | Fonctionnalités |
| --- | --- |
| Cockpit | Facturé HT, montant réglé sur factures, solde TTC, retards, évolution mensuelle et priorités |
| CRM | Pipeline regroupé par probabilité, création d’opportunités, gain/perte, création d’un devis client |
| Devis | Recherche produits, stock, quantités, prix, remise maximale indicative, simulation de marge et justification |
| Commandes | Recherche, pagination, détail, modification du devis, historique et confirmation après accord |
| Approbations | File de demandes, filtres, contexte commercial, comparaison au seuil et décision motivée |
| Logistique | Tableau de mouvements, saisie ou scan du code-barres, quantités réelles et reliquats |
| Achats | Commande fournisseur et suivi des réceptions |
| Finance | Factures, échéances, balance âgée, facturation des commandes et paiements partiels |
| Administration | Seuil par société, responsabilités par rôle et accès à la gestion des comptes Odoo |

## Connexion réelle à Odoo

Prérequis : Docker Desktop démarré, Docker Compose et Node.js. Sauvegarder les bases existantes avant toute mise à jour de modules.

1. Copier `.env.example` vers `.env` et renseigner `DB_PASSWORD`, `ODOO_MASTER_PASSWORD` et `OPTIKA_DB`. Sur un environnement existant, conserver le mot de passe PostgreSQL correspondant au volume en place. Le mot de passe maître ne correspond pas au mot de passe du compte administrateur.
2. Pour une **nouvelle base**, démarrer PostgreSQL puis installer les modules :

```powershell
docker compose up -d db
docker compose run --rm odoo odoo -d optika_demo -i optika_rest_api --without-demo=all --stop-after-init
docker compose up -d odoo
```

Remplacer `optika_demo` si `OPTIKA_DB` a une autre valeur. Odoo est accessible sur **http://localhost:8069**. La configuration temporaire générée au démarrage injecte les secrets et sélectionne cette base. Modifier le mot de passe du compte administrateur lors de la configuration initiale.

Pour une **base existante**, arrêter l’application, mettre les deux modules à jour puis la redémarrer :

```powershell
docker compose stop odoo
docker compose run --rm odoo odoo -d optika_demo -u sale_margin_approval,optika_rest_api --stop-after-init
docker compose up -d odoo
```

Les anciens accords ne possèdent pas l’empreinte commerciale introduite dans cette version. Ils doivent être réexaminés avant de confirmer les devis concernés.

3. Configurer la société, la devise, les taxes, le plan comptable, les journaux bancaires et les produits dans Odoo. Pour illustrer le scénario chiffré, utiliser MAD, un produit vendu 100 avec un coût de 80 et un seuil de 15 %. La politique de facturation par quantités livrées permet de démontrer la livraison et la facturation partielles.
4. Attribuer des groupes distincts aux utilisateurs :

| Profil | Groupes Odoo |
| --- | --- |
| Direction | `Optika : responsable des opérations` |
| Commercial | Ventes : utilisateur, ses documents |
| Logistique | Inventaire : utilisateur ; Achats : utilisateur si nécessaire |
| Finance | Comptabilité : comptable (`account.group_account_user`) |

Le script `python scripts/provision_users.py` peut créer quatre comptes distincts. Il exige les variables d’environnement `ODOO_ADMIN_PASSWORD` et `OPTIKA_USER_PASSWORD` ; il conserve les comptes existants sans modifier leurs permissions. Ne pas publier ces secrets.

5. Démarrer le frontend avec `npm run dev` et se connecter avec un vrai compte. Le proxy Vite transmet `/api` à Odoo sur `127.0.0.1:8069`. Le frontend et l’API partagent ainsi la même origine côté navigateur. Pour un déploiement différent, utiliser `VITE_API_URL` et une liste explicite `OPTIKA_ALLOWED_ORIGINS`.

## Contrôle des marges et sécurité

- Le taux de marque est `(vente HT − coût) / vente HT`. Le frontend fournit une estimation ; Odoo prend la décision finale.
- La demande et la décision vérifient les droits sur le devis. Les états et l’historique ne sont pas librement modifiables via RPC.
- La décision conserve la version et une empreinte des conditions : lignes, coût, taxes, client, société, devise, liste de prix, conditions de paiement et seuil.
- L’accord ne confirme pas automatiquement la commande. Le commercial la confirme après décision ; le serveur recontrôle l’empreinte.
- Les routes utilisent l’identité réelle, les ACL et les règles d’enregistrement Odoo. Les élévations restantes concernent uniquement l’écriture contrôlée de l’historique et du seuil autorisé.
- Les écritures API vérifient un jeton CSRF. Après connexion et rotation du cookie, le client recharge la session pour obtenir un jeton valide. La déconnexion ferme la session serveur.
- Les listes sont paginées et les erreurs métier annulent les écritures partielles via un point de sauvegarde transactionnel.

## Vérifications

Contrôle de syntaxe Python/XML et des fichiers déclarés dans les manifestes, depuis la racine : `python scripts/check_sources.py`. Ce contrôle ne remplace pas l’installation et les tests Odoo.

```powershell
cd frontend
npm test
npm run build
```

Les tests Node couvrent le calcul de marge, les accès de démonstration, les accords, leur invalidation, la livraison partielle, la facturation de la quantité livrée, le paiement partiel et la balance âgée.

Exécuter les tests Odoo sur une **base de test distincte**, avec `OPTIKA_DB=optika_test` dans un environnement de test dédié :

```powershell
docker compose run --rm odoo odoo -d optika_test -i optika_rest_api --without-demo=all --test-enable --test-tags /sale_margin_approval,/optika_rest_api --stop-after-init
```

Les tests serveur couvrent les règles métier, les assistants, les états falsifiés, les droits API, le CSRF, le rollback, la connexion et la déconnexion. Leur exécution nécessite un moteur Docker actif. Le workflow [Checks](.github/workflows/checks.yml) définit les vérifications frontend et Odoo pour GitHub Actions.

## Structure

```text
addons/
  sale_margin_approval/   Modèles, sécurité, assistants et tests métier
  optika_rest_api/        API, groupe opérations et tests HTTP
  sale_margin_automation/ Suivi interne, PDF privés, CSV et journal des exécutions
frontend/src/
  pages/                 Écrans organisés par domaine
  components/            Navigation, composants communs et graphique
  hooks/                 Chargement, erreurs et recherche différée
  services/              Adaptateurs Odoo et démonstration locale
  domain/                Calculs indicatifs et formatage
config/                  Configuration Odoo et injection des secrets
docs/                    Architecture, scénario et présentation portfolio
```

## Présenter le projet

- [Scénario de démonstration](docs/demo-scenario.md)
- [Architecture et limites](docs/architecture.md)
- [Automatisation : configuration, sécurité et tests](docs/AUTOMATION.md)
- [Argumentaire CV et entretien](docs/portfolio.md)

Les anciens scripts `patch_*`, `write_*`, `update_*`, `test_login.py` et `test_rpc.py` sont des scripts historiques de prototypage. Ils ne font pas partie du lancement ou des tests actuels et ne doivent pas être exécutés pour mettre à jour cette version.
