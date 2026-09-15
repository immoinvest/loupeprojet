# Architecture : Coque fixe

Discovery : `../features/coque-fixe-discovery.md`. Specs : `../specs/coque-fixe-specs.md`. État de la session : `../pipeline/coque-fixe.json`. Fiche d'origine : `../backlog/11-coque-menu-entete-fixes.md`.

## 1. Existant réutilisé

| Existant                                                                                 | Réutilisation                                                                                                    |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `AppLayout`, `Sidebar`, `BarreApp`, `useMenu` (feature `responsive`)                     | Même DOM ; seules les classes de la coque changent. Le tiroir, ses gestes et `menu.test.tsx` restent tels quels. |
| `useMenu().contenuRef` (le `main`)                                                       | Sert aussi au retour en haut : le hook qui remet `scrollTop` à 0 lit la même référence.                          |
| `ProjetLayout` : `EnTete`, `useOngletActifEnVue`, `BANDE_ONGLETS`, `BoutonPartager`      | L'en-tête devient collant et compact ; la bande des volets et son défilement horizontal sont conservés.          |
| `Synthese` d'Hypothèses (`sticky`)                                                       | Change seulement de `top` : `var(--hauteur-entete-projet, 0px)`.                                                 |
| `MARGES_LATERALES` (`mise-en-page.tsx`)                                                  | Marges de l'en-tête inchangées.                                                                                  |
| `e2e/aides.ts`, `e2e/formats.ts`, projets Playwright `ordinateur`/`telephone`/`tablette` | Nouveau parcours `coque.spec.ts` sur les trois appareils ; `mesurer` étendu au conteneur `main`.                 |
| Tests de rendu par `AppEnMemoire`                                                        | `coque-fixe.test.tsx` rend l'application en mémoire, simule `ResizeObserver`.                                    |

Conflits attendus (sessions parallèles) : `Sidebar.tsx` (rubrique « Outils » du simulateur de prêt), `ProjetLayout.tsx` (onglet Financement). Les deux sessions ajoutent des entrées ; cette feature change la structure autour : garder les deux côtés à la fusion.

## 2. Fichiers

### À créer

```
apps/web/src/coque/entete.ts          fonctions pures des mesures de l'en-tête : lireDecalage(topCalcule), hauteurCollee(hauteur, top), variablesEnTete(mesures) → { '--decalage-entete', '--hauteur-entete-projet' }
apps/web/src/coque/contenu.ts         useRetourEnHaut(contenuRef) : scrollTop = 0 à chaque changement de pathname (useLayoutEffect)
apps/web/tests/coque-fixe.test.tsx    coque (classes de défilement), retour en haut, zones du menu, en-tête (ResizeObserver simulé), fonctions de entete.ts
apps/web/e2e/coque.spec.ts            menu et en-tête en vue après un long défilement, retour en haut, 30 projets et profil visible, fenêtre à 0
```

### À modifier

```
apps/web/src/index.css                token --largeur-menu (14rem) ; scroll-padding-top retiré de html (le document ne défile plus) ; body min-height 100dvh ; commentaire de --hauteur-barre-app
apps/web/src/coque/AppLayout.tsx      racine flex h-dvh overflow-hidden, grille lg:[var(--largeur-menu)_1fr] lg:grid-rows-[minmax(0,1fr)] ; main min-h-0 flex-1 overflow-y-auto ; useRetourEnHaut ; print:
apps/web/src/coque/BarreApp.tsx       plus sticky (elle est hors du conteneur qui défile) ; fond plein
apps/web/src/coque/Sidebar.tsx        trois zones : haut (logo, Nouveau projet), milieu overflow-y-auto (Mes projets, Comparer), bas (Outils, Profil ; l'extension et l'installation sont dans Mon compte depuis le 15/09/2026) ; overflow-hidden, marges resserrées
apps/web/src/coque/ProjetLayout.tsx   cadre <div> du projet portant les variables ; en-tête sticky compact (rangées de 48 / 44 px, une rangée de 56 px à 2xl) ; useMesuresEnTete (ResizeObserver) ; sous md, top négatif
apps/web/src/ecrans/Hypotheses.tsx    Synthese : top-[var(--hauteur-entete-projet,0px)]
apps/web/e2e/formats.ts               mesurer : débordement = max(document, main) ; main n'excuse pas un élément qui déborde
docs : README, CLAUDE.md, features-registry, architecture-overview, technical-spec (coque), backlog 11 et README du backlog
```

Taille : `ProjetLayout.tsx` reste sous 300 lignes (les mesures partent dans `entete.ts`, le hook de retour en haut dans `contenu.ts`).

## 3. Patterns

- **Coque application** : un seul conteneur de défilement (`main`). La racine est `h-dvh overflow-hidden` ; sous `lg`, une colonne flex (barre d'app, `main`) ; à partir de `lg`, une grille `[var(--largeur-menu)_minmax(0,1fr)]` avec `grid-rows-[minmax(0,1fr)]` pour que la rangée ne dépasse jamais la fenêtre. Les enfants portent `min-h-0`.
- **Mesure → variables CSS, jamais de mise en page en JavaScript** : le `ResizeObserver` publie deux variables sur le cadre du projet ; le CSS décide par point de rupture (`top-[calc(-1*var(--decalage-entete,0px))] md:top-0`). La hauteur collée se déduit du `top` **calculé** de l'en-tête (`getComputedStyle`), donc sans lire de largeur d'écran.
- **Fonctions pures aux frontières** : `entete.ts` (lecture d'un `top` calculé, hauteur collée, variables à publier) est testé sans navigateur ; le hook n'est que de la colle.
- **Défaut sûr** : sans `ResizeObserver` (jsdom, vieux navigateur), aucune variable : l'en-tête reste collé en haut et la synthèse à `0px` (elle passe sous l'en-tête, jamais par-dessus, grâce au `z-index`).
- **Mobile d'abord** (règle CLAUDE.md) : base téléphone, `md`, `lg`, `2xl` élargissent ; `print:` sur chaque changement de mise en page (`print:h-auto print:overflow-visible print:static print:block`).

## 4. Flux

### Défilement et retour en haut

```
AppLayout (h-dvh overflow-hidden)
├── BarreApp (< lg)                      hauteur fixe, hors défilement
├── Sidebar (aside)                      < lg : tiroir fixe ; ≥ lg : colonne de la grille, h-full, overflow-hidden
│   ├── haut     logo, Nouveau projet
│   ├── milieu   overflow-y-auto : Mes projets, Comparer      ← seule zone qui défile
│   └── bas      Outils, Profil (extension et installation : Mon compte)
└── main (min-h-0 flex-1 overflow-y-auto, ref = contenuRef)
    └── Outlet
        └── ProjetLayout : <div data-cadre-projet style={--decalage-entete, --hauteur-entete-projet}>
            ├── <header sticky top-[calc(-1*var(--decalage-entete,0px))] md:top-0 z-20>
            └── <Outlet> (Hypothèses : Synthese sticky top-[var(--hauteur-entete-projet,0px)] z-10)

useRetourEnHaut(contenuRef) : useLocation().pathname change → useLayoutEffect → main.scrollTop = 0
```

### Mesures de l'en-tête

```
useMesuresEnTete(cadreRef, enTeteRef, bandeRef)
  useLayoutEffect : ResizeObserver absent → rien
  observateur.observe(enTete) → à chaque taille :
    cadre.style['--decalage-entete'] = `${bande.offsetTop}px`
    top = lireDecalage(getComputedStyle(enTete).top)           // '-122px' → -122 ; '' | 'auto' → 0
    cadre.style['--hauteur-entete-projet'] = `${hauteurCollee(enTete.offsetHeight, top)}px`   // max(0, hauteur + top)
```

Sous 768 px : `top` calculé = −`offsetTop` de la bande → seule la bande (44 px) reste en vue ; hauteur collée = 44. À partir de 768 px : `top` = 0 → tout l'en-tête est collé ; hauteur collée = sa hauteur (≈ 93 px ; 57 px à partir de 1 536 px).

### En-tête compact

```
< 768 px      [Mes projets / Nom]        (2 lignes : fil d'Ariane et nom, prix · mode)
              [statut] [PDF] [Partager]  (passent à la ligne à 320 px)
              [Rapport | Estimation | Hypothèses | Fiscalité | Revente | Visite]   bande défilante, seule collée
768–1 535 px  [Mes projets / Nom · prix · mode ..................... statut PDF Partager]   48 px
              [volets]                                                                44 px
≥ 1 536 px    [Mes projets / Nom · prix · mode]  [volets]  [statut PDF Partager]          56 px
```

## 5. Décisions locales

- **ADR-C1 : coque application, pas `sticky` sur le document.** Un seul conteneur de défilement rend prévisibles le retour en haut, les éléments collés (en-tête, synthèse) et le tiroir. Écarté : `aside sticky top-0 h-screen` + en-tête `sticky` dans le document (deux comportements de défilement à raisonner, retour en haut par `window.scrollTo` qui remonte aussi la barre d'app sur téléphone).
- **ADR-C2 : sur téléphone, seule la bande des volets reste collée**, par un `top` négatif mesuré (`offsetTop` de la bande). Écarté : dupliquer la bande hors de l'en-tête (liens en double pour les lecteurs d'écran et pour les sélecteurs des tests) ; figer tout l'en-tête (150 px sur un écran de 667 px).
- **ADR-C3 : la hauteur collée vient du `top` calculé**, pas d'une requête média en JavaScript : les points de rupture restent en CSS (règle de `responsive`). Sans `ResizeObserver`, rien n'est publié et les valeurs par défaut (`0px`) restent sûres.
- **ADR-C4 : retour en haut au changement de `pathname` seulement.** Un `replace` vers le même chemin (nettoyage d'un fragment ou de paramètres par Nouveau projet) ne bouge pas ; le retour arrière ne restaure pas la position (hors périmètre).
- **ADR-C5 : la spec des formats mesure `main`.** Un conteneur `overflow-y-auto` coupe aussi horizontalement ; sans cette adaptation, la mesure du débordement serait aveugle. `main` est traité comme la page : `débordement = max(document, main)`, et un ancêtre `main` n'excuse pas un élément qui déborde.
- **ADR-C6 : 224 px** (`--largeur-menu: 14rem`) : marges intérieures resserrées (12 px), libellés inchangés, mesuré à l'écran.

## 6. Cas limites

| Module             | Cas                                                                                                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entete.ts`        | `top` calculé vide, `auto`, `0px`, `-122px`, `-122.5px` ; hauteur 0 ; `top` plus négatif que la hauteur (→ 0)                                                                                             |
| `useMesuresEnTete` | `ResizeObserver` absent ; références nulles ; démontage (déconnexion) ; changement de projet (nouvelles références)                                                                                       |
| `useRetourEnHaut`  | référence nulle ; même `pathname` avec nouveau `key` (pas de retour) ; premier rendu (scrollTop déjà 0)                                                                                                   |
| Menu               | 0 projet ; 30 projets (zone du milieu défile, profil fixe) ; nom très long (troncature) ; « Installer l'application » présent ou non                                                                      |
| En-tête            | nom très long à 768 px (troncature avant le prix) ; actions à 320 px (deux lignes, décalage mesuré) ; volet Visite ouvert directement (bande défilée) ; mode document (en-tête absent)                    |
| Coque              | page hors coque (Connexion, Imprimer : inchangées) ; impression depuis la coque (`print:` : hauteur automatique, débordement visible) ; tiroir ouvert (`main` inerte, `html` figé, sans effet sur `main`) |

## 7. Ordre d'implémentation (un commit par étape)

1. Docs : discovery, specs, architecture, `pipeline/coque-fixe.json`
2. US-1 : `index.css`, `AppLayout`, `BarreApp`, `Sidebar`, `contenu.ts`, tests (coque, retour en haut, zones du menu)
3. US-2 : `entete.ts`, `ProjetLayout` (en-tête compact et collé), `Hypotheses` (synthèse), tests (mesures, variables)
4. US-3 : `e2e/coque.spec.ts`, `e2e/formats.ts` ; suite Playwright sur les trois appareils et les formats
5. US-4 : docs communes, fiche 11 et tableau du backlog
