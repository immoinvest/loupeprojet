# S9 — `liens-hypotheses` (fiche 17) — dernière session

Branche `feat/liens-hypotheses` · **Prérequis : `feat/formulaire-rapide`, `feat/impot-total-revente`, `feat/travaux-etat`, `feat/estimation-ventes`** · Règles : `_regles-nuit.md`

## Objectif

Chaque chiffre qui repose sur une hypothèse mène au champ exact où la changer (sur place si l'onglet l'affiche, sinon Hypothèses au bon champ), avec retour à l'onglet d'origine, effet affiché, lien partageable, et « Utilisé par » dans Hypothèses. Détail, cartographie des parcours et propositions : `C:\Users\errei\Claude\loupe-backlog\.product\backlog\17-liens-vers-hypotheses.md`.

- Session A et B de la fiche **dans cette session** : mécanique (`lienHypothese`, `OU_CHANGER`, ancres et mise en évidence dans Hypothèses, `BandeauRetour`, toast d'effet, `ValeurHypothese`) puis tous les onglets (Rapport, Fiscalité, Revente, Financement, Estimation, Visite, Comparer). Commence par relire les onglets **tels que les sessions de la nuit les ont laissés** sur `master`.

## En plus : clôture du backlog de la nuit

À la fin, dans la même PR, commit `docs(docs): backlog 12 à 23 — statuts après la nuit` :

- `.product/backlog/README.md` : ajouter / mettre à jour les lignes 12 à 23 depuis `C:\Users\errei\Claude\loupe-backlog\.product\backlog\README.md`, statut `livrée` pour chaque fiche dont la PR est fusionnée (vérifier avec `gh pr list --state merged --head feat/<branche>`), sinon le statut réel ;
- copier les fiches 12 à 23 absentes de `master` (celles d'une session bloquée) ;
- copier `C:\Users\errei\Claude\loupe-backlog\.product\sessions\nuit\` vers `.product/sessions/nuit/`.

## Périmètre

`apps/web/src/hypotheses/liens.ts`, `composants/ValeurHypothese.tsx`, `ecrans/Hypotheses.tsx`, `ecrans/hypotheses/*`, `coque/defilement.ts`, retouches d'affichage des chiffres dans les écrans d'onglets (aucun changement de calcul), tests, docs du backlog ci-dessus.

## Hors périmètre

Moteur, Worker, données.

## Fin

PR fusionnée ; rapport `C:\Users\errei\Claude\rapports-nuit\liens-hypotheses.md`, plus **`C:\Users\errei\Claude\rapports-nuit\00-synthese.md`** : un tableau de toutes les sessions (lu dans les autres rapports : PR, fusionnée ?, actions pour Pierre regroupées et ordonnées — déploiement du Worker une seule fois, migration D1, Action Référentiels, barème des travaux, domaine).
