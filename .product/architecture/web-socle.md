# Architecture : Socle web (`apps/web`)

```
apps/web/
├── index.html                 lang fr, polices Google (Outfit, Nunito Sans), favicon SVG
├── vite.config.ts             react + @tailwindcss/vite, alias @ → src
├── vitest.config.ts           jsdom, Testing Library, couverture 100 % sur stockage/, formatage/, textes/
├── tsconfig.json              étend tsconfig.base ; lib DOM ; jsx react-jsx
├── wrangler.toml              Cloudflare Pages : dist
├── public/_redirects          SPA fallback
└── src/
    ├── main.tsx / App.tsx     routes (createBrowserRouter) ; AppEnMemoire pour les tests
    ├── index.css              @import tailwindcss ; @theme = tokens ADR-004
    ├── formatage/nombres.ts   euros, eurosSignes, eurosParMois, pourcentage(Signe), nombre, dateCourte
    ├── textes/                feux, regimes, vigilance, verdict, explications (aucun texte généré ailleurs)
    ├── stockage/              projets.ts (Zod, lire/écrire/créer) ; ProjetsContext.tsx (provider + useProjets)
    ├── composants/ui.tsx      Carte, TitreCarte, GrosChiffre, Ligne, Pastille, Point, Pourquoi, Bouton
    ├── coque/                 AppLayout (grille 248 px + contenu), Sidebar, ProjetLayout (en-tête, onglets, contexte projet + résultats)
    └── ecrans/                MesProjets, Rapport, Bientot
tests/                          setup (jest-dom, cleanup, localStorage), formatage, textes, stockage, app (rendu + navigation)
```

## Flux

`localStorage` → `lireProjets` (Zod) → `ProjetsProvider` (état + écriture) → `Sidebar` / `MesProjets` → `ProjetLayout` (`calculerProjet` mémoïsé) → `Rapport` (lecture seule des `Resultats`).

## Patterns

- **Contexte + hook** pour les projets (`useProjets`) et pour le projet courant (`useProjetCourant`) : les écrans ne connaissent ni le stockage ni le moteur.
- **Textes centralisés** dans `src/textes/` : les codes du moteur (feux, vigilance, scénarios) deviennent des phrases ici et nulle part ailleurs.
- **Aucun calcul dans l'UI** : les composants formatent des valeurs de `Resultats`. La seule arithmétique est la conversion annuel → mensuel (`/ 12`) et le positionnement de la jauge.
- **Composants maison** en Tailwind avec les tokens du thème ; migration vers shadcn/ui possible sans changer les écrans.

## ADR locaux

- **ADR-W1** : projets stockés déjà validés (`ProjetSchema.parse`) : un stockage corrompu donne une liste vide plutôt qu'une erreur ; l'amorçage recrée l'exemple.
- **ADR-W2** : statut du projet dans l'enregistrement, pas dans le `Projet` du moteur (le moteur ignore le cycle de vie).
- **ADR-W3** : `AppEnMemoire` exporté depuis `App.tsx` pour tester l'arbre de routes réel plutôt que des composants isolés.
