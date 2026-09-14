# Architecture : Revente, un curseur d'horizon de 1 à 30 ans

Discovery : `../features/revente-curseur-discovery.md`. Specs : `../specs/revente-curseur-specs.md`. Socle : `web-socle.md`, `responsive.md` (ADR-007). État de la session : `../pipeline/revente-curseur.json`.

## Fichiers

```
apps/web/src/
├── composants/
│   └── Curseur.tsx                  Curseur générique : <input type="range"> contrôlé (useId), libellé et valeur formatée, repères gradués,
│                                    seuils (marque sur la piste + légende), aria-valuetext, clavier pris en main (flèches, Page, Début, Fin),
│                                    onChangement à chaque mouvement, onValidation au relâchement ; texte seul en mode document
├── index.css                        .curseur : piste, remplissage jusqu'au pouce (variable --curseur-part), pouce de 24 px, focus visible
├── analyses/
│   ├── revente.ts                   HORIZON_MIN / HORIZON_MAX (1 et 30, alignés sur ReventeSchema), projetAHorizon, variantesRevente (inchangée)
│   ├── plus-value.ts                impositionPlusValue(annees, regles) : abattements et taux global de l'année ; seuilsExoneration(regles, max)
│   └── index.ts                     exports
└── ecrans/
    ├── Revente.tsx                  état local du glissement (brouillon), résultats en direct sans scénarios, écriture différée, détail
    └── revente/Horizon.tsx          carte du curseur (Curseur + taux d'imposition + légende) et bandeau compact des quatre horizons
apps/web/tests/
├── curseur.test.tsx                 rendu, repères, seuils, glissement, clavier, bornes et pas, mode document
├── analyses.test.ts                 bornes, projetAHorizon, impositionPlusValue (valeurs de l'Excel), seuilsExoneration
├── onglets.test.tsx                 Revente : curseur, chiffres en direct, écriture au relâchement et à 150 ms, clavier, cartes
└── impression.test.tsx              document : « Revente dans N ans » en texte, cartes désactivées
apps/web/e2e/onglets.spec.ts         revente : clavier sur le curseur, carte « Dans 20 ans », Rapport
```

## Interfaces

```ts
// composants/Curseur.tsx
export interface SeuilCurseur {
  readonly valeur: number;
  readonly libelle: string;
}
export function Curseur(props: {
  libelle: string;
  valeur: number;
  min: number;
  max: number;
  pas?: number;
  formater: (valeur: number) => string; // « 12 ans »
  texteValeur?: (valeur: number) => string; // aria-valuetext, « Dans 12 ans » (défaut : formater)
  reperes?: readonly number[]; // graduations
  formaterRepere?: (valeur: number) => string; // défaut String
  seuils?: readonly SeuilCurseur[]; // marques + légende « 22 ans : plus d'impôt… »
  onChangement: (valeur: number) => void;
  onValidation?: (valeur: number) => void;
}): JSX.Element;

// analyses/revente.ts
export const HORIZON_MIN = 1;
export const HORIZON_MAX = 30;
export function projetAHorizon(projet: ProjetEntree, annees: number): ProjetEntree;

// analyses/plus-value.ts
export interface ImpositionPlusValue {
  annees;
  abattementIr;
  abattementPs;
  tauxGlobal;
}
export function impositionPlusValue(annees: number, regles: Regles): ImpositionPlusValue;
export function seuilsExoneration(
  regles: Regles,
  maxAnnees: number,
): { ir: number | null; ps: number | null };
```

## Flux

1. **Affichage** : `Revente` lit `annees` dans le projet enregistré ; `brouillon` (état local, `null` au repos) prime pendant le glissement : `horizon = brouillon ?? annees`.
2. **Glissement** : `Curseur.onChangement(v)` → `setBrouillon(v)` → les résultats affichés sont recalculés par `calculerProjet(projetAHorizon(projet, v), { avecScenarios: false })` (mémoïsé, ≈ 5 ms) ; le projet enregistré ne bouge pas.
3. **Écriture** : `Curseur.onValidation(v)` (relâchement du pointeur ou de la touche) ou, sinon, 150 ms après le dernier mouvement (`useEffect` + `setTimeout` sur `brouillon`) → `appliquerSaisie(projet, descripteur('hypotheses.revente.annees'), String(v))` → `mettreAJour` (Zod, stockage local, provenance « utilisateur ») → `setBrouillon(null)`. Les résultats complets (avec scénarios) reviennent par `FournisseurProjet` ; comme `annees` vaut désormais `v`, rien ne saute à l'écran.
4. **Cartes du bandeau** : clic → même écriture, immédiate. La carte dont l'horizon égale `horizon` est marquée `aria-pressed`.
5. **Taux d'imposition** : `impositionPlusValue(horizon, obtenirRegles(projet.versionRegles))` ; seuils : `seuilsExoneration(regles, HORIZON_MAX)` → `Curseur.seuils` (absents si les règles n'exonèrent jamais).
6. **Mode document** (impression, partage) : `Curseur` rend « Revente dans N ans » ; le taux reste affiché ; les cartes sont désactivées comme avant.

## Décisions

- **ADR-C1 : curseur natif stylé, clavier pris en main.** `<input type="range">` apporte le rôle, le toucher et `aria-valuetext` ; les styles `.curseur` (piste, remplissage, pouce) le rendent lisible dans Chrome, Firefox et Safari. Le clavier est traité par le composant (`onKeyDown` + `preventDefault`) : mêmes pas partout, Page = un dixième de l'étendue (au moins un pas), Début / Fin = bornes, testable dans jsdom. Le pointeur, lui, reste natif (`input` puis `change`).
- **ADR-C2 : l'écran décide quand écrire.** `Curseur` expose `onChangement` et `onValidation` ; l'onglet Revente garde un brouillon, recalcule en direct sans scénarios et n'écrit qu'au relâchement ou 150 ms après le dernier mouvement. La fiche 04 (négociation) pourra écrire autrement sans toucher au composant.
- **ADR-C3 : taux global et seuils dérivés des règles.** `analyses/plus-value.ts` combine `abattementsDetention`, `tauxIr` et `prelevementsSociaux.plusValue` de la version de règles du projet ; les seuils 22 et 30 ans sont la première année où l'abattement atteint 100 %. Aucun taux ni seuil n'est écrit dans le code du web ; testé contre les valeurs de l'Excel de Pierre.
- **ADR-C4 : les quatre cartes restent, compactes.** Bandeau sous le curseur, raccourcis et trajectoire d'un coup d'œil ; le curseur porte le détail. Pas de graphique en v1.
- **Repères et seuils** : bande de repères décalée d'une demi-largeur de pouce (12 px) de chaque côté pour tomber sous le centre du pouce ; les seuils sont des marques sans libellé sur la piste plus une légende sous les graduations (pas de chevauchement « 20 » / « 22 » sur téléphone).

## Ordre d'implémentation

1. US-1 `Curseur` + styles + `tests/curseur.test.tsx` → commit.
2. US-2 `analyses/revente.ts`, `analyses/plus-value.ts` + tests → commit.
3. US-3 `ecrans/revente/Horizon.tsx`, `ecrans/Revente.tsx`, tests d'écran, impression, e2e → vérification navigateur → commit.
4. US-4 docs communes, suite complète, couverture, PR.

## Auto-revue

- Le composant n'importe rien de la revente : bornes, formats et seuils viennent des props. Le seul lien avec le mode document est `useModeDocument`, comme `Bouton` et `Pourquoi`.
- Le brouillon ne survit pas à l'écriture : après `mettreAJour`, `annees` du projet vaut la valeur validée et `brouillon` repasse à `null` ; si l'écriture était refusée (impossible pour un entier de 1 à 30), l'écran reviendrait à l'ancienne valeur, sans état incohérent.
- Le test d'impression e2e mesure les deux premières grilles du volet Revente : la carte du curseur n'utilise pas `grid`, le bandeau reste la première grille à deux colonnes sur papier.
- Hors `ModeDocument`, `Revente.tsx` garde ses cartes de détail et sa plus-value à l'identique : les tests existants sur ces cartes passent sans modification.
