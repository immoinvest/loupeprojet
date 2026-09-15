# Discovery : estimation-ventes (fiche de backlog 14)

Session de nuit S7 du 15/09/2026. Fiche : `.product/backlog/14-estimation-adresse-ventes.md`. Base : `master` après la fusion de `feat/adresse-suggestions` (S6, champ d'adresse avec suggestions).

## La demande

Dans l'onglet Estimation : l'adresse d'abord quand elle manque ; le repère de l'adresse appliqué tout seul après l'analyse (la confiance et l'estimation suivent) ; plus de carte « Repère de prix » ; minimum et maximum dans le tableau par groupe ; toutes les ventes comparables, triables et paginées ; DPE et autres informations utiles sur chaque vente.

## Résultats attendus (outcomes)

1. Camille voit tout de suite comment améliorer l'estimation : la carte d'adresse est la première de l'onglet tant qu'aucune adresse n'est enregistrée.
2. Une analyse réussie change la note de confiance, la fourchette et le feu « prix » sans clic de plus, et se défait par « Annuler ».
3. Un repère saisi à la main dans Hypothèses n'est jamais écrasé : l'écran propose « Remplacer par le repère de l'adresse ».
4. Les ventes comparables se lisent comme un tableur : tri par colonne, 20 par page, filtres rapides, détail d'une vente.
5. Chaque vente dit ce que le prix comprend (dépendances, terrain, lots, Carrez) et le DPE probable du logement vendu.

## Livrables (outputs)

| Temps | Où | Quoi |
| --- | --- | --- |
| A | `apps/web` | ordre des cartes, ligne compacte d'adresse, repère automatique et Annuler, carte Repère supprimée (contenu dans la carte Estimation), colonnes Min / Max |
| B | `apps/worker` | `ventesProches` : toutes les comparables jusqu'à 300, `ventesProchesTotal`, `ventesProchesTronquees`, `carrez`, `parcelle` ; contrat v7 |
| B | `apps/web` | `trierVentes`, `filtrerVentes`, `pageDe` purs ; tableau des ventes triable (`aria-sort`), paginé, filtré, détail dépliable |
| C | `data` | colonnes `dependances`, `terrain`, `lots` en fin de CSV DVF, ancien format toléré |
| C | `apps/worker` | lecture des colonnes ; rapprochement des DPE ADEME des ventes (clé BAN, surface ±10 %, 18 mois avant la vente, paquets de 50, cache 7 jours) |
| C | `apps/web` | colonne DPE triable (A → G, inconnus à la fin), filtre « DPE F ou G », détails DPE dans le dépliant |

## Périmètre

`apps/web/src/ecrans/Adresse.tsx`, `ecrans/adresse/*` sauf `CarteVentes.tsx` / `CarteQuartier.tsx` (S8), `enrichissement/`, `textes/{adresse,estimation,confiance}.ts`, `apps/worker/src/{adresse,services}/`, `data/src/{schemas,sources/dvf}/`, tests.

Hors périmètre : carte Leaflet (S8), formulaire d'adresse (S6), moteur (`estimerPrix` inchangé).

## Contraintes

- Principes métier : aucun modèle de langage ; aucune donnée sur les acheteurs ou vendeurs (réidentification interdite par l'article R. 112 A-3 du LPF) ; sources DVF et ADEME affichées.
- Le Worker n'est pas déployé cette nuit : le web doit fonctionner avec le Worker 0.10 en production (champs nouveaux optionnels, tri et pagination sur les 20 ventes d'aujourd'hui).
- Les CSV DVF ne sont pas republiés cette nuit : le Worker lit l'ancien format (dépendances, terrain, lots à `null`).
- Couverture 100 % : Worker, `data/src`, `enrichissement/`, `textes/`.
- Cloudflare Workers : sous-requêtes limitées (50 sur l'offre gratuite) ; l'analyse en fait déjà une douzaine (R2, cadastre, API Géo) → au plus 4 paquets ADEME (200 adresses distinctes, les plus proches d'abord).

## Questions ouvertes (propositions de la fiche appliquées)

1. Repère saisi à la main : conservé, bouton « Remplacer par le repère de l'adresse ».
2. Adresse enregistrée : ligne compacte en tête avec « Changer ».
3. Plafond : 300 comparables ; au-delà « 300 ventes les plus proches sur 1 240 ».
4. Ventes non comparables : non montrées en v1.
5. DPE des ventes : rapprochement « probable » accepté, mention visible.
6. VEFA : plus tard.

## Risques

- Verdict changé « dans le dos » : ligne « appliqué — Annuler » et respect de la saisie manuelle.
- Temps CPU du Worker avec 300 ventes et le rapprochement DPE : calcul linéaire, indexé par clé BAN.
- Base ADEME en panne : ventes sans DPE, analyse non mise en cache (réessayée à l'ouverture suivante).
- Clés BAN des adresses à suffixe (bis, ter) : non rapprochées en v1 (format du suffixe incertain).

## Auto-revue critique

- Le découpage A / B / C suit la fiche ; C dépend de B (colonnes du tableau), B d'aucune donnée nouvelle.
- Risque de conflit avec S6 sur `Adresse.tsx` : implémentation du temps A après lecture du `master` fusionné.
- Le contrat v6 est déjà en production (la fiche parlait de v5) : on passe en v7.
- Validé : on continue vers les specs.
