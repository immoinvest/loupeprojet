# Feature Discovery : Gérer, pages reliées (G1d)

**Slug** : `gerer-parcours` · **Branche** : `feat/gerer-parcours` (worktree `.claude/worktrees/suspicious-lovelace-2707d5`, base `master` 713d27b0) · **Date** : 2026-09-15 · **Épic** : `.product/features/gestion-locative-discovery.md` · **Précédente** : `gerer-biens` (G1c, PR #80) · **Carte des parcours** : https://claude.ai/code/artifact/8af4cea1-7d17-4c7b-9d27-fdd6ce3d5e8c

## Demande d'origine

Pierre, 15/09/2026 : dans Gérer, chaque page doit être reliée aux autres. Sur Mes biens, un bien « sans locataire » doit mener d'un clic à l'ajout d'un locataire, le bien déjà choisi. Depuis les loyers du mois, on doit atteindre le bien (pour le modifier), le locataire, etc. Le parcours le plus simple possible (exigence « deux clics »).

**Décisions de Pierre (15/09/2026, questions posées en début de session)** :

1. Une **seule page « Nouveau locataire »** `/gerer/locataires/nouveau`, ouverte depuis toutes les pages, bien prérempli par l'adresse ; elle remplace le formulaire « Louer » de la fiche du bien.
2. Après « Enregistrer » : **retour à la page d'origine** avec un message et un lien vers la fiche du locataire ; sans origine, la fiche du nouveau locataire.
3. Bloc **« À faire »** en haut des loyers du mois : **trois lignes au plus**, loyers en retard, puis biens vacants, puis e-mails manquants, et « et N autres ».
4. Périmètre : G1-6 (« À faire ») **dans** G1d ; **hors** G1d : l'export proposé avant « Supprimer mon compte » (G1-9) et le téléphone du locataire (G1-8), qui demanderait une migration D1.

## Constat dans le code (G1a à G1c)

| Où                                      | Impasse                                                                                                               |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `MesBiens.tsx`                          | « Sans locataire » est du texte ; il faut ouvrir la fiche puis « Ajouter le locataire »                               |
| `LigneDeLoyer.tsx`, `CarteLocation.tsx` | Le nom du locataire est du texte (Loyers du mois, Tous les loyers, fiche du bien, Mes biens)                          |
| `MesLocataires.tsx`                     | Pas de « Ajouter un locataire », pas de page propre à un locataire                                                    |
| `ImprimerDocument.tsx`                  | « ← Loyers » ramène toujours à `/gerer/loyers`, quelle que soit la page d'origine                                     |
| `fiche/FriseMois.tsx`                   | Un mois montre son statut et « Quittance », sans mener aux loyers de ce mois (`Loyers.tsx` accepte pourtant `?mois=`) |
| `FicheBien.tsx`                         | Aucun fil d'Ariane ; « Louer » est un formulaire dépliant propre à la fiche                                           |
| `LigneDeLoyer.tsx`                      | Corriger un loyer vu dans la liste : nom du bien, « Modifier », « Enregistrer » = trois clics                         |
| `LoyersDuMois.tsx`                      | Rien ne dit quoi faire en premier ; les biens vacants sont une phrase en bas de page                                  |

## Analyse

### Quoi

1. **Un objet = une adresse, chaque mention est un lien** : bien → sa fiche ; locataire → sa fiche (nouvelle) ; mois de la frise → loyers de ce mois ; montant d'un loyer → fiche du bien, « Modifier » ouvert.
2. **Fiche d'un locataire** `/gerer/locataires/:id` : nom, e-mail (ou « E-mail manquant » avec l'action qui le remplit), « Modifier », ses locations (bien, chambre, colocataires, dates, montants en vigueur), ses douze derniers loyers avec « Quittance ».
3. **Formulaire unique « Nouveau locataire »** `/gerer/locataires/nouveau?bien=…&retour=…` : le bien se choisit dans une liste (sans locataire d'abord), le loyer, les charges, le type et le jour sont repris de la dernière location du bien ; ouvert par « Louer » (Mes biens), « Ajouter le locataire » (fiche), « Louer … » (À faire), « Ajouter un locataire » (Mes locataires).
4. **Retour à l'origine** : après « Enregistrer » (message « Léa Bernard loue Parking Prado. » et « Voir sa fiche ») et depuis une quittance (« ← T2 Lices », « ← Loyers de mars 2026 »).
5. **Fil d'Ariane** sur la fiche d'un bien, la fiche d'un locataire et « Nouveau locataire ».
6. **« À faire »** en haut des loyers du mois (G1-6) : trois actions au plus, déduites des données.

### Pourquoi

- Pierre gère plusieurs biens dont une colocation : aujourd'hui chaque correction commence par le menu.
- La règle des deux clics (`.product/specs/gestion-locative-specs.md` § 1) vaut pour les portes ; elle doit valoir pour l'action courante sur ce qu'on regarde.
- Deux formulaires « Louer » et « Ajouter à la main » divergeraient à chaque feature (G2 ajoutera l'accord du locataire).

### Pour qui

Pierre (plusieurs biens, une colocation, suivi manuel des loyers) et Camille (un bien, un locataire).

### Où

`apps/web` seulement : `src/gestion/` (liens, retours, fiche locataire, « À faire », saisie), `src/ecrans/gerer/`, `src/textes/`, `src/App.tsx`, `e2e/`. **Aucune route d'API, aucune migration, aucun changement de `@loupe/gestion`** : tout se calcule depuis `EtatGestion`, déjà chargé (même principe que l'ADR-G18).

## Outcomes

1. Depuis n'importe quelle page de Gérer, un bien ou un locataire nommé s'ouvre en **un clic**.
2. Louer un bien vacant vu dans Mes biens, les loyers du mois ou sa fiche : **deux clics**, bien et loyer préremplis, retour là où l'on était.
3. Corriger le loyer vu dans la liste des loyers : **deux clics**.
4. Retrouver la quittance d'un mois depuis la fiche d'un bien : **deux clics**, et le retour ramène à ce mois.
5. En ouvrant les loyers du mois, les trois choses les plus urgentes sont listées, chacune à **un clic**.

## Outputs

1. Pages `/gerer/locataires/:id` (fiche) et `/gerer/locataires/nouveau` (formulaire unique).
2. Module pur `gestion/parcours.ts` : adresses des pages, paramètre `retour` validé, libellé du retour, message après une création.
3. Modules purs `gestion/fiche-locataire.ts` (occupations et loyers d'un locataire) et `gestion/a-faire.ts` (actions triées).
4. Composants `FilAriane`, `NomsDeLocataires` (noms en liens), `LocationCreee` (message après Enregistrer), `AFaire`.
5. Liens ajoutés dans `LigneDeLoyer`, `CarteLocation`, `FriseMois`, `MesBiens`, `MesLocataires`, `LoyersDuMois`, `Loyers`, `FicheBien`, `ImprimerDocument`.
6. Écrans ajoutés à la spec des formats ; parcours Playwright de navigation.

## Scope

### IN

- P0 : fiche d'un locataire et noms en liens ; formulaire unique « Nouveau locataire » et retour à l'origine ; « À faire ».
- P1 : retour des documents ; mois de la frise vers les loyers du mois (ligne du bien mise en évidence) ; montant d'un loyer vers « Modifier » ; fil d'Ariane.

### OUT

- Téléphone du locataire (G1-8) : migration D1, décision de Pierre du 15/09/2026 → plus tard.
- Export proposé avant « Supprimer mon compte » (G1-9) → plus tard.
- Supprimer un locataire seul, relancer un locataire (G2), identité de bailleur par bien (revue B), page Argent (G5).
- Liens depuis le bloc Gérer de l'accueil `/` : il mène déjà aux loyers du mois.

## Contraintes

- **Deux clics** comptés par des tests de rendu (définition de l'épic : les saisies et les choix dans une liste ne comptent pas).
- **Aucune redirection ouverte** : `retour` n'accepte qu'un chemin interne de Gérer.
- **Survol commun** : recettes `survol-*` (`.product/design/design-guidelines.md`) ; cibles de 44 px au doigt (`pointer-coarse:min-h-11`).
- **Listes déroulantes** : `MenuChoix`, jamais un `<select>` (règle de `coque-menus`).
- **Mobile d'abord** et nouvel écran dans `ecransDeReference` (règle de `responsive`).
- Couverture 100 % de `apps/web/src/gestion` et des textes ; fichiers ≤ 300 lignes.
- Données en production (Pierre gère de vrais biens) : aucun changement de données, lecture seule de l'état existant.

## Risques

- **Tests existants** : « Louer » quitte la fiche, « Sans locataire : … » quitte l'accueil de Gérer ; les tests de G1b et G1c qui s'y appuient changent (`gerer-louer`, `gerer-accueil`, `gerer-pret`, `gerer-document`, `gerer-louer-textes`). Parade : les réécrire sur le nouveau parcours, en gardant ce qu'ils prouvaient (préremplissage, erreurs, refus du serveur).
- **Anciens liens `?louer=1`** (tests, application installée) : redirection vers la nouvelle page.
- **Surcharge visuelle** d'une ligne de loyer : noms et montant deviennent des liens sans changer la mise en page ; soulignement discret, nom accessible explicite du montant.
- **Sessions parallèles** : `master` avance vite ; fusionner `master` avant la QA et juste avant la PR.

## Definition of Done

- [ ] Fiche d'un locataire ; noms en liens sur les cinq pages (tests de rendu, un clic).
- [ ] « Nouveau locataire » depuis Mes biens, fiche, À faire, Mes locataires ; préremplissage, changement de bien, retour et message (deux clics comptés).
- [ ] Quittance : retour à la page d'origine ; `retour` hostile ignoré.
- [ ] Frise → loyers du mois avec le bien mis en évidence ; montant → Modifier ouvert (deux clics comptés).
- [ ] « À faire » : ordre, trois lignes, « Voir les N autres », rien quand tout va bien.
- [ ] Spec des formats et parcours Playwright ; gates verts ; docs communes ; PR avec merge automatique (aucune migration).

## Auto-revue (checkpoint validé par Claude, sur autorisation de Pierre)

- **Quatre décisions de produit posées à Pierre** avant d'écrire : formulaire unique, retour, contenu d'« À faire », périmètre. Réponses reprises telles quelles.
- **Pas de téléphone** : la carte des parcours le prévoyait ; Pierre l'a écarté, ce qui retire la seule migration et permet le merge automatique.
- **« Sans locataire : … » supprimé de l'accueil de Gérer** : les biens vacants passent dans « À faire » ; au-delà de trois actions, « Voir les N autres » les montre, rien ne disparaît.
- **Retour par l'adresse plutôt que par l'état de navigation** : une quittance s'ouvre souvent dans un nouvel onglet ou se recharge avant impression ; l'état serait perdu. Le message après « Enregistrer » reste dans l'état de navigation (éphémère, comme « … a été supprimé » de G1c).
