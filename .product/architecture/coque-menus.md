# Architecture : coque-menus (fiches 12 et 18)

Specs : `../specs/coque-menus-specs.md`.

## Fichiers

| Fichier                                  | Rôle                                                                                                                                                      |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/coque/LigneAvecAjout.tsx`  | Nouveau. Ligne de menu à deux cibles : `NavLink` libellé (`end`) + `NavLink` carré « + » (44 px, `aria-label` et `title`). Ligne surlignée par `useMatch` |
| `apps/web/src/coque/liens.ts`            | Classes de la ligne (`classeLigneAvecAjout`, `classeLibelleLigne`, `classeAjout`)                                                                         |
| `apps/web/src/coque/SectionGerer.tsx`    | « Mes biens · N [+] » en tête (`end={false}` : la fiche d'un bien garde la ligne active), ajouté après la fusion de G1c                                   |
| `apps/web/src/coque/SectionAnalyser.tsx` | La ligne « Mes projets · N [+] » en tête, puis les trois récents ; plus de « Tous mes projets »                                                           |
| `apps/web/src/textes/gerer.ts`           | `TEXTES_MENU.mesProjets`, `mesProjets(n)` remplace `tousMesProjets(n)`                                                                                    |
| `apps/web/src/composants/menu-choix.ts`  | Nouveau, **pur** : `indexSuivant` (flèches, Début, Fin), `indexParLettre` (lettre tapée, accents ignorés), `placementListe` (dessous / dessus)            |
| `apps/web/src/composants/MenuChoix.tsx`  | Nouveau, générique : bouton `aria-haspopup="listbox"` + `ul[role=listbox]` (focus, `aria-activedescendant`), groupes séparés, feuille du bas sous 640 px  |
| `apps/web/src/textes/statut.ts`          | Nouveau : `ORDRE_STATUTS` (groupes parcours / à côté), `PRECISIONS_STATUT`, `TEXTES_STATUT`                                                               |
| `apps/web/src/coque/SelecteurStatut.tsx` | Pastille = contenu du bouton de `MenuChoix` ; options avec point de couleur ; chevron `print:hidden`                                                      |
| `apps/web/src/index.css`                 | Une animation `--animate-apparition` (100 ms) utilisée par `motion-safe:`                                                                                 |

`composants/menu-choix.ts` et `textes/statut.ts` sont sous des globs à 100 % (`textes/**`) ou testés à 100 % par `tests/menu-choix.test.ts`.

## Contrat de `MenuChoix`

```ts
type OptionChoix<T extends string> = { valeur: T; libelle: string; precision?: string };
props: {
  libelle: string;                         // nom de la liste (« Statut du projet »), lu avant la valeur
  valeur: T;
  groupes: readonly (readonly OptionChoix<T>[])[];  // séparateur entre deux groupes
  onChoix: (valeur: T) => void;            // jamais appelé pour la valeur déjà choisie
  classeBouton: string;
  contenuBouton: ReactNode;                // la pastille
  decorOption?: (valeur: T) => ReactNode;  // le point de couleur
}
```

Nom accessible du bouton : `aria-labelledby` = libellé (sr-only) + valeur affichée → « Statut du projet En analyse » ; `getByLabelText('Statut du projet')` et `getByLabel` le trouvent.

## Flux clavier

Bouton : Entrée / Espace (clic natif), flèche bas / haut → ouvre. Liste (focus sur l'`ul`, `tabIndex=-1`) : flèches, Début, Fin, lettre, Entrée / Espace (choisit), Échap (ferme, focus au bouton), Tab (ferme). `pointerdown` hors de la racine → ferme. L'option active défile en vue (`scrollIntoView` si disponible).

## Placement

À l'ouverture, `useLayoutEffect` mesure le bouton et la liste : `placementListe({ haut, bas }, hauteurListe, hauteurEcran)` → `dessus` seulement si la place manque dessous et qu'il y en a plus dessus. Sous 640 px, classes `max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0` et un voile `sm:hidden fixed inset-0` : l'en-tête est `sticky` sans transformation ni filtre, `fixed` n'est donc pas rogné.

## Survol

Bouton : `survol-pastille` (inchangé). Options : `role=option` hors de la liste des cliquables testés ; fond `accent-fond` pour l'option active (clavier et survol via `onPointerMove`, pas de `hover:` inventé). Ligne du menu : `survol-fond` sur chaque lien non actif, `survol-fond-fort` sur le « + » quand la ligne est surlignée.

## ADR

Aucun : composant maison prévu par la fiche 18 (shadcn/ui absent), pas de dépendance ajoutée.

## Ordre d'implémentation

US-1 (ligne) → US-2 (logique pure puis composant) → US-3 (statut, migration des tests) → docs.

## Auto-revue

Risque principal : `aria-activedescendant` avec focus sur la liste est bien restitué par NVDA/VoiceOver (motif APG « Select-Only Combobox » et « Listbox ») ; alternative écartée : focus sur chaque option (plus de gestion de `tabIndex`). La feuille du bas partage le même DOM que la liste accrochée (pas de portail) : un seul composant à tester.
