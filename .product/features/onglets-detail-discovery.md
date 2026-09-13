# Feature Discovery + Specs : Onglets de détail (Fiscalité, Revente, Visite)

## Demande

« Tu peux y aller pour la suite » (Pierre, 13/09/2026) : les trois onglets encore en état « bientôt » deviennent réels.

## Analyse

- **Fiscalité** (`/projets/:id/fiscalite`) : les quatre régimes côte à côte (maquette écran 4), chacun avec son loyer, l'impôt cumulé sur la durée de détention, l'année du premier impôt, une phrase d'explication par règles, les badges `retenu` / `meilleur` / `plafond dépassé`, et un bouton **Retenir ce régime** (qui modifie l'hypothèse comme l'onglet Hypothèses). Puis la frise « Quand commencez-vous à payer ? » et le tableau année par année du régime retenu (recettes, charges déductibles, intérêts, amortissements, base, impôt, cash-flow après impôt).
- **Revente** (`/projets/:id/revente`) : une rangée d'horizons **5 / 10 / 15 / 20 ans** (recalcul du projet à chaque horizon, ~5 ms chacun), cliquables pour changer l'hypothèse de durée de détention ; les deux tableaux de la maquette (« Revente dans N ans » et « Ce que ça vous aura rapporté ») ; le détail de la plus-value (prix de cession, prix majoré, réintégration, abattements, IR, PS, surtaxe).
- **Visite** (`/projets/:id/visite`) : les points de vigilance du moteur, en trois listes cochables (documents à demander, à vérifier sur place, à régler avant l'offre), avec compteur ; rappel des cinq feux ; lien vers Hypothèses pour mettre à jour après la visite.
- **Pourquoi** : c'est ce qui manque pour que le rapport soit « complet jusqu'à la revente et l'impôt sur la plus-value » (positionnement de la spec), et « Préparer la visite » est un différenciateur cité face à Lybox.

## Stories

| Story | Titre              | Gherkin (résumé)                                                                                                                                                                   |
| ----- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-1  | `analyses/revente` | `variantesRevente(projet, [5,10,15,20])` → valeur, cash net, impôt PV, TRI, enrichissement par horizon ; la ligne à 10 ans coïncide avec `resultats.revente`                       |
| US-2  | Textes             | `explicationRegime(r, annees)` : une phrase par régime et par cas (aucun impôt / première année imposable / plafond dépassé) ; `categorieVigilance(code)` pour chacun des 14 codes |
| US-3  | Écran Fiscalité    | 4 cartes, badges, « Retenir ce régime » enregistre `fiscalite.regime` ; frise de N cases ; tableau annuel du régime retenu ; note « PS BIC à confirmer » en meublé                 |
| US-4  | Écran Revente      | horizons cliquables (enregistrent `revente.annees`), deux tableaux, détail de la plus-value ou « pas de plus-value imposable »                                                     |
| US-5  | Écran Visite       | listes cochables par catégorie, compteur, feux, lien Hypothèses ; état des cases local (non persisté)                                                                              |

## Périmètre

- **IN** : ce qui précède ; réutilisation de `appliquerSaisie` pour les deux interactions (régime, horizon).
- **OUT** : persistance des cases cochées, export PDF dédié (l'impression navigateur existe), comparaison inter-projets.

## Auto-validation critique

- Les cases cochées ne sont pas conservées : dit à l'écran (« sur cet écran seulement ») ; à persister quand l'entité projet gagnera des notes.
- Les horizons recalculent quatre projets sans scénarios : ~20 ms, mémoïsés sur le projet.
- Les phrases d'explication sont des règles simples ; elles ne remplacent pas la comparaison chiffrée, qui reste au premier plan.
