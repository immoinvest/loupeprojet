# Architecture : liens vers les hypothèses (fiche 17)

Discovery : `../features/liens-hypotheses-discovery.md`. Specs : `../specs/liens-hypotheses-specs.md`. État : `../pipeline/liens-hypotheses.json`. Socle : `coque-fixe.md` (seul `main` défile, en-tête collé), `rapport-cashflow.md` (`LienOnglet`), `garder.md` (mode document).

## Fichiers

```
apps/web/src/
├── hypotheses/
│   ├── liens.ts            VOLETS, CHIFFRES_PAR_VOLET, CHIFFRES_COMPARER, type CheminLie, voletPour, utilisePar,
│   │                       lienHypothese, cheminDepuisFragment, origineDepuisChemin, lireDepuis, voletDeRepli (pur)
│   └── effet.ts            indicateursLies, effetsDe (avant/après sur 2 indicateurs), EffetModification (pur)
├── textes/liens.ts         LIBELLES_ORIGINE, TEXTES_LIENS (revenir, utilisé par, modifier), phraseEffet
├── coque/
│   ├── defilement.ts       + defilementPourCentrer (champ centré sous les éléments collés), positionAuRetour
│   ├── contenu.ts          useRetourEnHaut : mémorise la position par entrée d'historique, la rend au retour (POP)
│   ├── champ-cible.ts      montrerChamp(document, chemin) ; useChampCible() : fragment → défilement, focus, mise en évidence, repli
│   └── ProjetLayout.tsx    useChampCible, <RetourEtEffet /> sous l'en-tête ; data-colle sur l'en-tête
├── composants/ValeurHypothese.tsx   lien (saut ou sur place), crayon au survol, texte seul en mode document
├── ecrans/hypotheses/
│   ├── Retour.tsx          RetourEtEffet : bandeau « Revenir à … » + message d'effet (role=status)
│   ├── UtilisePar.tsx      « Utilisé par : Rapport · Fiscalité »
│   ├── ChampHypothese.tsx  data-champ={chemin} ; prop utilisePar
│   ├── GrilleHypotheses.tsx  rendre() passe « Utilisé par » (Hypothèses et Financement)
│   └── CarteAchat.tsx      dépliant des travaux ouvert quand le fragment vise un de ses champs
├── ecrans/Hypotheses.tsx   data-colle sur la synthèse collée
└── index.css               .mise-en-evidence (anneau accent 2 s ; statique si mouvement réduit)
écrans retouchés (affichage seulement) : rapport/CarteAutofinancement, rapport/CartePrix, Rapport (fiscalité, revente),
Fiscalite, Revente, revente/Horizon (data-champ), financement/Cartes, adresse/Estimation, Visite, Comparer,
projet/AnalyseIncomplete, gerer/PretAGerer
```

## Interfaces

```ts
// hypotheses/liens.ts
export const VOLETS = ['rapport','adresse','financement','hypotheses','fiscalite','revente','visite'] as const;
export type Volet = (typeof VOLETS)[number];
export type Origine = Volet | 'comparer';
export const CHIFFRES_PAR_VOLET: { readonly [V in Volet]: readonly string[] } (as const);
export const CHIFFRES_COMPARER: readonly string[] (as const);
export type CheminLie = (typeof CHIFFRES_PAR_VOLET)[Volet][number] | (typeof CHIFFRES_COMPARER)[number];
export function voletPour(chemin: string): Volet;             // financement pour le prêt, revente pour l'horizon, hypotheses sinon
export function segmentDe(volet: Volet): string;              // rapport → ''
export function utilisePar(chemin: string): readonly Volet[]; // table inverse, ordre de la bande
export interface Depuis { readonly pathname: string; readonly origine: Origine; readonly chemin: string }
export function lienHypothese(projetId: string, chemin: string, origine?: { pathname: string; origine: Origine }):
  { readonly pathname: string; readonly hash: string; readonly state: { depuis: Depuis } | null };
export function cheminDepuisFragment(hash: string): string | null;  // décodé, descripteur connu, sinon null
export function origineDepuisChemin(pathname: string): Origine | null;
export function lireDepuis(state: unknown): Depuis | null;
export function voletDeRepli(chemin: string, courant: Volet): Volet | null; // hypotheses si le champ y vit et qu'on n'y est pas

// hypotheses/effet.ts
export type CodeIndicateurLie = 'cashflow' | 'rendementNet' | 'mensualite' | 'impot' | 'cashNet' | 'tri' | 'coutTotal' | 'prixEstime';
export function indicateursLies(chemin: string): readonly CodeIndicateurLie[];
export interface EffetIndicateur { readonly code; readonly libelle: string; readonly avant: string; readonly apres: string }
export interface EffetModification { readonly libelle: string; readonly avant: string; readonly apres: string; readonly indicateurs: readonly EffetIndicateur[] }
export function effetsDe(avant: Resultats, apres: Resultats, chemin: string): EffetModification | null; // null si rien n'a changé

// coque/defilement.ts
export function defilementPourCentrer(champ: { haut: number; hauteur: number }, contenu: { defilement: number; hauteurVisible: number }, masque: number): number;
export function positionAuRetour(navigation: 'POP'|'PUSH'|'REPLACE', memorisee: number | undefined): number;
```

## Flux

1. `ValeurHypothese({ chemin, children: string, projetId? })` : `lienHypothese(projet, chemin, origine courante)` → `<Link to state>`. Au clic (sans touche de modification, même projet), si `montrerChamp(document, chemin)` trouve le champ dans la page, `preventDefault` : sur place.
2. Destination : `useRetourEnHaut` remet en haut (PUSH) ; `useChampCible` lit le fragment, cherche `[data-champ]`, défile `main` (`defilementPourCentrer`, masque = bas des `[data-colle]`), focus (`preventScroll`), classe `mise-en-evidence` 2 s ; introuvable après une image → `voletDeRepli` → `navigate(replace)` vers Hypothèses au même fragment et même état.
3. `RetourEtEffet` (clé = `location.key`) : `lireDepuis(state)` ; photo des résultats à l'arrivée ; à chaque recalcul, `effetsDe(photo, résultats, chemin)` → message ; « Revenir à … » = `navigate(-1)` (POP : la position mémorisée revient), ou l'adresse d'origine si l'historique est vide.
4. « Utilisé par » : `utilisePar(chemin)` → liens vers les onglets (relatifs au projet).

## Décisions

- **ADR-L1 : texte visible inchangé, nom accessible par `aria-label`** (« 980 € — modifier Loyer visé, hors charges ») : les tests et le document lisent le même texte.
- **ADR-L2 : `data-champ` plutôt qu'un `id`** : un chemin contient des points (échappement CSS) et le même champ peut apparaître deux fois (Fiscalité : carte de la tranche) ; le premier trouvé gagne.
- **ADR-L3 : retour par l'historique**, position mémorisée par `location.key` dans un `Map` en mémoire : rien de persistant, le bouton précédent du navigateur fait la même chose que le bandeau.
- **ADR-L4 : types liés aux tables** (`CheminLie`) : un `ValeurHypothese` vers un chemin absent des tables ne compile pas ; un test vérifie que chaque chemin a un descripteur. « Utilisé par » ne peut donc pas oublier un onglet qui affiche le chiffre.
- **ADR-L5 : message d'effet seulement après un saut** : sans origine, l'utilisateur qui règle Hypothèses voit déjà la synthèse recalculée.

## Ordre d'implémentation (un commit par story)

US-1 liens.ts + textes → US-2 défilement, champ-cible, data-champ, CSS, CarteAchat, contenu.ts → US-3 ValeurHypothese → US-4 effet.ts + Retour.tsx → US-5 Utilisé par → US-6 Rapport + Fiscalité → US-7 autres onglets → US-8 e2e, docs, backlog.

## Auto-revue

- `useChampCible` dans `ProjetLayout` sert tous les onglets du projet (Financement, Revente, Estimation) sans code par écran.
- Le repli évite l'impasse « Revente sans loyer » ; un champ masqué par le type de location n'est jamais lié puisque le Rapport choisit le chemin du loyer selon le type (`champLoyer`).
- Le masque de l'en-tête est mesuré (`[data-colle]`) plutôt que lu dans les variables CSS : la synthèse collée d'Hypothèses est comptée aussi.
- Risque : cibles de 44 px au doigt dans les lignes (`Ligne`) → `pointer-coarse:min-h-11` ; vérifié par la spec des formats.
