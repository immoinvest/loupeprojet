# 24 — Onglet Hypothèses : les mêmes commandes que le formulaire Vérifier

Statut : `livrée` (feature `hypotheses-commandes`, 15/09/2026) · Notée le 15/09/2026 · Dépend de : 13 et 20 (livrées, PR #81), 17 (livrée, PR #89), 19 (livrée, PR #85) · Taille : une session (web seul)

Documents : [discovery](../features/hypotheses-commandes-discovery.md) · [specs](../specs/hypotheses-commandes-specs.md) · [architecture](../architecture/hypotheses-commandes.md)

## La demande de Pierre

> Je veux que les hypothèses soient aussi simples à changer que lorsque je crée un nouveau projet, avec la même interface.

## Ce qui existait (master 4325ac6)

- **Formulaire Vérifier** (fiche 13, PR #81) : commandes dans `apps/web/src/composants/saisie/` — `Compteur` (+ `pas.ts`, `pasAdaptatif`), `Tuiles`, `EchelleEnergie` (+ `energie.ts`), `ChampMontant` (+ `montant.ts`), `Combobox`, `ChampCommune`, `ChampAdresse`. Aiguillage par champ dans `ecrans/formulaire/Commande.tsx` et `Commandes.tsx` (`Montant`, `OuiNonChamp`, `CompteurChamp`), choix composés `ChoixAnnee`, `ChoixApport`, `ChoixDuree`, `ChoixLoyer`, `ChoixTravaux`, enveloppe `ecrans/formulaire/Champ.tsx` (libellé, badge, ⓘ, erreur, indication). **Cet aiguillage était lié aux clés du formulaire** (`Item` de `@/verifier/items`, `Cle` de `valeurs.ts`, `ContexteFormulaire`).
- **Onglet Hypothèses** : champs décrits par `Descripteur` (`apps/web/src/hypotheses/types.ts`), groupes `groupes-bien.ts`, `groupes-location.ts`, `groupes-finances.ts`, rendus par `ecrans/hypotheses/GrilleHypotheses.tsx` → `ChampHypothese.tsx` : **toujours un `<input>` texte ou un `<select>` natif**. Écriture par `appliquerSaisie`.
- `GrilleHypotheses` sert aussi à l'onglet Financement ; `ChampHypothese` sert aussi au simulateur de prêt, à `AnalyseIncomplete`, à la tranche supposée de Fiscalité et aux questions de visite à valeur.

## Ce qui a changé pour l'utilisateur

Dans Hypothèses et Financement, chaque champ utilise **la même commande que dans Vérifier** :

| Nature du champ                                                               | Commande                                            |
| ----------------------------------------------------------------------------- | --------------------------------------------------- |
| Montants (prix, loyers, charges, taxe foncière, travaux, mobilier, frais)     | `ChampMontant` : « 155 000 », pavé numérique, unité |
| Nombres entiers (pièces, chambres, étage « RDC », lots, chambres louées)      | `Compteur` − / +                                    |
| Oui / non (ascenseur, balcon, copro en procédure, meublé de tourisme classé…) | `Tuiles` Oui / Non (effaçables)                     |
| Choix courts (état, tranche d'imposition, régime)                             | `Tuiles`                                            |
| DPE                                                                           | `EchelleEnergie`                                    |
| Année de construction                                                         | périodes ou année exacte                            |
| Durée du prêt                                                                 | tuiles 15 · 20 · 25 ans · Autre                     |
| Apport                                                                        | tuiles 0 · 10 · 20 % · Autre + montant              |
| Nuits louées par mois                                                         | curseur avec taux d'occupation                      |
| Taux (nominal, assurance, vacance, gestion, évolution du prix…)               | saisie texte (négatif et centièmes acceptés)        |

Rien ne change dans les calculs ni dans les projets enregistrés. Mode document : valeur lisible, aucune commande.

## Décisions appliquées

- Taux : saisie texte (pas de curseur) ; seule la négociation garde son curseur (`CarteAchat`).
- Loyer : montant seul (« Estimer le loyer » dépend du contexte du formulaire ; le loyer de marché reste dans Estimation et le bandeau « Il manque le loyer »).
- Commune et adresse : non concernées.
- Pas de repli « strict minimum » dans Hypothèses : l'onglet reste la liste complète.
- Apport « 10 % » dans Hypothèses : écrit le montant arrondi à la centaine (pas de provenance « estimé » hors formulaire).
- Boutons des compteurs nommés « Un de moins » / « Un de plus » (le libellé du champ n'y est pas repris, pour que chercher un champ par son libellé trouve la saisie).
