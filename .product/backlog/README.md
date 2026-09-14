# Backlog d'idées

Idées notées par Pierre le 14/09/2026, à transformer **une par une** en spécification avant toute implémentation. Rien dans ce dossier ne touche à l'application : ce sont des fiches de travail.

## Comment on s'en sert

1. On prend une fiche, on tranche ensemble les **questions ouvertes** qu'elle liste.
2. On la passe dans le pipeline habituel : `/feature-discovery` (fiche dans `.product/features/<slug>-discovery.md`) puis `/specs` (`.product/specs/<slug>-specs.md`). La fiche de backlog passe alors au statut `spécifiée` et pointe vers ces documents.
3. L'implémentation se fait plus tard, une feature par session, sur une branche `feat/<slug>`.

Statuts : `idée` → `en discussion` → `spécifiée` → `en cours` → `livrée` (la fiche est alors résumée dans `features-registry.md`).

## Les fiches

| N°  | Fiche                                                                | En une phrase                                                                                                        | Statut    | Dépend de |
| --- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------- | --------- |
| 01  | [Hypothèses : financement](01-hypotheses-financement.md)             | Regrouper les hypothèses de prêt, retirer « Vos revenus nets », bouton « Simuler un prêt »                           | idée      | 08 (lien) |
| 02  | [Hypothèses optionnelles](02-hypotheses-optionnelles.md)             | Presque tout devient facultatif ; une analyse qui manque d'une donnée le dit clairement au lieu de bloquer la saisie | livrée    | 01, 04    |
| 03  | [Hypothèses : retirer le bloc Marché](03-hypotheses-sans-marche.md)  | Le bloc DVF de l'onglet Hypothèses fait doublon avec l'onglet Estimation                                             | idée      | —         |
| 04  | [Achat : négociation et travaux](04-achat-negociation-travaux.md)    | Curseur de négociation sous le prix affiché, sort de la « rénovation énergétique », travaux facultatifs à 0          | idée      | —         |
| 05  | [Location : types d'exploitation](05-location-types-exploitation.md) | Choisir d'abord le type (nue, meublée, colocation, courte durée, moyenne durée) et n'afficher que ses champs         | idée      | —         |
| 06  | [Revente : curseur d'horizon](06-revente-curseur.md)                 | Un curseur de 1 à 30 ans qui recalcule tout l'onglet                                                                 | idée      | —         |
| 07  | [Visite : base de questions](07-visite-questions.md)                 | Questions de visite tirées d'une base et de règles ; onglet masqué quand la visite est faite                         | idée      | —         |
| 08  | [Simulateur de prêt](08-simulateur-pret.md)                          | Outil indépendant des projets : deux offres côte à côte, comparaison, tableaux d'amortissement en CSV et à imprimer  | spécifiée | —         |
| 09  | [Estimation : carte et confiance](09-estimation-carte-confiance.md)  | Carte des ventes du quartier, chiffres du repère visibles même sans adresse, indice de confiance expliqué en tête    | idée      | —         |
| 10  | [Rapport : icônes et cash-flow](10-rapport-icones-cashflow.md)       | Icônes ⓘ avec infobulle, liens vers Estimation / Fiscalité / Revente, autofinancement au centre, rendement brut      | idée      | —         |
| 11  | [Coque : menu et en-tête fixes](11-coque-menu-entete-fixes.md)       | Menu fixe et plus étroit, compte visible en bas, onglets du projet collés en haut, seul le contenu défile            | idée      | —         |

## Ordre suggéré

`08` (spécifiée, prête à implémenter) → `03` (une heure) → `11` et `06` (visuel, sans moteur) → `01` → `04` → `10` → `02` (touche au moteur et à tous les onglets : mieux après 01 et 04) → `09` → `05` (le plus gros : moteur + formulaires + fiscalité) → `07`.

## Sources

- `Modèle Excel - Projet 92K.xlsx` à la racine du dépôt (non versionné, à garder hors git) : lu le 14/09/2026, ses feuilles alimentent les fiches 05, 06, 08 et 10.
