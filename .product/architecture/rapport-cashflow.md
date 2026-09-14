# Architecture : Rapport, icônes d'information et cash-flow au centre

Discovery : `../features/rapport-cashflow-discovery.md`. Specs : `../specs/rapport-cashflow-specs.md`. Maquettes : `../design/rapport-cashflow-maquettes.html` (disposition A). État : `../pipeline/rapport-cashflow.json`. Socle : `web-socle.md`, `responsive.md` (règles mobile et `print:`), `garder.md` (mode document).

## Fichiers

```
apps/web/src/
├── composants/
│   ├── info.tsx                     Info (bouton ⓘ 44 px + bulle role=tooltip ; paragraphe en mode document), decalageBulle (pur)
│   └── ui.tsx                       TitreCarte (titre + info à côté, action à droite ; empilés en mode document), LienOnglet (Link vers un volet, nul en mode document) ; Pourquoi retiré
├── analyses/rapport.ts              cascadeAutofinancement(r), multipleSurApport(r) : les seuls dérivés des résultats, purs
├── textes/explications.ts           EXPLICATIONS (fixes, page Méthode) + explicationPrix, explicationAutofinancement, explicationCouverture,
│                                    explicationEffort, explicationPointMort, explicationRendement(r, quel), explicationFiscalite, explicationRevente, explicationMultiple
├── ecrans/
│   ├── Rapport.tsx                  verdict, feux, CarteAutofinancement, [CartePrix | CarteRendements], Leviers, [CarteFiscalite | CarteRevente]
│   └── rapport/
│       ├── CarteAutofinancement.tsx cascade (Ligne × 8) + trois repères (Repere), tous avec Info
│       ├── CarteRendements.tsx      brut · net · net-net, sous-titres, Info par rendement, net coloré selon le feu
│       └── CartePrix.tsx            Info sur le titre, LienOnglet « Voir l'estimation »
apps/web/tests/
├── info.test.tsx                    Info (souris, clavier, Échap, clic dehors, une seule bulle, mode document), decalageBulle, LienOnglet
├── rapport-analyses.test.ts         cascade (exemple, courte durée, régime imposé), multiple (exemple, sans mise)
├── explications.test.ts             chaque fonction sur l'exemple et ses variantes (sans DVF, sans loyer, courte durée, cash-flow positif, sans mise)
└── rapport.test.tsx                 écran : cascade, repères, rendements, liens vers les onglets (href et navigation), multiple, document imprimé
apps/web/e2e/rapport.spec.ts         cascade, repères, rendements, bulle ouverte puis fermée par Échap, « Voir la fiscalité »
```

## Interfaces

```ts
// composants/info.tsx
export function Info({ sujet, texte }: { sujet: string; texte: string }): JSX.Element;
export function decalageBulle(gaucheBouton: number, largeurEcran: number): number;

// composants/ui.tsx
export function TitreCarte({
  children,
  info,
  action,
}: {
  children: ReactNode;
  info?: ReactNode;
  action?: ReactNode;
}): JSX.Element;
export type Volet = 'adresse' | 'hypotheses' | 'fiscalite' | 'revente' | 'visite';
export function LienOnglet({
  vers,
  children,
}: {
  vers: Volet;
  children: ReactNode;
}): JSX.Element | null;

// analyses/rapport.ts
export interface CascadeAutofinancement {
  readonly loyer: number; // loyers bruts ÷ 12 (recettes brutes en courte durée)
  readonly credit: number; // mensualité assurance comprise
  readonly apresCredit: number; // loyer − crédit
  readonly charges: number; // charges d'exploitation ÷ 12
  readonly vacance: number; // perte de vacance ÷ 12 (0 en courte durée)
  readonly fraisCourteDuree: number; // (ménage + conciergerie) ÷ 12, 0 sinon
  readonly apresCharges: number; // = r.cashflow.mensuel (reste chaque mois, avant impôt)
  readonly impot: number; // impôt total du régime retenu ÷ années ÷ 12
  readonly apresImpot: number; // apresCharges − impot
}
export function cascadeAutofinancement(r: Resultats): CascadeAutofinancement;
export function multipleSurApport(r: Resultats): number | null; // enrichissement.total ÷ miseDeDepart ; null si mise ≤ 0

// textes/explications.ts
export const EXPLICATIONS: { prix; cashflow; fiscalite; revente; leviers }; // inchangé, résumés de la page Méthode
export function explicationPrix(r: Resultats): string; // avec ou sans DVF, avec ou sans estimation
export function explicationAutofinancement(r: Resultats): string; // cascade chiffrée, régime et période
export function explicationCouverture(r: Resultats): string; // mensualité, part du loyer ; sans loyer : phrase de repli
export function explicationEffort(r: Resultats): string; // effort d'épargne ou excédent, par mois et par an
export function explicationPointMort(r: Resultats): string; // loyer d'équilibre vs loyer visé ; courte durée : repli
export function explicationRendement(r: Resultats, quel: 'brut' | 'net' | 'netNet'): string;
export function explicationFiscalite(r: Resultats): string; // impôt du régime retenu, le moins cher des autres
export function explicationRevente(r: Resultats): string; // valeur, frais, CRD, IRA, impôt de plus-value, net vendeur
export function explicationMultiple(r: Resultats): string; // gain ÷ mise ; sans mise : repli
```

## Composant Info

- **Rendu** : `<span class="relative inline-flex">` contenant un `<button type="button">` de 44 × 44 px (marges négatives de 10 px pour ne pas épaissir la ligne du titre ; l'icône `lucide-react` `Info` fait 20 px) et un `<span role="tooltip" id hidden>` absolu sous le bouton, largeur `min(320px, 100vw − 2rem)`, `z-10` (sous la barre d'app `z-20`, au-dessus des cartes voisines).
- **Attributs** : `aria-label="Explication : <sujet>"`, `aria-expanded`, `aria-controls` et `aria-describedby` vers la bulle. Le texte de la bulle reste dans le DOM quand elle est fermée (`hidden`) : la description accessible est toujours calculable.
- **Ouverture** : clic (bascule) et focus clavier. `onMouseDown` empêche la prise de focus au clic : sinon le focus ouvrirait puis le clic refermerait.
- **Fermeture** : Échap (écouteur `keydown` sur le document), `pointerdown` hors du composant (donc aussi sur une autre icône : une seule bulle ouverte à la fois), perte du focus.
- **Position** : à l'ouverture, `decalageBulle(gaucheBouton, largeurEcran)` calcule le décalage horizontal pour que la bulle tienne entre 16 px des deux bords (alignée sur le bouton quand la place suffit, ramenée vers la gauche sinon, largeur réduite sur les écrans de moins de 352 px). Fonction pure, testée ; en jsdom (rectangles nuls) elle rend 16 px.
- **Mode document** : `<p class="m-0 text-sm leading-relaxed text-encre-2">` avec le texte, rien d'autre ; `TitreCarte` l'empile sous le titre.
- **Pas de `popover` natif** (ADR-R1 ci-dessous).

## Flux

`useProjetCourant()` → `Resultats` → `cascadeAutofinancement(r)` et `multipleSurApport(r)` (mémoïsés par `useMemo` sur `r`) → cartes ; chaque `Info` reçoit `explication…(r)` déjà formaté. Les liens `LienOnglet` sont relatifs à la route `projets/:id` (`to="fiscalite"` depuis la route index donne `/projets/:id/fiscalite`).

## Décisions

- **ADR-R1 : bulle absolue, pas de `popover`.** jsdom 27 n'implémente pas `showPopover` et la couche supérieure demanderait un positionnement par ancrage CSS (inégal) ou un calcul en `position: fixed` à maintenir au défilement. Une bulle absolue sous l'icône, avec un décalage calculé une fois à l'ouverture, se teste en jsdom et se comporte pareil partout. Réversible.
- **ADR-R2 : « Reste chaque mois » avant impôt.** Même chiffre que le feu, le verdict, Comparer et les scénarios ; « Après l'impôt » vient dessous avec l'impôt mensuel moyen du régime retenu sur la période (impôt total ÷ années ÷ 12), étiqueté.
- **ADR-R3 : le taux de couverture s'affiche tel que le moteur le définit** (mensualité ÷ loyer, glossaire de CLAUDE.md) sous le libellé « Part du loyer prise par le crédit » ; pas d'inverse, pas de nouveau dérivé.
- **ADR-R4 : dérivés dans `analyses/rapport.ts`**, jamais dans les écrans ; la cascade est vérifiée par test comme égale à `r.cashflow.mensuel` (longue et courte durée).
- **ADR-R5 : `EXPLICATIONS` fixes conservées** pour la page Méthode ; les fonctions chiffrées s'y ajoutent. `Pourquoi` est supprimé : plus aucun `<details>` qui ressemble à un lien.
- **Liens en bas de carte** (`mt-auto`), pas dans le titre : le titre reste une question courte suivie de son ⓘ, la carte se termine par l'action.

## Ordre d'implémentation (un commit par story)

1. US-1 : `composants/info.tsx`, `LienOnglet` et `TitreCarte` dans `ui.tsx` (Pourquoi conservé jusqu'à US-4), `tests/info.test.tsx`.
2. US-2 : `analyses/rapport.ts`, fonctions de `textes/explications.ts`, tests à 100 %.
3. US-3 : `rapport/CarteAutofinancement.tsx`, `rapport/CarteRendements.tsx`, disposition A dans `Rapport.tsx`, `tests/rapport.test.tsx`, adaptation de `app.test.tsx`.
4. US-4 : `CartePrix`, `CarteFiscalite`, `CarteRevente` (Info, LienOnglet, multiple), retrait de `Pourquoi`, tests d'écran et d'impression.
5. US-5 : `e2e/rapport.spec.ts`, vérification navigateur, docs, fusion de `master`, PR.

## Auto-revue

- Le bouton ⓘ est frère du `h2`, jamais enfant : le nom accessible des titres ne change pas ; l'aide e2e `carte(page, titre)` continue de trouver les cartes.
- Les marges négatives du bouton (−10 px) gardent une cible de 44 px mesurée par `getBoundingClientRect`, ce que vérifie la spec des formats ; la bulle ne peut pas déborder de l'écran grâce à `decalageBulle`.
- `explicationRendement('netNet')` lit les intérêts et l'assurance de l'année 1 dans `r.financement.parAnnee` et l'impôt de l'année 1 dans `r.fiscalite.regimes[retenu].annees` : ce sont les entrées exactes du moteur (`rendement/index.ts`), pas une reconstruction.
- Le document imprimé gagne une dizaine de phrases courtes (une par ⓘ) ; elles sont en petit corps gris, et les cartes restent insécables (`break-inside: avoid`).
