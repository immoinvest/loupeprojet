# Fiche de session — `garder` : PDF, partage, Comparer, Méthode

Tronc commun : `.product/sessions/_commun.md` (contexte, autorisations, règles de travail en parallèle, gates).

## Objectif

Terminer le tour de l'application côté web : un PDF propre, un lien de partage sans compte, la page **Comparer** (plusieurs projets côte à côte) et la page **Comment c'est calculé** (chaque formule, chaque source, chaque hypothèse par défaut). Ces trois pages affichent aujourd'hui un état « bientôt » (`apps/web/src/App.tsx`, composant `Bientot`).

## Ce qui existe déjà

- Coque, écrans et onglets : `apps/web/src/coque/`, `apps/web/src/ecrans/` (Rapport, Hypothèses, Fiscalité, Revente, Visite, MesProjets, NouveauProjet). Direction visuelle « Le guide » (ADR-004) : tokens dans `apps/web/src/index.css`, composants dans `apps/web/src/composants/ui.tsx`.
- Textes : `apps/web/src/textes/` (feux, régimes, vigilance, verdict, `explications.ts`). Le moteur expose `obtenirRegles()` (toutes les constantes datées, `aConfirmer`, `simplifications`) et `calculerProjet`.
- Stockage local : `apps/web/src/stockage/projets.ts` (`ProjetEnregistreSchema`, `lireProjets`, `ecrireProjets`) et `ProjetsContext.tsx`.
- Le bouton « PDF » de l'en-tête projet appelle `window.print()` ; le bouton « Partager » est désactivé.

## Périmètre (une story chacune)

1. **Impression** : route `/projets/:id/imprimer` qui empile Rapport, Fiscalité, Revente et Visite avec des sauts de page, en-tête (nom du projet, date, version des règles) et pied de page (« outil d'aide à la décision, pas un conseil »), styles `@media print` dans `index.css` (barre latérale et onglets masqués). Le bouton PDF ouvre cette route puis imprime.
2. **Partage sans compte** : `apps/web/src/stockage/partage.ts` (`encoderPartage`/`decoderPartage` : le `ProjetEnregistre` en base64url dans un fragment d'URL, jamais envoyé au serveur ; validation Zod au décodage) et route `/partage#p=…` en lecture seule avec un bandeau « Projet partagé — l'ajouter à mes projets ». Le bouton Partager copie le lien.
3. **Comparer** (`/comparer`) : choix de 2 à 5 projets, tableau côte à côte (prix, prix au m², loyer, cash-flow mensuel, rendement brut et net, effort, impôt du régime retenu, cash net à la revente, TRI, enrichissement) avec les feux ; tri par colonne ; lien vers chaque projet. Calculs par `calculerProjet` uniquement.
4. **Méthode** (`/methode`) : la page « comment c'est calculé » générée depuis `obtenirRegles()`, `EXPLICATIONS` et les `meta.simplifications` / `meta.aConfirmer` d'un calcul : une section par module (frais d'acquisition, crédit, cash-flow, chaque régime, plus-value, TRI, verdict), en français simple, avec la source de chaque constante et la date des règles. Textes dans `apps/web/src/textes/methode.ts`.

## Fichiers concernés

`apps/web/src/ecrans/{Imprimer,Partage,Comparer,Methode}.tsx`, `apps/web/src/App.tsx` (routes), `apps/web/src/coque/ProjetLayout.tsx` (boutons PDF / Partager), `apps/web/src/index.css` (print), `apps/web/src/stockage/partage.ts`, `apps/web/src/textes/methode.ts`, tests dans `apps/web/tests/` (rendu via `AppEnMemoire`, 100 % sur `stockage/` et `textes/`).

## Hors périmètre (ne pas toucher)

`apps/web/src/ecrans/NouveauProjet.tsx`, `apps/web/src/annonces/` (session extension), `apps/worker`, `packages/moteur`, tout backend (le partage v1 est dans l'URL ; les comptes et D1 viendront en v1.5).

## Points d'attention

- Moins de texte, plus de chiffres (direction « Le guide ») ; jamais de phrase générée : codes → textes.
- Une URL de partage peut être longue (quelques Ko) : tester avec un projet complet ; refuser proprement une URL corrompue.
- L'impression doit rester lisible en noir et blanc (les feux ont un libellé, pas seulement une couleur).
