# 06 — Revente : un curseur d'horizon de 1 à 30 ans

Statut : `livrée` (branche `feat/revente-curseur`, 14/09/2026) · Notée le 14/09/2026 · Dépend de : rien

## Livraison

Discovery `../features/revente-curseur-discovery.md`, specs `../specs/revente-curseur-specs.md`, architecture `../architecture/revente-curseur.md`, état `../pipeline/revente-curseur.json`. Décisions prises : curseur de **1** à 30 ans (zéro impossible), les quatre cartes 5/10/15/20 gardées en bandeau compact, pas de graphique en v1, taux global d'imposition de l'année choisie affiché sous le curseur et calculé depuis les règles du moteur, seuils 22 et 30 ans déduits des règles. Le composant `Curseur` (`apps/web/src/composants/Curseur.tsx`) est générique : la fiche 04 (négociation) le réutilise tel quel.

## La demande de Pierre

> Pour l'onglet Revente, j'aimerais un curseur de revente entre zéro et trente ans, et que tous les chiffres soient mis à jour en fonction.

## Ce qui existe aujourd'hui

- L'onglet Revente (`apps/web/src/ecrans/Revente.tsx`) propose **quatre horizons** en cartes cliquables (5, 10, 15, 20 ans : `HORIZONS`, `apps/web/src/analyses/revente.ts`), calculées en parallèle par `variantesRevente` (~5 ms par horizon). Cliquer écrit `hypotheses.revente.annees` par `appliquerSaisie` ; tout l'onglet (valeur, frais, CRD, IRA, plus-value, enrichissement, TRI) et le Rapport se recalculent.
- Le moteur borne `revente.annees` de **1 à 30** (`ReventeSchema`, `packages/moteur/src/schema/hypotheses.ts`, défaut 10). Zéro n'a pas de sens : aucune année de loyers, prêt non entamé.
- Dans Hypothèses, « Revente dans » est un champ entier de la carte « La fiscalité et la revente ».
- Les seuils fiscaux de la plus-value dépendent de la durée : abattements IR dès la 6ᵉ année (exonération à 22 ans), PS jusqu'à 30 ans ; réintégration des amortissements en LMNP réel. Un curseur les rend visibles d'un geste.
- L'Excel de Pierre (feuille « NEW - Revente ») tient exactement cette table **année par année de 1 à 30** (abattement IR, abattement PS, taux global d'imposition de la plus-value : 36,2 % jusqu'à 5 ans, 34,78 % à 6 ans… 0 % à 30 ans) et lit le taux par l'année de détention choisie : le curseur en est la traduction directe. Afficher le taux global de l'année sous le curseur serait fidèle à son usage.

## Ce que ça changerait pour l'utilisateur

- Un curseur « Revente dans **12 ans** » en tête d'onglet ; en le déplaçant, tous les chiffres suivent en direct : valeur, ce qu'il reste en poche, enrichissement, TRI, plus-value et son impôt.
- Des repères sur la piste : 5 · 10 · 15 · 20 · 25 · 30, et les seuils 22 ans (plus d'IR) et 30 ans (plus de PS) signalés.
- Le Rapport et l'impression reprennent l'horizon choisi, comme aujourd'hui.

## Questions ouvertes

1. **Zéro** : impossible dans le moteur. Curseur de **1** à 30 — d'accord ? (« 0 » pourrait vouloir dire « je ne revends pas », mais le TRI et l'enrichissement supposent une sortie ; à écarter en v1.)
2. **Garder les quatre cartes** 5/10/15/20 comme comparaison rapide sous le curseur, ou les remplacer ? Proposition : les garder en bandeau compact (elles montrent la trajectoire), le curseur pilote le détail.
3. Un **graphique** « en poche selon l'horizon » (1 à 30 ans, Recharts) sous le curseur : utile ou surcharge ? Il coûterait 30 calculs (~150 ms), à mémoïser.

## Pistes techniques et impact

- **Web seulement** : `<input type="range" min=1 max=30 step=1>` accessible (`aria-valuetext="Dans 12 ans"`, flèches du clavier), état local pendant le glissement, `mettreAJour` au relâchement (ou dégommé à 150 ms) pour ne pas écrire 30 fois dans le stockage local ; `variantesRevente` inchangé ; `ModeDocument` (impression) : curseur remplacé par le texte.
- Composant `Curseur` réutilisable par la fiche 04 (négociation) : à écrire une fois dans `composants/ui.tsx` ou `composants/Curseur.tsx`.
- Tests : `apps/web/tests` de l'onglet Revente, parcours e2e « Revente » (`apps/web/e2e`) qui clique aujourd'hui sur « Dans 15 ans ».
- Aucun impact moteur, aucun appel réseau. Une demi-journée.
