# S2 — `coque-menus` (fiches 12 et 18)

Branche `feat/coque-menus` · Prérequis : aucun · Règles : `_regles-nuit.md`

## Objectif

1. **Fiche 12** (`…\backlog\12-menu-analyser-mes-projets.md`, décisions prises) : ligne « Mes projets · N [+] » **en tête** de la section Analyser, avant les trois projets récents ; même ligne sans projet (« · 0 [+] ») ; **même principe dans Gérer** (« Mes biens · N [+] » remplace « Ajouter un bien »). Composant partagé `LigneAvecAjout`.
   - Gérer : si la page « Mes biens » (épic Gérer, étape G1c) **existe sur `master`** au moment de l'implémentation, le libellé y mène ; sinon livre Analyser et le statut, et note « Gérer à brancher quand Mes biens sera fusionnée » dans le rapport (pas de page inventée).
2. **Fiche 18** (`…\backlog\18-statut-menu-joli.md`) : menu du statut du projet sans `<select>` natif, aux couleurs de Deklic, ordre du parcours puis Scénario / Écarté séparés, clavier complet (motif WAI-ARIA listbox), feuille du bas sur téléphone. Vérifier d'abord ce que la PR #74 (« en-tête du projet, statut coloré, Acheté ouvre Gérer ») a déjà mis en place et partir de là. shadcn/ui `Select` s'il est déjà installé, sinon composant maison `composants/MenuChoix.tsx`.

## Périmètre

`apps/web/src/coque/{SectionAnalyser,SectionGerer,SelecteurStatut,liens}.tsx|ts`, nouveau `coque/LigneAvecAjout.tsx`, `composants/MenuChoix.tsx`, `textes/gerer.ts`, `textes/` du statut, tests `apps/web/tests/{menu-sections,coque-fixe,gestion-menu}…`, e2e `accueil.spec.ts`, `coque.spec.ts`, `aides.ts`.

## Hors périmètre

`ProjetLayout.tsx` au-delà du branchement du nouveau sélecteur, `BoutonPartager` (S10), formulaires (S3), écrans d'onglets.

## Fin

PR fusionnée ; rapport `C:\Users\errei\Claude\rapports-nuit\coque-menus.md`.
