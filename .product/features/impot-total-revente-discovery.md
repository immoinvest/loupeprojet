# Feature Discovery : Fiscalité, impôt total par régime (exploitation + revente)

Fiche de backlog : `../backlog/16-fiscalite-impot-total-revente.md` (Pierre, 14/09/2026). Session de nuit S4 du 15/09/2026, après la fusion de `feat/audit-calculs`.

## Demande

> Sur l'onglet Fiscalité, quand on calcule l'imposition, je veux aussi comprendre l'imposition à la revente en fonction du régime. Il y a l'impôt que je paye pendant l'exploitation et l'impôt à la revente, ce qui fait un impôt total à la fin, surtout quand il y a de l'amortissement. Ça change la donne.

## Analyse

- **Aujourd'hui** : `calculerFiscalite` projette les quatre régimes ; `ResultatRegime.impotTotal` ne compte que l'exploitation. `calculerRevente` calcule la plus-value **une fois**, pour le régime retenu (`amortissementsAReintegrer(fiscalite)` rend les amortissements de l'immeuble seulement si le LMNP réel est retenu). L'onglet Fiscalité ne dit rien de la revente.
- **Conséquence** : le meublé au réel paraît imbattable (peu ou pas d'impôt pendant la location), alors que depuis le 15/02/2025 ses amortissements de l'immeuble **augmentent la plus-value imposable** à la revente. La comparaison est incomplète.
- **Ce qui change** : chaque régime porte sa propre revente (même valeur, mêmes frais, même capital restant dû ; seule la réintégration diffère), donc un impôt à la revente, un impôt total et « ce qu'il vous reste au total » (cash-flow après impôt cumulé + cash net de revente). Un régime est désigné « le plus avantageux au total ».
- **Non-régression** : `Resultats.revente` reste la revente du régime retenu, identique au centime ; le TRI et l'enrichissement ne bougent pas.
- **Horizon** : celui de l'onglet Revente (`hypotheses.revente.annees`, curseur 1 à 30 ans), rappelé sur l'onglet avec un lien vers Revente.

## Décisions sur les questions ouvertes (propositions de la fiche appliquées)

1. **« Le plus avantageux au total »** = le régime qui laisse le plus d'argent à la fin (cash-flow après impôt cumulé + cash net de revente), parmi les régimes compatibles et éligibles ; égalité → premier dans l'ordre du moteur.
2. **« Meilleur cash-flow » gardé** : les deux pastilles s'affichent ; quand c'est le même régime, les deux pastilles sont sur la même carte.
3. **Résidences services** (exclues de la réintégration) : hors v1, mentionnées dans l'explication du meublé au réel.
4. **Déficit foncier** : `nu-reel.ts` ne calcule pas la reprise. Avertissement sur la carte du nu au réel quand un déficit imputé sur le revenu global l'année A est suivi d'une revente avant la fin de la 3ᵉ année qui suit (horizon < A + 3).
5. **Comparer** : un indicateur « Impôt total (exploitation + revente) » du régime retenu. Le Rapport n'est pas touché (hors du périmètre de la session S4).
6. **LMP** : hors périmètre, comme aujourd'hui (la fiche ne formule pas de proposition).

## Écart avec la fiche

- **Graphique empilé sans Recharts** : la fiche dit « Recharts, déjà dans la pile », mais la bibliothèque n'est pas installée dans `apps/web`. Deux barres par régime en HTML/CSS (largeur proportionnelle à l'impôt le plus élevé) donnent la même lecture, s'impriment sans effort et ne pèsent rien. Ajouter ~100 Ko de bibliothèque pour quatre barres n'est pas justifié ; réversible.

## Stories

| Story | Titre                                | Résumé                                                                                                                                                                                                            |
| ----- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-1  | Moteur : revente et bilan par régime | `amortissementsAReintegrer(fiscalite, regime)`, `reventeParRegime`, `ResultatRegime.{revente, impotRevente, impotGlobal, enrichissementFinal}`, `ResultatFiscalite.meilleurAuTotal`, schéma Zod, cas de référence |
| US-2  | Cartes des régimes                   | Trois lignes (pendant N ans, à la revente dont réintégration, impôt total), « ce qu'il vous reste au total », pastille « le plus avantageux au total », explications, avertissement déficit foncier               |
| US-3  | Graphique, tableau de revente, frise | Barres empilées par régime (version texte), tableau « La revente selon le régime », case « revente » de la frise, rappel de l'horizon et lien « Changer »                                                         |
| US-4  | Comparer et Méthode                  | Indicateur « Impôt total (exploitation + revente) », paragraphe Méthode                                                                                                                                           |
| US-5  | Documentation                        | Architecture, registre, README, CLAUDE.md, fiche 16 → « livrée »                                                                                                                                                  |

## Périmètre

- **IN** : `packages/moteur/src/{revente,fiscalite}/`, `calculer-base.ts`, `schema/resultats.ts`, tests moteur ; `apps/web/src/ecrans/Fiscalite.tsx` et `ecrans/fiscalite/`, `textes/regimes.ts`, `textes/methode-fiscalite.ts`, `analyses/comparaison.ts`, tests web et e2e Fiscalité.
- **OUT** : onglet Revente (inchangé), Rapport, barème de travaux (S5), liens vers les hypothèses (S9), reprise chiffrée du déficit foncier, LMP, résidences services.

## Contraintes

- Aucun taux inventé : tout vient de `regles/2026-09.ts` (abattements, IR 19 %, PS 17,2 %, surtaxe). Aucune règle nouvelle n'est nécessaire.
- `packages/moteur` 100 % lignes et branches ; `textes/` et `analyses/` 100 %.
- Libellé factuel, jamais une recommandation (« laisse le plus d'argent au total avec ces hypothèses »).
- Mobile d'abord, équivalents `print:`, recettes `survol-*`.

## Risques

| Risque                                              | Mitigation                                                                                                                                            |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Un chiffre fiscal faux                              | Cas de référence recalculés à la main dans le test ; la plus-value reste calculée par la seule `plusValueImposable`                                   |
| Dépendance circulaire fiscalité ↔ revente           | La revente d'un régime ne dépend que de ses amortissements ; `calculerFiscalite` appelle la revente pure ; import de type seulement dans l'autre sens |
| `Resultats.revente` ou le TRI qui changent          | Test de non-régression : `calculerRevente` = `regimes[retenu].revente`                                                                                |
| Poids des scénarios (7 bases recalculées)           | Quatre appels de `plusValueImposable` par base : négligeable                                                                                          |
| Présenter un régime comme un conseil                | Pastille factuelle et phrase « avec ces hypothèses »                                                                                                  |
| Tests e2e d'impression (grilles du volet Fiscalité) | La grille des cartes reste la première ; vérifier `responsive.spec.ts`                                                                                |

## Auto-validation critique

- **Revente dans `ResultatRegime` plutôt qu'une section à part** : la fiche laissait le choix. La carte d'un régime lit tout au même endroit, `meilleurAuTotal` est un frère naturel de `meilleur` et `meilleurImpot`. La dépendance est à sens unique (la revente importe seulement des types de la fiscalité). Coût : le schéma d'un régime grossit d'un objet revente ; acceptable, les résultats ne sont jamais enregistrés.
- **« Ce qu'il vous reste » sans retirer la mise de départ** : la mise est la même pour tous les régimes, le classement ne change pas, et la fiche le définit ainsi. L'enrichissement (qui la retire) reste dans le Rapport.
- **Avertissement de déficit plutôt que calcul de la reprise** : la reprise dépend du revenu global et de la tranche des années passées ; un chiffre approximatif serait pire qu'une alerte claire.
- **Pas de Recharts** : voir « Écart avec la fiche ».
