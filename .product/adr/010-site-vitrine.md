# ADR-010 — Site vitrine et guides : Astro statique dans le même dépôt

Date : 15/09/2026. Statut : accepté (auto-validé, décisions de produit de Pierre du 15/09/2026). Feature : `site-vitrine`.

## Contexte

Deklic a besoin d'une page publique sur `deklic.pro` qui explique le produit, mène à l'application (`app.deklic.pro`, ADR-009) et porte des guides pensés pour le référencement naturel. L'application actuelle est une SPA React rendue dans le navigateur (ADR-001) : Google l'indexe mal et elle ne sert pas de page d'accueil. Pierre ne relit pas le code : la CI est le seul filet de sécurité.

## Décision

1. **Astro 7, sortie statique**, dans un nouveau paquet `apps/site` du monorepo. HTML complet au build, aucun JavaScript sauf le simulateur de rentabilité et le menu sur téléphone.
2. **Même dépôt, projet Cloudflare Pages séparé** (`deklic-site`), domaines `deklic.pro` et `www.deklic.pro` ; chemins surveillés : `apps/site/*`, `packages/moteur/*`, `packages/capture/*`, `marque/*`. Le projet de l'application exclut `apps/site/*`.
3. **Guides en MDX** avec frontmatter validé par Zod ; chiffres fiscaux par le composant `<Regle>` qui lit `obtenirRegles()` ; simulateur branché sur `@loupe/moteur`.
4. **Pas d'intégration React** dans le site ; **polices servies par le site** (Fontsource), aucune requête vers Google ; **CSP stricte** (`script-src 'self'`).
5. **Adresses** : `ORIGINE_VITRINE` dans `@loupe/capture/origines` ; adresse de l'application par `DEKLIC_ORIGINE`, comme le web.
6. **Vérification du HTML à la fin du build** (métadonnées, JSON-LD, liens internes, scripts inline) : un défaut arrête le déploiement.

## Conséquences

- Un seul `npm ci`, une seule CI (`lint`, `typecheck` avec `astro check`, `test:coverage`, `build`) pour l'application et le site.
- Le build de la CI construit aussi le site (quelques dizaines de secondes de plus).
- Deux versions de Vite cohabitent (7 pour le web, 8 pour Astro) : npm les installe séparément.
- Les tokens de couleur existent dans `apps/web/src/index.css` et `apps/site/src/styles/global.css` : un test compare ceux du site à `marque/couleurs.json`.
- Pierre crée le projet Pages et ajoute les domaines (README, « Mettre en ligne deklic.pro ») ; rien n'est déployé par la CI.

## Alternatives écartées

- **Nouveau dépôt** : double configuration (lint, CI, marque), plus d'accès direct au moteur pour les simulateurs et les chiffres des règles.
- **Pages de marketing dans l'application React** : rendu dans le navigateur, mauvais référencement, la coque de l'application n'est pas une page d'accueil.
- **Next.js** : écarté par l'ADR-001 (SSR inutile, Vercel Hobby non commercial).
- **CMS hébergé** (WordPress, Ghost, Webflow) : coût mensuel, un deuxième système à maintenir, guides et règles de calcul désynchronisés.
- **Sous-domaine `blog.deklic.pro`** : Google partage moins la réputation entre sous-domaines ; les guides vivent dans `deklic.pro/guides/`.
- **Google Fonts en lien** : chaque visite enverrait l'adresse IP du visiteur à Google, contraire à l'engagement « aucun tiers ».
