# Architecture — accueil-menu

Feature purement `apps/web`. Aucun appel réseau, aucun changement de moteur ni de schéma.

## Fichiers

| Fichier                                                                                 | Rôle                                                                                                                          |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/accueil/analyser.ts` (nouveau)                                                     | Pur : `estExempleIntact`, `resumeAnalyser(projets, { gerer })` → `{ vide, exemple, aEtudier, parEtape, meilleur, prochaine }` |
| `src/accueil/index.ts` (nouveau)                                                        | Réexports                                                                                                                     |
| `src/ecrans/Accueil.tsx` (nouveau)                                                      | Titre, grille une ou deux colonnes                                                                                            |
| `src/ecrans/accueil/BlocAnalyser.tsx` (nouveau)                                         | Bloc Analyser (vide / projets)                                                                                                |
| `src/ecrans/accueil/BlocGerer.tsx` (nouveau)                                            | Bloc Gérer (anonyme, chargement, erreur, vide, biens)                                                                         |
| `src/textes/accueil.ts` (nouveau)                                                       | Textes (tutoiement) et pluriels                                                                                               |
| `src/stockage/projets.ts`                                                               | `NOM_PROJET_EXEMPLE` ; `ProjetsContext` l'utilise                                                                             |
| `src/App.tsx`                                                                           | Route index → `<Accueil />`                                                                                                   |
| `src/coque/Sidebar.tsx`                                                                 | Lien Accueil sous le logo, logo → `/`                                                                                         |
| `src/coque/BarreApp.tsx`                                                                | Logo → `/`                                                                                                                    |
| `src/coque/SectionAnalyser.tsx`                                                         | 3 projets, « Tous mes projets · N » toujours, sans Comparer                                                                   |
| `src/coque/SectionGerer.tsx`                                                            | Libellé « Loyers du mois » (texte seulement)                                                                                  |
| `src/textes/gerer.ts`                                                                   | `PROJETS_DANS_LE_MENU = 3`, `accueil`, `loyersDuMois`, `comparer` retiré ; `TEXTES_MON_MENU` à trois choix                    |
| `src/gestion/menu.ts`                                                                   | `basculer`/`estFigee` remplacés par `CHOIX_MENU`, `choixDe`, `preferencesDe`                                                  |
| `src/ecrans/compte/MonMenu.tsx`                                                         | Groupe radio de trois choix                                                                                                   |
| `src/compte/saisie.ts`, `ecrans/Connexion.tsx`, `ecrans/Compte.tsx`, `coque/Profil.tsx` | Retours vers `/`                                                                                                              |

## Flux

```
ProjetsContext.projets ─▶ resumeAnalyser (calculerProjet sans scénarios, mémoïsé) ─▶ BlocAnalyser
GestionContext {statut, donnees, sections} ─▶ resumeDuMois (@loupe/gestion) ─▶ BlocGerer
GestionContext.sections ─▶ Accueil (colonnes) · Sidebar (sections)
```

## Règles de `resumeAnalyser`

- `exemple` = premier projet `estExempleIntact` (nom = `NOM_PROJET_EXEMPLE`, `creeLe === modifieLe`).
- `vide` = aucun projet hors exemple intact.
- `aEtudier` = statuts `analyse`, `visite`, `offre`, `scenario`.
- `parEtape` = compte des statuts `analyse`, `visite`, `offre`, `achete` (écartés et scénarios non affichés par étape).
- `meilleur` = parmi `aEtudier`, résultat `complet`, cash-flow mensuel le plus haut.
- `prochaine` = premier trouvé, par priorité : `achete` si `gerer` → `/gerer/pret/:id` ; `offre` → `/projets/:id/financement` ; `visite` et visite non faite → `/projets/:id/visite` ; `analyse` → `/projets/:id`. Dans chaque statut, le projet le plus récemment modifié. Sinon `null`.

Le calcul du moteur est injecté (`calculer`) pour garder la fonction testable sans moteur complet ; l'écran passe `calculerProjet`.

## Mise en page

- `Page espacement="large"` ; en-tête : `TitrePage` + `Chapo` selon les briques.
- Deux briques : `grid gap-4 lg:grid-cols-2 items-start` ; une : `max-w-[760px]`.
- Blocs = `Carte` avec `h2` « Analyser » / « Gérer » ; boutons `LienBouton` (44 px).

## Tests

- `tests/accueil-analyser.test.ts` : règles pures (vide, exemple intact/modifié, priorités, meilleur cash-flow, écartés).
- `tests/accueil-ecran.test.tsx` : deux briques, une brique, blocs vides, Gérer avec biens, sans compte, erreur + Réessayer.
- Mise à jour : `menu-sections`, `menu`, `coque-fixe`, `app`, `connexion`, `saisie`, `gestion-menu`, `gerer-accueil` si besoin.
- e2e : `coque.spec` (3 projets), `responsive.spec` (lien « Tous mes projets » au lieu de Comparer), `formats.ts` (page Accueil), nouveau `accueil.spec.ts` (logo → accueil → Nouveau projet).

## Ordre d'implémentation

US-1 menu (+ route) → US-2/3 Accueil et bloc Analyser → US-4 bloc Gérer → US-5 Mon compte et retours → e2e → docs.

## Auto-revue critique

- `resumeAnalyser` recalcule tous les projets : identique à Mes projets, acceptable jusqu'à quelques dizaines de projets ; mémoïsé sur la liste.
- Pas de nouvelle ADR : aucune décision non standard.
- `SectionGerer.tsx` ne change que par un texte importé : le fichier lui-même reste identique (`TEXTES_MENU.accueil` renommé en valeur), limitant le conflit avec la session Gérer.
