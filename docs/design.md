# Refonte visuelle d’Optika Operations

## Direction retenue

Une interface de travail sobre, inspirée des documents commerciaux : fond clair, encre charbon, accents sauge pour les données et états positifs. Les couleurs des alertes restent sémantiques. Le produit conserve ses pages, ses permissions, son API et ses parcours métier.

Compétences installées depuis le dépôt [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) : `taste-skill`, `redesign-skill` et `minimalist-skill`. Leurs instructions seront découvertes automatiquement au prochain tour. Le skill Taste principal vise les pages publiques ; cette application utilise les recommandations Redesign et Minimalist destinées aux interfaces existantes.

## Audit et changements

| Point observé | Changement |
| --- | --- |
| Police système et nombreux petits libellés | Manrope Variable pour l’interface, Instrument Serif pour les grands titres ; textes secondaires plus lisibles |
| Barre latérale sombre et contraste visuel fort | Navigation claire, sélection sauge et option de réduction en rail avec infobulles au survol et au clavier |
| Navigation horizontale sur petit écran | Menu dans un dialogue latéral natif avec gestion du focus, fermeture par Échap et retour au contenu |
| Indicateurs présentés comme des cartes identiques | Bandeau financier continu, chiffres tabulaires et hiérarchie plus nette |
| Graphique avec dégradé | Histogramme plat et légende explicite |
| Zone décorative de connexion | Exemple de devis issu du jeu de démonstration, identifié comme tel |
| Nombreux chargements avec spinner | Squelettes de structure pour les ressources |
| Navigation uniquement par menu | Recherche des espaces autorisés avec `Ctrl+K` ou `Cmd+K` |
| Icônes de styles génériques | Famille Phosphor avec un poids uniforme ; marque et favicon Optika dessinés en SVG |

Les fontes sont servies par le projet, sans requête à un service de polices externe. Aucun chiffre de croissance, avis client ou indicateur de performance n’a été inventé pour la refonte.

## Comportement responsive prévu

| Largeur | Comportement |
| --- | --- |
| Grand écran | Navigation développée ou rail au choix, indicateurs sur quatre colonnes, graphique et priorités côte à côte |
| Tablette | Indicateurs sur deux colonnes, panneaux superposés, devis et résumé empilés |
| Téléphone jusqu’à 760 px | Navigation dans un drawer, actions tactiles agrandies, formulaires réorganisés, tableaux avec défilement horizontal interne |
| Petit téléphone jusqu’à 440 px | Pipeline sur une colonne et mise en page plus compacte |
| Très petit écran jusqu’à 360 px | Catalogue sur une colonne et barre supérieure simplifiée |

Les dialogues ont une hauteur maximale liée au viewport, les grilles utilisent `minmax(0, 1fr)`, et les mouvements d’entrée respectent `prefers-reduced-motion`.

## Vérification

La compilation et les tests métier locaux se lancent avec `npm run build` et `npm test` dans `frontend`. La disponibilité d’un navigateur a été contrôlée : aucun navigateur n’était exposé à l’outil de contrôle UI pendant cette intervention. Il n’y a donc ni captures vérifiées ni validation visuelle sur appareil ; les comportements ci-dessus décrivent le code implémenté, à confirmer en ouvrant la démonstration aux différentes largeurs.
