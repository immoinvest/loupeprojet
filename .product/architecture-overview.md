# Deklic — Vue d'ensemble de l'architecture

```
┌──────────────────────────────┐   capture structurée + texte   ┌──────────────────────────────────────┐
│ apps/extension               │ ─────────────────────────────▶ │ apps/web (React SPA, Cloudflare Pages)│
│ WebExtension + bookmarklet   │                                │  • packages/moteur (calcul)           │
│ règles par portail (R2)      │                                │  • stockage local des projets         │
└──────────────────────────────┘                                │  • PDF via @media print               │
                                                                └───────┬──────────────┬───────────────┘
                                                        texte, champs   │              │ adresse, coords
                                                        manquants       ▼              ▼
                                                       ┌────────────────────┐  ┌────────────────────────┐
                                                       │ apps/worker        │  │ apps/worker /proxy/*   │
                                                       │ /extract (Hono)    │  │ Géoplateforme · ADEME  │
                                                       │ Mistral JSON strict│  │ Géorisques · BDNB      │
                                                       │ cache KV par hash  │  │ cache KV               │
                                                       │ quota par IP       │  └────────────────────────┘
                                                       └────────────────────┘
                              R2 : CSV DVF par commune · loyers ANIL · taux REI · zonage ABC · usure (rebuild mensuel)
                              D1 (v1.5) : projets des comptes, sessions lien magique
```

## Modules et statut

| Module            | Rôle                                                                                                                      | Statut                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `packages/moteur` | Financement, cash-flow, 4 régimes fiscaux, revente, rendement/TRI, verdict, scénarios                                     | **livré** (PR `feat/moteur-calcul`, 204 tests, 100 %)                               |
| `apps/web`        | Coque SaaS, Mes projets, Nouveau projet, Rapport, Hypothèses, Fiscalité, Revente, Visite                                  | **livré** (PR #3 à #6) ; Comparer, Méthode, partage à venir                         |
| `apps/worker`     | `/proxy/*` (liste blanche, cache KV, limite de débit, géocodage) ; `/extract` à venir                                     | **socle livré** (PR `feat/worker-socle`)                                            |
| `apps/extension`  | Capture LBC, SeLoger, Bien'ici, PAP, Logic-Immo                                                                           | à venir                                                                             |
| `data/`           | Pré-agrégation des référentiels (DVF, loyers ANIL, taxe foncière REI, zonage ABC, usure, communes) → R2 par GitHub Action | **livré** (PR `feat/referentiels`, 135 tests, 100 %) ; bucket et secrets R2 à créer |

## Flux de données d'une analyse

Résoudre → Capturer → Extraire → Normaliser → Géocoder → Enrichir → Estimer → Vérifier → Calculer. Le moteur intervient uniquement à l'étape 9 et reçoit un `Projet` complet (schéma Zod) ; il rend des `Resultats` jamais persistés.
