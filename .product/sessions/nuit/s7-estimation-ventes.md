# S7 — `estimation-ventes` (fiche 14)

Branche `feat/estimation-ventes` · **Prérequis : `feat/adresse-suggestions`** · Règles : `_regles-nuit.md`

## Objectif

Détail : `C:\Users\errei\Claude\loupe-backlog\.product\backlog\14-estimation-adresse-ventes.md` (propositions à appliquer pour les six questions). Trois temps dans la session, un commit par story :

1. **A — Ordre et repère automatique** (web) : adresse en tête sans adresse enregistrée (ligne compacte sinon) ; repère appliqué seul après l'analyse, sans écraser un repère saisi à la main, « Annuler » ; suppression des cartes « Repère de prix » ; colonnes Min / Max du tableau par groupe.
2. **B — Tri, pagination, détail** : Worker (plafond 300 comparables, contrat v5, `ventesProchesTronquees`, Carrez), web (`trierVentes`, `pageDe`, filtres, `aria-sort`, détail dépliable).
3. **C — Informations en plus** : `data/` (dépendances, terrain, lots en colonnes de fin de CSV, ancien format toléré), rapprochement DPE ADEME des ventes dans le Worker (clé BAN, surface ±10 %, 18 mois, paquets de 50, cache 7 jours), colonnes et filtres DPE. **Rien sur les acheteurs ou vendeurs** (réidentification interdite).

Si la session manque de temps, livre A + B dans la PR et écris C comme reste à faire dans le rapport — ne jamais laisser un temps à moitié.

## Périmètre

`apps/web/src/ecrans/Adresse.tsx` et `ecrans/adresse/*` (sauf `CarteVentes.tsx` / `CarteQuartier.tsx` : S8), `enrichissement/`, `textes/{adresse,estimation,confiance}.ts`, `apps/worker/src/{adresse,services}/`, `data/src/{schemas,sources/dvf}/`, tests.

## Hors périmètre

Carte Leaflet (S8), formulaire d'adresse (livré par S6), moteur (`estimerPrix` inchangé sauf besoin minimal signalé).

## Fin

PR fusionnée ; rapport `C:\Users\errei\Claude\rapports-nuit\estimation-ventes.md` ; actions pour Pierre : déployer le Worker, puis relancer l'Action « Référentiels » (nouvelles colonnes DVF).
