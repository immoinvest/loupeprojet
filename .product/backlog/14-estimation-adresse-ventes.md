# 14 — Estimation : l'adresse d'abord, repère appliqué seul, ventes détaillées

Statut : `livrée` (15/09/2026, session de nuit S7 : [discovery](../features/estimation-ventes-discovery.md), [specs](../specs/estimation-ventes-specs.md), [architecture](../architecture/estimation-ventes.md)) · Notée le 14/09/2026 · Dépend de : 09 (livrée) ; à caler après la PR `fix/meme-adresse-dvf` (même zone du Worker) · Taille : trois sessions (voir « Découpage »)

## La demande de Pierre

> Dans l'onglet Estimation, lorsqu'il n'y a pas d'adresse du bien renseignée, je veux que la possibilité de l'ajouter soit la section la plus haute. Une fois l'analyse lancée, ça doit modifier la fiabilité et la confiance de l'estimation. Par défaut, pas besoin de la section « Repère de prix » : une fois l'analyse lancée, si l'adresse est trouvée, ça prend automatiquement ce prix-là et met à jour tout le reste. Dans le tableau des ventes du plus près au plus large, je veux aussi voir le minimum et le maximum. Dans le dernier tableau, les ventes comparables les plus proches : une pagination si besoin pour voir le plus de ventes possible, et le tri selon les critères (surface, date, prix…). Si tu as le DPE des logements, ajoute-le. Et toute autre information utile sur le logement ou la transaction, ajoute-la aussi.

## Ce qui existe aujourd'hui (master 6258b4a)

- `apps/web/src/ecrans/Adresse.tsx` (onglet « Estimation »), de haut en bas :
  1. titre et chapô ;
  2. `CarteConfiance` (`adresse/Confiance.tsx`) : note et quatre raisons, calculées par le moteur **sur `projet.marche.dvf`** ;
  3. carte du formulaire « Adresse du bien » + « Analyser » ;
  4. sans résultat : `CarteRepere` (`adresse/Repere.tsx`, le repère posé à la création) ; avec résultat : carte « Le repère de prix » avec le bouton **« Utiliser ce repère pour l'estimation »** ;
  5. `CarteEstimation`, puis DPE, loyer, risques, carte du quartier, tendance, `TableauGroupes`, `TableauVentes`.
- **Le repère n'est appliqué que sur clic** (`utiliserRepere` → `marcheDepuisReference`) : tant qu'on ne clique pas, la confiance et l'estimation restent celles du repère de commune. Risques et loyer de référence, eux, s'appliquent déjà seuls après l'analyse.
- Une adresse enregistrée est réanalysée à chaque ouverture de l'onglet (réponses en cache côté Worker).
- `TableauGroupes` (`adresse/Tableaux.tsx`) : Où · Ventes · Comparables · Médiane · « Moitié des ventes entre » (Q1-Q3). Le contrat du Worker renvoie **déjà `minM2` et `maxM2`** par groupe : rien à calculer.
- `TableauVentes` : Date · Adresse · Surface · Prix · Prix au m² · Au prix d'aujourd'hui · Distance · Place. Pas de tri ni de pagination ; **20 ventes au plus** (`MAX_VENTES_PROCHES` dans `apps/worker/src/adresse/analyse.ts`). `pieces` est dans la réponse mais pas affiché.
- Ce qu'on garde de chaque vente DVF (`data/src/schemas/dvf.ts`, `sources/dvf/vente.ts`) : date, prix, surface réelle, type, pièces, coordonnées, parcelle, numéro, suffixe, code et nom de voie, surface Carrez. Seules les mutations « Vente » d'**un seul logement sans local commercial** sont retenues.
- DPE : `CarteDpe` liste les DPE ADEME **à moins de 30 m du bien** (`services/dpe.ts`, base `dpe03existant`), pas ceux des logements vendus.

## Ce que ça changerait pour l'utilisateur

1. **Sans adresse** : la première carte de l'onglet est « Où se trouve le bien ? » avec le champ et « Analyser ». La confiance vient juste dessous et dit ce qu'elle gagnerait avec l'adresse.
2. **Analyse lancée, repère trouvé** : il s'applique **tout seul**. La note de confiance, la fourchette, le prix estimé, le feu « prix » du Rapport et le verdict se mettent à jour d'un coup ; une ligne discrète le signale (« Repère de l'immeuble appliqué : 3 480 €/m², 12 ventes — Annuler »).
3. **Plus de carte « Repère de prix »** : son contenu utile (où est le repère, écart du prix affiché) passe dans la carte Estimation ; les cas « pas de repère » ou « aucune vente » deviennent une phrase dans cette carte.
4. **Tableau par groupe** : colonnes Min et Max ajoutées.
5. **Ventes comparables** : toutes les ventes comparables jusqu'à 300 m (et communes voisines), **20 par page**, tri par colonne (date, surface, pièces, prix, prix au m², au prix d'aujourd'hui, distance, DPE), filtres rapides (même immeuble, 2 dernières années, même nombre de pièces).
6. **Chaque vente plus parlante** : pièces, DPE et GES du logement vendu quand on le retrouve, dépendances comprises dans le prix (cave, parking), terrain pour une maison, surface Carrez, et un détail dépliable par ligne.

## Proposition de réalisation

### A. Ordre de l'onglet et repère automatique (web seul)

- `Adresse.tsx` : sans `enregistre.adresse`, la carte du formulaire passe **avant** `CarteConfiance` ; avec une adresse, une ligne compacte en tête (« 144 rue de l'Olivier, Marseille — Changer ») remplace la grande carte.
- Après `analyser`, si `reference !== null`, `marcheDepuisReference` est appliqué **dans la même écriture** que risques et loyer (`mettreAJour` unique), provenance `dvf` du repère à l'adresse.
- **Ne pas écraser un choix de la personne** : si `marche.dvf.medianM2` a la provenance `utilisateur` (saisi dans Hypothèses), on n'applique pas et on propose « Remplacer par le repère de l'adresse ».
- « Annuler » remet le repère précédent (gardé en mémoire de l'écran, pas dans le projet).
- Suppression de `CarteRepere` et de la carte « Le repère de prix » ; `phraseReference` (écart au repère) et la pastille « cadastre indisponible » vont dans `CarteEstimation`.
- Pas de nouvel appel réseau : c'est la réponse déjà reçue.

### B. Tableaux : min / max, tri, pagination (web + Worker léger)

- `TableauGroupes` : colonnes « Min » et « Max » (`prixM2(g.statistiques.minM2)`), en fin de ligne sur téléphone (tableau déjà défilant, première colonne collante).
- Worker : `MAX_VENTES_PROCHES` 20 → **toutes les comparables des groupes, plafond 300** (taille de réponse ≈ 60 Ko au pire, gzip ≈ 10 Ko ; cache 24 h inchangé). Contrat v5, champ `ventesProchesTronquees: boolean`.
- Web : tri et pagination **côté navigateur** (fonction pure `trierVentes(ventes, cle, sens)` + `pageDe(ventes, page, 20)`, testées à 100 %), en-têtes de colonnes cliquables (`aria-sort`), « Précédent / Page 2 sur 7 / Suivant », tri et page remis à zéro quand l'analyse change. Tri par défaut : distance.
- Vente du bien lui-même (même adresse, surface ±5 %, moins de 5 ans) : ligne marquée « probablement ce logement » (le correctif `fix/meme-adresse-dvf` s'en occupe côté Worker ; à réutiliser, pas à refaire).

### C. Informations en plus sur chaque vente (données + Worker)

**Depuis DVF** (colonnes à ajouter en fin de CSV, lues par `sources/dvf/vente.ts`) :

| Donnée              | Colonne DVF source                               | Pourquoi c'est utile                                                    |
| ------------------- | ------------------------------------------------ | ----------------------------------------------------------------------- |
| Dépendances vendues | lignes `code_type_local = 3` de la même mutation | Un parking ou une cave dans le prix gonfle le prix au m² : on l'affiche |
| Terrain             | `surface_terrain` (maisons)                      | Deux maisons de 90 m² ne valent pas pareil avec 200 ou 1 000 m²         |
| Nombre de lots      | `nombre_lots`                                    | Indice de la vente d'un appartement avec annexes                        |
| Carrez              | déjà dans le CSV, pas encore dans le contrat     | Surface la plus fiable d'un appartement                                 |
| Pièces              | déjà dans le contrat, pas affiché                | Critère de tri demandé                                                  |

Publication : relancer l'Action « Référentiels » (cinq ans de DVF, toute la France si la passe nationale est faite) ; ancien format toléré par le lecteur.

**Depuis la base DPE de l'ADEME** (DPE du logement vendu) :

- Rapprochement **par l'adresse** : la clé BAN (`codeInsee_codeVoie_numero`, déjà construite par `cleBanAdresse`) comparée à `identifiant_ban` des DPE, puis surface habitable à ±10 % et DPE établi dans les 18 mois avant la vente (le DPE est obligatoire à la vente). Plusieurs candidats → le plus proche en surface et en date ; aucun → « — ».
- Chaque DPE rapproché porte : étiquette DPE et GES, consommation (kWh/m²/an), période de construction, énergie de chauffage. Mention « DPE probable » : c'est un rapprochement, pas un lien officiel.
- Worker : une requête ADEME **par analyse**, pas par vente : `qs=identifiant_ban:(clé1 OR clé2 …)` par paquets de 50 adresses, `select` limité aux champs utiles, cache 7 jours comme `/proxy/dpe`. Limite : les DPE de la base `dpe03existant` datent de juillet 2021 et après → les ventes plus anciennes n'auront souvent pas de DPE.
- Colonne « DPE » triable (A avant G, inconnus à la fin) et filtre « DPE F ou G » (passoires, interdites à la location progressivement).

**Détail dépliable d'une vente** : date, prix, prix au m² brut → actualisé → corrigé (avec le coefficient et la correction de surface, déjà dans la réponse), surface réelle et Carrez, pièces, dépendances, terrain, lots, DPE et ses détails, parcelle cadastrale, place par rapport au bien.

### Ce qu'on n'ajoutera pas

- **Rien sur l'acheteur ni le vendeur** : DVF ne contient aucune identité, et les conditions d'utilisation de DVF (article R. 112 A-3 du livre des procédures fiscales) **interdisent de réidentifier les personnes**, directement ou indirectement. Pas de croisement avec d'autres sources pour le faire.
- Pas de photo ni d'annonce d'origine des ventes (aucune base d'annonces, principe n° 6).

## Questions ouvertes

1. **Repère saisi à la main** : ne pas l'écraser et proposer « Remplacer » (proposition), ou toujours appliquer celui de l'adresse ?
2. **Adresse déjà enregistrée** : ligne compacte en tête avec « Changer » (proposition), ou garder la grande carte toujours en haut ?
3. **Plafond des ventes** : 300 comparables (proposition) ; au-delà, dire « 300 ventes les plus proches sur 1 240 ».
4. **Ventes non comparables** (autre type, surface hors ±40 %) : les montrer aussi avec un filtre « toutes les ventes » ? Proposition : non en v1, le tableau reste celui des comparables.
5. **DPE des ventes** : accepter le rapprochement « probable » (proposition), ou n'afficher un DPE que s'il n'y a qu'un candidat à l'adresse ?
6. **VEFA** (ventes de neuf sur plan, aujourd'hui exclues) : les ajouter, marquées « neuf » et exclues des statistiques ? Proposition : plus tard.

## Découpage proposé

1. **Session A — ordre et repère automatique** (web seul, sans redéploiement) : partie A + colonnes Min / Max. Petit et très visible.
2. **Session B — tri, pagination et détail d'une vente** : Worker (plafond 300, contrat v5, Carrez), web (tri, pages, filtres, détail dépliable). Redéploiement du Worker.
3. **Session C — dépendances, terrain, lots et DPE des ventes** : `data/` (colonnes DVF), service de rapprochement DPE dans le Worker, colonnes et filtres. Redéploiement du Worker + Action « Référentiels » relancée par Pierre.

## Tests à mettre à jour

- Web : `tests/adresse-ecran.test.tsx` (ordre des cartes, repère appliqué sans clic, repère utilisateur conservé, Annuler), `tests/estimation*.test.tsx` et tests de confiance (note changée après analyse), `tests/carte.test.tsx` si la carte bouge ; nouveaux : `trierVentes`, `pageDe`, filtres, `aria-sort`, détail dépliable.
- Playwright : parcours Estimation (sans Worker en e2e → vérifier la carte d'adresse en premier et le message d'indisponibilité ; le reste en Vitest avec faux client).
- Worker : `tests/adresse.test.ts` (plafond, `ventesProchesTronquees`, contrat v5), nouveau `tests/dpe-ventes.test.ts` (clé BAN, surface, fenêtre de 18 mois, plusieurs candidats, aucun, ADEME en panne, cache). Couverture 100 %.
- Données : `vente.ts` (dépendances d'une mutation, terrain, lots, ancien format). Couverture 100 %.

## Coût et risques

- Appels : **une requête ADEME de plus par analyse** (par paquets de 50 adresses), en cache 7 jours ; API gratuite. Pas d'effet sur l'API Géo ni le cadastre.
- Réponse `/marche/adresse` plus grosse (jusqu'à 300 ventes) : négligeable en bande passante, à surveiller sur le temps CPU du Worker (déjà sous surveillance, voir `fix/meme-adresse-dvf`).
- Risque produit : appliquer le repère sans clic change le verdict « dans le dos » → la ligne « appliqué — Annuler » et le respect des valeurs saisies à la main sont indispensables.
- Risque juridique : aucune identité ; afficher les sources DVF et ADEME sous les tableaux (déjà fait pour DVF).
