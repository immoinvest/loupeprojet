# 08 — Simulateur de prêt : un outil indépendant des projets

Statut : `spécifiée` (Pierre l'a avancée le 14/09/2026 : « ajoute un simulateur de prêt qui ressemble à ce qu'il y avait ») · Notée le 14/09/2026 · La fiche 01 y mène par un bouton

Documents prêts pour l'implémentation : discovery `.product/features/simulateur-pret-discovery.md`, specs `.product/specs/simulateur-pret-specs.md` (8 stories), architecture `.product/architecture/simulateur-pret.md`, état `.product/pipeline/simulateur-pret.json`.

## La demande de Pierre

> Un bouton qui redirigera vers une simulation de prêt, qui est un outil indépendant d'un projet en particulier, même si pour l'instant on ne va pas développer l'outil.

## Ce qui existe aujourd'hui

- L'ancien simulateur de comparaison de prêts (webpack, `src/`) a été supprimé le 13/09/2026 ; sa logique d'**amortissement avec différés** vit dans `packages/moteur/src/financement/amortissement.ts`, testée. Le module financement du moteur calcule aussi mensualité, assurance, TAEG (résolu numériquement, frais de dossier et garantie inclus), coût total, IRA, effort HCSF.
- L'app n'a pas d'espace « outils » hors projet : la barre latérale liste les projets, Comparer, Méthode, l'extension, le compte.
- Il existe une page générique « Bientôt » (`apps/web/src/ecrans/Bientot.tsx`).
- L'Excel de Pierre (feuille « Calculs prêt immo », lue le 14/09/2026) est le modèle de l'outil : **deux banques côte à côte** (LCL / CIC), pour chacune prix FAI, frais d'agence, apport, travaux, frais de notaire (9,5 % forfaitaires), montant emprunté, frais de dossier et de garantie, taux nominal, TAEG hors et avec assurance, taux d'assurance, durée, date de début ; en sortie : nombre de mensualités, mensualité hors assurance, assurance, mensualité totale, total des intérêts, total assurance, coût total ; puis **« Revenus et endettement »** (revenu net mensuel → taux d'endettement = mensualité ÷ revenu) et **« Calcul d'IRA »** (revente après x années → capital restant dû, IRA 3 % du CRD, IRA 6 mois d'intérêts). Deux tableaux d'amortissement (une feuille par banque, 360 lignes).

## Ce que ça changerait pour l'utilisateur

- Une page `/simulateur-pret` (nom à choisir) accessible depuis la barre latérale et depuis le bouton « Simuler un prêt » d'un projet, pré-remplie avec le prêt du projet quand on vient de là.
- Elle répond aux questions d'un emprunteur : mensualité et coût total pour un montant, une durée, un taux ; tableau d'amortissement (avec différés) ; comparaison de deux ou trois offres côte à côte (taux, durée, assurance, frais) ; **capacité d'emprunt** à partir des revenus (35 %, 25 ans) — c'est là que « Vos revenus nets » retrouvent une place, hors du projet.
- Sans compte, rien n'est enregistré ; un bouton « Appliquer à mon projet » renvoie les paramètres dans le projet d'origine.

## Questions ouvertes

1. Périmètre v1 de l'outil : mensualité + amortissement + comparaison de 2-3 prêts (le périmètre de l'ancien simulateur et de la feuille Excel) ; capacité d'emprunt et endettement (revenu net → 35 %) en plus ? Le bloc IRA de l'Excel est déjà couvert par l'onglet Revente d'un projet.
2. Faut-il un espace « Outils » dans la barre latérale (simulateur de prêt, plus tard : frais de notaire, rendement rapide) ?
3. Le simulateur est-il un produit d'acquisition (page publique, référencée) ou une commodité pour les utilisateurs de Deklic ? Ça change le soin apporté aux textes et au SEO.

## Pistes techniques et impact

- **Moteur** : rien à écrire ou presque ; exposer proprement `calculerFinancement`-like pour un prêt seul (sans projet) si ce n'est pas déjà public dans `packages/moteur/src/index.ts`.
- **Web** : écran `ecrans/SimulateurPret.tsx` hors coque projet, paramètres dans l'URL (`?montant=&duree=&taux=`), composants de champ existants, tableau d'amortissement (virtualisé au-delà de 360 lignes ou paginé par année), impression via `ModeDocument`.
- **Placeholder immédiat** (fiche 01) : route `/simulateur-pret` → page « Bientôt » qui lit les paramètres de l'URL et les affiche (« Prêt de 82 800 € sur 20 ans à 3,35 % ») pour que le bouton ait un sens dès maintenant.
- **Coût** : aucun appel réseau.
