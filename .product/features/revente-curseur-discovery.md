# Feature Discovery : Revente, un curseur d'horizon de 1 à 30 ans

Fiche de backlog : `../backlog/06-revente-curseur.md` (Pierre, 14/09/2026). Périmètre : `apps/web` seulement, aucun changement du moteur.

## Demande

> Pour l'onglet Revente, j'aimerais un curseur de revente entre zéro et trente ans, et que tous les chiffres soient mis à jour en fonction.

## Analyse

- **Aujourd'hui** : l'onglet Revente propose quatre horizons en cartes (5, 10, 15, 20 ans). Cliquer une carte écrit `hypotheses.revente.annees` par `appliquerSaisie` ; tout l'onglet et le Rapport se recalculent. Le moteur borne `revente.annees` de 1 à 30 (`ReventeSchema`), défaut 10.
- **Ce que le curseur apporte** : n'importe quelle année de 1 à 30, d'un geste, avec tous les chiffres qui suivent en direct (valeur, ce qu'il reste en poche, enrichissement, TRI, plus-value et son impôt). Les seuils fiscaux de la plus-value deviennent visibles : abattements dès la 6ᵉ année, plus d'impôt sur le revenu à 22 ans, plus de prélèvements sociaux à 30 ans. C'est la traduction directe de la feuille « NEW - Revente » de l'Excel de Pierre, qui tient la table année par année et lit le taux global d'imposition par l'année choisie.
- **Zéro** : impossible dans le moteur et sans sens (aucune année de loyers, prêt non entamé). Le curseur va de **1** à 30. Décision recommandée par la fiche, appliquée.
- **Les quatre cartes** 5/10/15/20 restent, en bandeau compact sous le curseur : elles montrent la trajectoire d'un coup d'œil et servent de raccourcis (cliquer une carte règle le curseur). Le curseur pilote le détail.
- **Le taux global d'imposition de la plus-value** de l'année choisie s'affiche sous le curseur : impôt sur le revenu × (1 − abattement IR) + prélèvements sociaux × (1 − abattement PS), hors surtaxe (36,2 % jusqu'à 5 ans, 34,8 % à 6 ans… 0 % à 30 ans, comme dans l'Excel). Il est **calculé depuis les règles du moteur** (`abattementsDetention`, `tauxIr`, `prelevementsSociaux.plusValue` de `obtenirRegles(projet.versionRegles)`), jamais recopié : si les règles changent, l'affichage suit. Les seuils 22 et 30 ans sont eux aussi déduits des règles (première année où l'abattement atteint 100 %).
- **Écriture** : pendant le glissement, l'onglet garde un état local et recalcule sans scénarios (≈ 5 ms) ; le projet n'est écrit (validation Zod, stockage local) qu'au relâchement, ou 150 ms après le dernier mouvement. On ne fait pas trente écritures pour un glissement.
- **Accessibilité** : `<input type="range">` natif avec libellé visible, `aria-valuetext` « Dans 12 ans », flèches, Page précédente / suivante, Début / Fin ; cible de 44 px au doigt ; mode document (impression, partage) : le curseur devient le texte « Revente dans 12 ans ».
- **Composant réutilisable** : `Curseur` dans `apps/web/src/composants/Curseur.tsx`, générique (min, max, pas, libellé, formatage de la valeur, repères, seuils, `aria-valuetext`), prévu pour la fiche 04 (négociation du prix : de −15 % à 0 par pas de 0,5 %). Rien de spécifique à la revente dedans.
- **Graphique « en poche selon l'horizon »** (question 3 de la fiche) : écarté en v1. Les quatre cartes montrent déjà la trajectoire ; un graphique de trente calculs ajouterait une charge et du bruit pour peu d'information de plus. Réversible plus tard sans toucher au curseur.

## Stories

| Story | Titre                     | Résumé                                                                                                                                                                                                                                                          |
| ----- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-1  | Composant `Curseur`       | Curseur générique et accessible : libellé, valeur formatée, min / max / pas, repères gradués, seuils signalés sur la piste avec légende, `aria-valuetext`, clavier, `onChangement` à chaque mouvement et `onValidation` au relâchement ; texte en mode document |
| US-2  | Analyses de l'horizon     | `analyses/revente.ts` : bornes 1 à 30 alignées sur le schéma, `projetAHorizon` ; `analyses/plus-value.ts` : taux global d'imposition et abattements de l'année choisie, seuils d'exonération, lus dans les règles                                               |
| US-3  | Onglet Revente au curseur | Curseur en tête d'onglet, chiffres en direct pendant le glissement, écriture au relâchement ou à 150 ms, taux d'imposition sous le curseur, bandeau compact 5/10/15/20, Rapport et impression inchangés ; tests d'écran et parcours e2e                         |
| US-4  | Documentation             | README, CLAUDE.md, registre des features, fiche 06 et tableau du backlog → « livrée », architecture                                                                                                                                                             |

## Périmètre

- **IN** : ce qui précède ; `index.css` (styles du curseur, `pointer-coarse`) ; `e2e/onglets.spec.ts` (parcours Revente).
- **OUT** : `packages/moteur` (aucun changement : bornes, abattements et taux existent) ; le champ « Revente dans » de l'onglet Hypothèses (reste un champ entier) ; graphique par horizon ; curseur de négociation (fiche 04, qui réutilisera `Curseur`) ; Comparer et Méthode (inchangés).

## Contraintes

- Aucun calcul dans l'écran : `calculerProjet` et les fonctions de `analyses/` seulement ; aucun taux recopié.
- Couverture 100 % sur `analyses/` (seuil du projet) ; composant `Curseur` testé (rendu, clavier, validation) ; écran couvert par rendu via `AppEnMemoire`.
- Mobile d'abord, équivalents `print:`, cibles de 44 px et champs de 16 px au doigt (règle des nouveaux écrans, ADR-007) ; le curseur figure déjà dans l'écran « Revente » des formats de référence.
- Français, pas de tiret cadratin, moins de texte que de chiffres.

## Risques

| Risque                                                                           | Mitigation                                                                                                                   |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Trente écritures dans le stockage local pendant un glissement                    | État local pendant le glissement, écriture au relâchement (événement `change`) et à 150 ms après le dernier mouvement        |
| Saccades pendant le glissement (recalcul complet avec scénarios)                 | Recalcul local sans scénarios (≈ 5 ms) ; le recalcul complet ne vient qu'à l'écriture                                        |
| Repères et seuils mal alignés avec le pouce du curseur                           | Pouce de largeur fixe, repères placés dans une bande décalée d'une demi-largeur de pouce ; vérification dans le navigateur   |
| Libellés « 20 » et « 22 » qui se chevauchent sur téléphone                       | Les seuils ne portent pas de libellé sur la piste : une marque, et une légende sous les graduations                          |
| Le parcours e2e « Revente » clique sur « Dans 20 ans »                           | Parcours réécrit : clavier sur le curseur, puis carte « Dans 20 ans » du bandeau                                             |
| Test d'impression e2e : les deux premières grilles du volet Revente à 2 colonnes | Le curseur (texte en mode document) n'ajoute aucune grille ; le bandeau reste la première grille, à deux colonnes sur papier |
| Clavier : appui long sur une flèche = beaucoup de mouvements                     | Clavier → `onChangement` seulement, validation au relâchement de la touche ; l'écran ajoute le délai de 150 ms               |

## Auto-validation critique

- **Curseur natif plutôt qu'un composant maison** : `<input type="range">` donne le clavier, le toucher, le rôle `slider` et `aria-valuetext` sans code ; les styles CSS (`.curseur`) suffisent pour la piste, le pouce et le remplissage. Le clavier est tout de même pris en main par le composant (flèches, Page, Début, Fin) pour un comportement identique dans tous les navigateurs et testable dans jsdom.
- **Écriture différée dans l'écran, pas dans le composant** : `Curseur` reste un composant d'entrée pur (`onChangement`, `onValidation`) ; c'est l'onglet qui sait quoi écrire et quand. La fiche 04 pourra choisir une autre politique.
- **Le taux global sous le curseur est un dérivé de lecture** (deux taux et deux abattements des règles) : il vit dans `analyses/plus-value.ts`, testé contre les valeurs de l'Excel (36,2 % à 5 ans, 34,78 % à 6 ans, 0 % à 30 ans), et non dans le moteur, qui n'a pas besoin de cette notion.
- **Les cartes gardées** : la fiche en faisait une question ; les garder coûte trois lignes et évite de perdre la comparaison rapide que l'onglet offrait. Elles deviennent compactes pour ne pas concurrencer le curseur.

## Definition of Done

- [ ] Gates verts : lint, format, typecheck, tests, couverture 100 % sur `analyses/`, build
- [ ] Curseur vérifié dans le navigateur : glissement, clavier, repères alignés, téléphone (44 px), impression (texte)
- [ ] Parcours e2e Revente mis à jour et vert
- [ ] Docs : `architecture/revente-curseur.md`, registre, README, CLAUDE.md, fiche 06 et tableau du backlog ; PR ouverte et armée en auto-merge
