# Feature Discovery : Socle web (`apps/web`)

## Demande d'origine

« C'est parti » pour `web-socle` après le choix de la direction visuelle C (ADR-004) : l'application React avec la coque SaaS, branchée sur le moteur, déployable sur Cloudflare Pages.

## Analyse

- **Quoi** : `apps/web`, SPA React + Vite + TypeScript strict + Tailwind v4, avec la coque d'application (barre latérale projets, en-tête à onglets, profil), l'écran **Mes projets** et l'écran **Rapport** en lecture (verdict, feux, cartes, leviers, fiscalité, revente) alimentés par `@loupe/moteur`. Projets stockés localement (sans compte), validés par Zod. Configuration de déploiement Cloudflare Pages.
- **Pourquoi** : première chose visible pour Pierre et pour cinq testeurs ; valide le moteur sur un vrai écran ; pose les fondations (thème, routage, stockage, tests de composants) de toutes les features UI suivantes.
- **Pour qui** : Camille (lecture du rapport), Pierre (démo), le développeur des features suivantes (structure, composants).
- **Où** : `apps/web` + racine (workspaces déjà prêts, CI déjà sur `apps/*`).

## Outcomes

1. `npm run dev -w apps/web` affiche le rapport du projet d'exemple avec les chiffres du moteur, dans la coque de l'ADR-004.
2. Les projets sont créés (dupliqués depuis l'exemple), listés, ouverts et supprimés, et survivent au rechargement (stockage local).
3. Lint, typecheck, tests de composants (Vitest + Testing Library) et build passent en CI ; le build est déployable sur Cloudflare Pages tel quel.

## Outputs

1. Scaffold Vite/React/TS aligné sur le monorepo (tsconfig base, ESLint racine, Prettier), Tailwind v4, polices Outfit + Nunito Sans.
2. Thème : tokens ADR-004 en variables CSS, composants de base (Card, Pill/Feu, Bouton, Onglets, Lignes clé/valeur).
3. Coque : `Sidebar` (logo, Nouveau projet, liste des projets, Comparer, Méthode, Extension, profil), `Topbar` (fil d'Ariane, onglets, actions), `AppLayout`.
4. Stockage local : schéma `ProjetEnregistre` (projet + méta : nom, statut, dates), `useProjets` (liste, créer, supprimer, mettre à jour), sérialisation Zod, migration de version.
5. Formatage français : euros, pourcentages, écarts signés, mois/an ; textes des codes (feux, axes, régimes, vigilance).
6. Écrans : `MesProjets` (cartes avec 5 feux et 4 métriques, filtres, statut), `Rapport` (comme la maquette Main, données du moteur), pages `Hypothèses`/`Fiscalité`/`Revente`/`Visite` en « bientôt » sobre.
7. Déploiement : `wrangler.toml`/config Pages (dossier `dist`, SPA fallback), README.

## Périmètre

### IN

Tout ce qui précède. Onglets non implémentés = état vide honnête (pas de faux contenu).

### OUT

- Édition des hypothèses (feature `ecran-verifier-rapport`), saisie manuelle, import d'annonce.
- Compte, synchronisation, comparaison réelle (bouton présent, désactivé avec info-bulle).
- Playwright E2E (feature dédiée, avec installation des navigateurs en CI).
- shadcn/ui via CLI : composants maison de même facture pour l'instant (pas d'invite interactive), migration possible plus tard.
- Mode sombre.

## Contraintes

- Aucun calcul dans l'UI : tout vient de `calculerProjet`. Les textes sont écrits dans `src/textes/`, jamais générés.
- Accessibilité de base : cibles ≥ 44 px, contrastes AA sur les feux, navigation clavier des onglets.
- Français, pas de tiret cadratin.
- Le stockage local n'est pas une base : quotas ~5 Mo, un projet ≈ 3 Ko.

## Risques

| Risque                                                       | Mitigation                                                                                                |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Tailwind v4 + Vite : nouvelle config `@import "tailwindcss"` | Suivre la doc officielle (plugin `@tailwindcss/vite`)                                                     |
| Tests de composants lents                                    | jsdom, tests ciblés sur la logique d'affichage (formatage, store, feux)                                   |
| PR empilées (moteur non mergé)                               | Branche créée depuis `feat/direction-visuelle` ; PR vers cette base ; Pierre merge dans l'ordre 1 → 2 → 3 |
| Déploiement Cloudflare : compte et token de Pierre           | Fournir la config et la marche à suivre ; pas de déploiement depuis cette machine                         |

## Definition of Done

- [ ] `npm run lint && npm run typecheck && npm run test && npm run build` verts à la racine
- [ ] Rapport du projet d'exemple conforme à la maquette Main (structure, tokens), chiffres du moteur
- [ ] Mes projets : créer, ouvrir, supprimer, persistance après rechargement
- [ ] Couverture des modules `stockage/`, `formatage/`, `textes/` : 100 %
- [ ] Config Cloudflare Pages + README « déployer »
- [ ] Docs `.product/` et CLAUDE.md à jour, PR ouverte
