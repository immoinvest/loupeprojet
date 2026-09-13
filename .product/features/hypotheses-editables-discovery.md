# Feature Discovery + Specs : Hypothèses éditables (`/projets/:id/hypotheses`)

## Demande

Suite logique validée par Pierre (« let's go ») : modifier un projet existant, avec recalcul instantané du rapport.

## Analyse

- **Quoi** : l'onglet **Hypothèses** d'un projet. Toutes les valeurs qui alimentent le moteur, groupées comme la maquette « Vérifier » (le bien, le marché, le financement, la location, les charges, la fiscalité, la revente, vous), chacune avec son badge de provenance (`annonce`, `donnée publique`, `estimé`, `à toi`). Chaque modification valide le projet (Zod), l'enregistre et recalcule ; une barre de synthèse en tête montre l'effet immédiat (cash-flow, rendement net, TRI, effort).
- **Pourquoi** : c'est le cœur de la promesse « tout est modifiable, ça recalcule à la volée ». Et le bloc **Marché** saisissable (médiane €/m², quartiles, nombre de ventes) rend le feu « prix » utile dès maintenant sur un vrai projet.
- **Où** : `apps/web/src/hypotheses/` (chemins, conversion, descripteurs), écran `Hypotheses`, contexte projets (`mettreAJour`).

## Stories

| Story | Titre                        | Gherkin (résumé)                                                                                                                                                                                                                                                                                                                        |
| ----- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-1  | `hypotheses/chemins`         | `lireChemin(obj, 'hypotheses.pret.tauxNominal')`, `ecrireChemin` immuable (crée les objets intermédiaires, `undefined` supprime la clé)                                                                                                                                                                                                 |
| US-2  | `hypotheses/conversion`      | types `euros`, `nombre`, `entier`, `pourcent` (0,0335 ↔ « 3,35 »), `bool`, `enum` ; texte vide → `undefined` ; texte illisible → erreur                                                                                                                                                                                                 |
| US-3  | `hypotheses/descripteurs`    | liste ordonnée des champs par groupe : chemin, libellé, type, unité, options, `obligatoire`, `visibleSi` (courte durée) ; clé de provenance = chemin sans `hypotheses.`                                                                                                                                                                 |
| US-4  | `ProjetsContext.mettreAJour` | `(id, projetEntree) → { ok: true } \| { ok: false, erreurs }` via `ProjetSchema.safeParse` ; enregistre et met à jour `modifieLe`                                                                                                                                                                                                       |
| US-5  | Écran Hypothèses             | synthèse 4 KPI en tête ; groupes de champs ; saisie → conversion → écriture → validation → enregistrement ; erreur affichée sous le champ fautif sans perdre la saisie ; passage en courte durée initialise nuitée et occupation ; saisie d'une médiane DVF initialise le bloc marché ; provenance `utilisateur` sur tout champ modifié |

## Périmètre

- **IN** : ce qui précède ; différés de prêt ; marché saisi à la main ; DPE, ascenseur, année.
- **OUT** : historique/annulation, comparaison, import automatique du marché (feature `enrichissement-marche`), édition du nom/statut (déjà dans l'en-tête pour le statut).

## Auto-validation critique

- Recalcul à chaque frappe : `calculerProjet` complet (~35 ms) par changement, acceptable ; à surveiller sur mobile.
- Une valeur invalide n'est jamais enregistrée : l'utilisateur voit l'erreur, la dernière valeur valide reste en vigueur.
- Les pourcentages sont saisis en « 3,35 » et stockés en 0,0335 : la conversion est testée dans les deux sens.
