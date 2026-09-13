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
                              D1 « deklic-comptes » : utilisateurs, sessions, comptes liés (apps/comptes, worker Pages sur l'origine du site)
```

## Modules et statut

| Module             | Rôle                                                                                                                                                                                           | Statut                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `packages/moteur`  | Financement, cash-flow, 4 régimes fiscaux, revente, rendement/TRI, verdict, scénarios                                                                                                          | **livré** (PR `feat/moteur-calcul`, 204 tests, 100 %)                               |
| `apps/web`         | Coque SaaS, Mes projets, Nouveau projet, Rapport, Hypothèses, Fiscalité, Revente, Visite                                                                                                       | **livré** (PR #3 à #6) ; Comparer, Méthode, partage à venir                         |
| `apps/worker`      | `/proxy/*` (liste blanche, cache KV, limite de débit, géocodage) ; `/extract` (lecture LLM des annonces via OpenRouter)                                                                        | **livré et déployé** (PR #9, #10, #15)                                              |
| `apps/comptes`     | Comptes optionnels : Better Auth sur Hono servi par le worker Pages (`/api/auth`, `/api/comptes`), code e-mail (Resend), Google, Apple, D1 `deklic-comptes` ; écrans `/connexion` et `/compte` | **livré** (ADR-006) ; mise en service par Pierre (README)                           |
| `packages/capture` | Contrat de capture (schéma, encodage pour fragment d'URL, résolution d'URL) et moteur de règles (JSON-LD, état applicatif, meta, CSS)                                                          | **livré** (PR #16, 68 tests, 100 %)                                                 |
| `apps/extension`   | WebExtension MV3 : règles versionnées LBC, SeLoger, Bien'ici, PAP, Logic-Immo, popup « Analyser dans Deklic », script de contenu ; bouton-favori côté web                                      | **livré** (PR #16, 33 tests, 100 %) ; stores et règles sur R2 à venir               |
| `data/`            | Pré-agrégation des référentiels (DVF, loyers ANIL, taxe foncière REI, zonage ABC, usure, communes) → R2 par GitHub Action                                                                      | **livré** (PR `feat/referentiels`, 135 tests, 100 %) ; bucket et secrets R2 à créer |

Tests de bout en bout : `apps/web/e2e/` (Playwright, Chromium) rejoue huit parcours utilisateur sur le build de production servi par `vite preview`, en local et dans le job CI `e2e` ; voir `architecture/e2e-playwright.md`.

## Flux de données d'une analyse

Résoudre → Capturer → Extraire → Normaliser → Géocoder → Enrichir → Estimer → Vérifier → Calculer. Le moteur intervient uniquement à l'étape 9 et reçoit un `Projet` complet (schéma Zod) ; il rend des `Resultats` jamais persistés.

Capturer (étapes 1 et 2) : l'extension ou le bouton-favori lit la page ouverte avec les règles de son portail (`@loupe/capture`), encode la capture dans `#capture=…` et ouvre `/projets/nouveau` ; le web décode, valide, pré-remplit Vérifier et efface le fragment. Le fragment n'est jamais envoyé au serveur ; voir `architecture/extension.md`.
