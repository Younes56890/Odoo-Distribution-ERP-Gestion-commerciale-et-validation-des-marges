# Suivi automatique des devis et des marges

L’extension `sale_margin_automation` ajoute des traitements internes à Odoo 17. Elle dépend des modules existants `sale_margin_approval` et `optika_rest_api`. Le frontend React continue d’utiliser la session Odoo et le jeton CSRF de l’API existante.

## Choix technique

L’implémentation utilise Python, les modèles Odoo et `ir.cron`. Il s’agit d’automatisation métier native, pas de RPA desktop. Les devis, décisions et rapports sont déjà accessibles par les modèles/API : reproduire les clics avec UiPath ajouterait des dépendances et rendrait les traitements sensibles aux changements d’interface.

UiPath reste pertinent pour une future application externe sans API. Dans ce cas, le robot collecte ou dépose les documents via les API autorisées ; Odoo conserve les permissions, le calcul des marges et la décision humaine. Aucun robot ne doit appeler une approbation en utilisant un compte Manager.

## Composants

| Fichier / modèle | Responsabilité |
| --- | --- |
| `models/automation_policy.py` | Configuration par société, destinataires internes, délai, reprise et compte technique |
| `models/sale_margin_approval.py`, `automation_event.py` | Capture atomique des transitions réelles ; snapshots immuables pour les rapports |
| `models/automation_job.py` | File durable, clé unique, document privé et reprise explicite |
| `models/automation_engine.py` | Détection, activités, rendu PDF standard, CSV, traitement avec savepoints et verrouillage |
| `models/automation_run.py` | Trace immuable de chaque tentative et demande de reprise |
| `models/ir_attachment.py` | Protection des pièces privées et refus des PDF devenus obsolètes, y compris via l’accès Odoo standard |
| `security/`, `data/` | ACL, règles multi-sociétés, compte sans mot de passe et deux tâches inactives à l’installation |
| `controllers/automation.py` | API Manager avec authentification, permissions et CSRF existants |
| `frontend/src/pages/Automation.jsx` | Politique, indicateurs, documents, reprise et journal ; composants et style existants |

Le module d’approbation existant n’est pas remplacé. Ses contrôles côté serveur, son seuil configurable de 15 % par défaut et la séparation entre approbation et confirmation restent applicables.

La validation d’intégration a également corrigé l’enveloppe de connexion de l’API : `Session.authenticate` effectue un commit dans Odoo 17 ; la route de connexion s’exécute donc hors du savepoint métier. Les autres routes conservent leur rollback en cas d’échec. La session et la rotation du cookie restent gérées par Odoo.

## Comportement

Une demande humaine en attente produit une activité interne par approbateur sélectionné. Après le délai configuré (24 heures par défaut), une seule relance est créée pour cette demande/version/destinataire. Une première détection déjà en retard crée directement la relance. Une notification initiale encore en file est abandonnée si la relance est devenue pertinente. Les devis « À soumettre » sont comptés mais jamais soumis par le moteur : leur justification appartient au commercial.

Une approbation humaine peut produire le PDF commercial standard `sale.action_report_saleorder`, puis une activité de suivi pour le commercial du devis. Le moteur vérifie la révision et l’empreinte commerciale sous verrou avant le rendu. Un changement de conditions rend le document inaccessible au téléchargement. Le rapport de décision avec les coûts et les marges reste distinct dans le module existant.

Aucun e-mail n’est envoyé par ces traitements. Les activités sont attachées au document de traitement interne, jamais au fil d’un devis suivi par un client. `mail_activity_quick_update` désactive la notification e-mail à la création. Le module ne confirme aucun devis et ne prend aucune décision.

Les rapports CSV privés utilisent des périodes terminées quotidiennes ou hebdomadaires, dans le fuseau configuré, avec intervalles UTC semi-ouverts `[début, fin[`. La première période peut être partielle à partir de la date de reprise. Un passage rattrape au maximum dix périodes ; le curseur avance après la mise en file. Les tentatives sont exécutées par lots de 50, réglables entre 1 et 200.

Le CSV distingue `pending_at_generation` (attentes actuelles à la génération) et `decision_event_in_period` (approbations, refus et invalidations réellement capturés pendant la période). Il contient les montants, devises, versions, dates UTC et taux de marque en pourcentage. Les cellules textuelles à risque de formule sont neutralisées. Les événements antérieurs à l’installation ne sont pas reconstruits ; une reprise des devis existants ne crée pas un faux historique de décisions.

Les clés uniques SQL empêchent les doublons. Les traitements verrouillent les lignes avec `FOR UPDATE SKIP LOCKED`, revérifient leur état et isolent chaque tentative dans un savepoint. Un échec annule aussi la pièce jointe et l’activité de la tentative. Le résultat et la trace d’échec sont enregistrés ensuite. Trois tentatives avec délais exponentiels de 15, puis 30 minutes par défaut ; un succès n’est jamais réexécuté. Une reprise Manager remet uniquement un échec en file et conserve les anciennes traces. Si le processus ou toute la transaction tombe, les traces non validées peuvent être perdues : les journaux serveur restent nécessaires.

Les erreurs enregistrent leur type et les positions dans la pile, sans copier le message de l’exception ni les données de la requête. Le journal permet d’identifier le fichier et la ligne en cause ; les permissions et destinataires doivent être contrôlés avant une reprise.

## Installation et activation

1. Sauvegarder la base et le filestore selon la procédure habituelle avant une installation sur une base existante.
2. Installer `sale_margin_automation` depuis les Apps Odoo après actualisation de la liste. Le serveur doit avoir accès au dossier `addons` existant. Redémarrer Odoo après l’ajout du code.
3. Se connecter comme approbateur et ouvrir **Suivi automatique** dans React, ou **Ventes → Suivi automatique → Politiques** dans Odoo.
4. Enregistrer une politique, choisir les approbateurs internes et contrôler le délai et les options. La date de reprise, la taille des lots et les limites de tentatives sont aussi configurables dans le formulaire Odoo. Par défaut, seuls les nouveaux événements depuis la création de la politique sont éligibles aux suivis/PDF.
5. Autoriser explicitement les traitements et lancer un lot manuel ; vérifier les documents, activités et journaux.
6. Pour le fonctionnement périodique, un administrateur active séparément les deux actions planifiées **Marges : détecter les suivis internes** (15 minutes) et **Marges : exécuter les suivis internes** (5 minutes). Elles sont inactives à l’installation ; les mises à jour préservent ensuite leur état grâce à `noupdate`.

Le compte `__optika_automation__` n’a aucun mot de passe ni clé API. Il sert aux exécutions internes, avec des droits de lecture sur les devis et approbations. Il ne doit recevoir aucun droit d’écriture commerciale, d’approbation ou d’administration. Ces droits sont vérifiés avant chaque exécution. Pour une autre société, un administrateur doit d’abord lui attribuer explicitement cette société. Les règles multi-sociétés restent appliquées.

L’installation du module et l’activation des tâches sur la base métier ne sont pas effectuées par les tests. Le mode démonstration React indique que la fonctionnalité nécessite une connexion Odoo ; il ne simule pas des exécutions réelles.

## Vérification

```powershell
python scripts/check_sources.py
python scripts/test_automation_rules.py
cd frontend
npm test
npm run build
```

Tests Odoo dans une base temporaire séparée, sans volume métier ni port publié :

```powershell
docker compose -p optika-automation-check -f docker-compose.test.yml run --rm odoo
docker compose -p optika-automation-check -f docker-compose.test.yml run --rm --no-deps odoo python3 /mnt/optika-scripts/check_automation_concurrency.py
docker compose -p optika-automation-check -f docker-compose.test.yml down --volumes
```

Le PostgreSQL de test utilise un stockage temporaire. La suite couvre les droits, l’isolation multi-sociétés, l’idempotence des activités, les notifications tardives, les transitions, les reprises avec rollback, le CSV, l’authentification/CSRF et le PDF réel avec `force_report_rendering`. Le script complémentaire utilise de vraies transactions concurrentes pour vérifier l’exclusion d’un second worker et l’unicité des insertions simultanées. Il est réservé à la base isolée `optika_automation_test`. Les tests métier et API des modules existants sont inclus. La CI exécute également cette extension avec les modules existants.

Validation locale du 17 octobre 2026 : suite Odoo métier/API/automatisation **34/34**, contrôle complémentaire des deux actions planifiées natives **1/1**, contrôle ciblé PDF réel et accès obsolète **1/1**, règles Python **6/6**, tests frontend **10/10**, compilation React réussie et transactions concurrentes validées. Les actions natives ont été exécutées avec le compte technique : un droit sur le moteur abstrait est nécessaire à Odoo pour ses actions serveur ; ce droit ne donne aucune écriture sur les devis ou approbations.
