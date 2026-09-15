# Backlog d'idées

Idées notées par Pierre le 14/09/2026, à transformer **une par une** en spécification avant toute implémentation. Rien dans ce dossier ne touche à l'application : ce sont des fiches de travail.

## Comment on s'en sert

1. On prend une fiche, on tranche ensemble les **questions ouvertes** qu'elle liste.
2. On la passe dans le pipeline habituel : `/feature-discovery` (fiche dans `.product/features/<slug>-discovery.md`) puis `/specs` (`.product/specs/<slug>-specs.md`). La fiche de backlog passe alors au statut `spécifiée` et pointe vers ces documents.
3. L'implémentation se fait plus tard, une feature par session, sur une branche `feat/<slug>`.

Statuts : `idée` → `en discussion` → `spécifiée` → `en cours` → `livrée` (la fiche est alors résumée dans `features-registry.md`).

## Les fiches

| N°  | Fiche                                                                              | En une phrase                                                                                                                              | Statut                                                          | Dépend de        |
| --- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ---------------- |
| 01  | [Hypothèses : financement](01-hypotheses-financement.md)                           | Regrouper les hypothèses de prêt, retirer « Vos revenus nets », bouton « Simuler un prêt »                                                 | livrée                                                          | 08 (lien)        |
| 02  | [Hypothèses optionnelles](02-hypotheses-optionnelles.md)                           | Presque tout devient facultatif ; une analyse qui manque d'une donnée le dit clairement au lieu de bloquer la saisie                       | livrée                                                          | 01, 04           |
| 03  | [Hypothèses : retirer le bloc Marché](03-hypotheses-sans-marche.md)                | Le bloc DVF de l'onglet Hypothèses fait doublon avec l'onglet Estimation                                                                   | livrée                                                          | —                |
| 04  | [Achat : négociation et travaux](04-achat-negociation-travaux.md)                  | Curseur de négociation sous le prix affiché, sort de la « rénovation énergétique », travaux facultatifs à 0                                | livrée                                                          | —                |
| 05  | [Location : types d'exploitation](05-location-types-exploitation.md)               | Choisir d'abord le type (nue, meublée, colocation, courte durée, moyenne durée) et n'afficher que ses champs                               | livrée                                                          | —                |
| 06  | [Revente : curseur d'horizon](06-revente-curseur.md)                               | Un curseur de 1 à 30 ans qui recalcule tout l'onglet                                                                                       | livrée                                                          | —                |
| 07  | [Visite : base de questions](07-visite-questions.md)                               | Questions de visite tirées d'une base et de règles ; onglet masqué quand la visite est faite                                               | livrée                                                          | —                |
| 08  | [Simulateur de prêt](08-simulateur-pret.md)                                        | Outil indépendant des projets : deux offres côte à côte, comparaison, tableaux d'amortissement en CSV et à imprimer                        | livrée                                                          | —                |
| 09  | [Estimation : carte et confiance](09-estimation-carte-confiance.md)                | Carte des ventes du quartier, chiffres du repère visibles même sans adresse, indice de confiance expliqué en tête                          | livrée                                                          | —                |
| 10  | [Rapport : icônes et cash-flow](10-rapport-icones-cashflow.md)                     | Icônes ⓘ avec infobulle, liens vers Estimation / Fiscalité / Revente, autofinancement au centre, rendement brut                            | livrée                                                          | —                |
| 11  | [Coque : menu et en-tête fixes](11-coque-menu-entete-fixes.md)                     | Menu fixe et plus étroit, compte visible en bas, onglets du projet collés en haut, seul le contenu défile                                  | livrée                                                          | —                |
| 12  | [Menu Analyser : Mes projets et +](12-menu-analyser-mes-projets.md)                | « Mes projets · N [+] » en tête d'Analyser (remplace deux lignes) ; même principe « Mes biens · N [+] » dans Gérer                         | livrée (PR #82)                                                 | —                |
| 13  | [Formulaire Vérifier sans saisie](13-formulaire-verifier-sans-saisie.md)           | Compteurs, tuiles, échelle DPE, curseurs, ville trouvée par le code postal : presque plus de chiffres à taper ; le strict minimum d'abord  | livrée (PR #81)                                                 | 05, 06           |
| 14  | [Estimation : adresse d'abord, ventes détaillées](14-estimation-adresse-ventes.md) | Adresse en premier, repère appliqué seul après l'analyse, min/max, ventes triables et paginées avec DPE et dépendances                     | livrée (PR #87)                                                 | 09               |
| 15  | [Carte des ventes interactive](15-carte-interactive.md)                            | Zoom et déplacement faciles, plein écran, clic sur une vente, carte liée au tableau, fonds photo et cadastre                               | livrée (PR #88)                                                 | 14               |
| 16  | [Fiscalité : impôt total avec la revente](16-fiscalite-impot-total-revente.md)     | Par régime : impôt pendant l'exploitation + impôt à la revente (amortissements réintégrés) = impôt total                                   | livrée (PR #83)                                                 | 06               |
| 17  | [Liens vers les hypothèses](17-liens-vers-hypotheses.md)                           | Chaque chiffre supposé mène au champ exact où le changer (sur place ou dans Hypothèses), avec retour et effet affiché                      | livrée (session S9)                                             | 10               |
| 18  | [Statut : menu soigné](18-statut-menu-joli.md)                                     | Le menu du statut du projet aux couleurs de Deklic au lieu de la liste système, accessible au clavier                                      | livrée (PR #82)                                                 | —                |
| 19  | [Travaux selon l'état](19-travaux-selon-etat.md)                                   | Travaux estimés au m² selon l'état (et le DPE F/G), fourchette, modifiables ; barème sourcé « à confirmer »                                | livrée (PR #85)                                                 | 04               |
| 20  | [Infobulles des termes](20-infobulles-termes.md)                                   | Icône ⓘ à côté des termes techniques (CFE, PNO, différé…), définitions d'un glossaire unique, chiffres lus dans les règles                 | livrée (PR #81)                                                 | 10               |
| 21  | [Adresse avec suggestions](21-adresse-autocompletion.md)                           | Autocomplétion de l'adresse du bien dans Estimation (ville du projet d'abord), choisir lance l'analyse, numéro demandé si absent           | livrée (PR #84)                                                 | —                |
| 22  | [Vérification des calculs et de l'Excel](22-verification-calculs-excel.md)         | Audit du moteur : moteur ↔ Excel 92K ↔ calcul à la main ↔ sources officielles, tableau d'écarts, tests de référence, recommandations       | livrée (PR #79)                                                 | —                |
| 23  | [Liens courts et app.deklic.pro](23-liens-courts-domaine.md)                       | Liens de partage `app.deklic.pro/p/xxxxxxxx`, bascule du domaine sans perdre les projets locaux                                            | en cours (PR #86 ouverte : migration D1 puis fusion par Pierre) | domaine (Pierre) |
| 24  | [Hypothèses : mêmes commandes que Vérifier](24-hypotheses-memes-commandes.md)      | Montants mis en forme, compteurs, tuiles, échelle DPE, durées et apport en tuiles dans Hypothèses et Financement, sans changer les calculs | livrée (feature `hypotheses-commandes`)                         | 13, 17, 19, 20   |

## Ordre suggéré

Livrées : `01` à `11` (14/09/2026) ; `12` à `22` pendant les sessions de nuit du 15/09/2026 (fiches de session : `../sessions/nuit/`). Reste : `23` (PR ouverte, actions de Pierre).

`03` (une heure) → `01` → `04` (réutilise le composant `Curseur` de la fiche 06) → `02` (touche au moteur et à tous les onglets : mieux après 01 et 04) → `09` (en cours) → `05` (le plus gros : moteur + formulaires + fiscalité ; les questions de visite propres à la colocation et à la moyenne durée sont déjà écrites, voir `07`).

## Sources

- `Modèle Excel - Projet 92K.xlsx` à la racine du dépôt (non versionné, à garder hors git) : lu le 14/09/2026, ses feuilles alimentent les fiches 05, 06, 08 et 10.
