# Loupe

Colle le lien d'une annonce immobilière, obtiens l'analyse complète de rentabilité locative : financement, cash-flow, fiscalité (quatre régimes côte à côte), revente, rendement et TRI, verdict à cinq feux, scénarios « et si ».

Gratuit, sans compte, tout se calcule dans le navigateur. Spécification produit : [`.product/reference/spec-produit-v1.html`](.product/reference/spec-produit-v1.html). Décisions d'architecture : [`.product/adr/`](.product/adr/).

## Stack

Monorepo npm workspaces, TypeScript strict, Vitest, ESLint, Prettier. Cible : React + Vite sur Cloudflare Pages, Hono sur Cloudflare Workers, extension navigateur pour la lecture des annonces (voir [ADR-001](.product/adr/001-stack.md)).

## Structure

```
packages/moteur/     Moteur de calcul pur (TypeScript + Zod), 100 % couvert par les tests
apps/web/            Application React + Vite + Tailwind v4 (coque SaaS, Mes projets, Rapport), Cloudflare Pages
apps/                À venir : worker, extension
.product/            Spécifications, ADR, design, état du pipeline de développement
.claude/commands/    Skills du pipeline de développement (Claude Code)
```

## Commandes

```bash
npm install
npm run lint          # eslint . --max-warnings=0
npm run format:check  # prettier --check .
npm run typecheck     # tsc --noEmit dans chaque workspace
npm run test          # vitest run
npm run test:coverage # vitest run --coverage (seuil 100 % sur packages/moteur)
npm run build         # build de chaque workspace
```

Node 22 ou plus. La CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) exécute ces six commandes sur chaque pull request.

## Le moteur (`@loupe/moteur`)

```ts
import { calculerProjet, projetExemple } from '@loupe/moteur';

const resultats = calculerProjet(projetExemple);
resultats.verdict.feux; // cinq feux : prix, rendement, cash-flow, effort, risques
resultats.cashflow.mensuel; // cash-flow mensuel charges pleines, vacance déduite
resultats.fiscalite.regimes.lmnp_reel; // projection année par année, art. 39 C
resultats.revente.cashNetVendeur; // valeur − frais − CRD − IRA − impôt sur la plus-value
resultats.rendement.tri; // TRI réel sur les flux annuels
resultats.scenarios?.prixCibles; // prix pour cash-flow nul, net 6 %, brut 8 %
```

- **Entrée** : un `Projet` validé par Zod (`ProjetSchema`), avec des valeurs par défaut sourcées (vacance 3 semaines, entretien 0,5 %, PS BIC 18,6 %…).
- **Sortie** : des `Resultats` conformes à `ResultatsSchema` (aucun NaN, aucune clé non documentée), jamais persistés.
- **Règles datées** dans `src/regles/2026-09.ts` : chaque projet porte sa `versionRegles`. Les valeurs sans source consolidée sont listées dans `meta.aConfirmer`, les simplifications dans `meta.simplifications`.
- **Pur** : aucune I/O, aucune date système, aucun aléatoire, aucun `console`. Le LLM n'intervient jamais dans un calcul.
- **Tests** : 204 tests, couverture 100 % (lignes, branches, fonctions), cas de référence vérifiés à la main sur le projet d'exemple (T3 65 m², Marseille 5e, 155 000 € FAI).

Modules : `financement` (frais d'acquisition par formule, PMT, amortissement avec différés, TAEG, HCSF, IRA), `cashflow`, `fiscalite` (micro-BIC, LMNP réel, micro-foncier, nu réel), `revente` (plus-value, abattements, surtaxe, réintégration LMNP), `rendement` (brut/net/net-net, TRI, enrichissement), `verdict`, `scenarios`.

## L'application web (`@loupe/web`)

```bash
npm run dev -w apps/web      # http://localhost:5173
npm run build -w apps/web    # apps/web/dist
```

- Direction visuelle « Le guide » ([ADR-004](.product/adr/004-direction-visuelle.md)) : tokens dans `src/index.css`, polices Outfit et Nunito Sans.
- Coque d'application : barre latérale (projets, nouveau projet, comparer, méthode, extension, profil), en-tête projet à onglets (Rapport, Hypothèses, Fiscalité, Revente, Visite).
- Écrans livrés : **Nouveau projet** (lien d'annonce reconnu sur LeBonCoin, SeLoger, Bien'ici, PAP, Logic-Immo ; texte de l'annonce collé et lu par règles ; ou saisie manuelle ; formulaire Vérifier avec provenance de chaque valeur), **Mes projets** (liste, filtres, statut, suppression) et **Rapport** (verdict, cinq feux, prix vs ventes réelles, cash-flow, leviers, fiscalité, revente), calculés par le moteur. Les autres onglets affichent un état « bientôt ».
- La lecture automatique de la page d'annonce arrive avec l'extension navigateur (ADR-002) ; le texte collé n'est jamais conservé, seuls les champs lus le sont.
- Projets stockés dans le navigateur (`localStorage`, clé `loupe.projets.v1`), validés par Zod ; le premier lancement crée le projet d'exemple.
- Textes centralisés dans `src/textes/` : les codes du moteur deviennent des phrases là et nulle part ailleurs.
- Tests : Vitest + Testing Library (jsdom), couverture 100 % sur `stockage/`, `formatage/`, `textes/`.

### Déployer sur Cloudflare Pages

1. Dans le tableau de bord Cloudflare, créer un projet Pages connecté au dépôt GitHub.
2. Commande de build : `npm ci && npm run build -w apps/web` · dossier de sortie : `apps/web/dist` · Node 22.
3. `apps/web/public/_redirects` gère le rechargement des routes de l'application.

En local : `npx wrangler pages deploy dist` depuis `apps/web` (compte Cloudflare requis).

## Avertissement

Loupe est un outil d'aide à la décision, pas un conseil en investissement ni un conseil fiscal. Les règles fiscales sont celles connues au 13 septembre 2026.
