# Feature Discovery : Gérer, le socle (G1a)

**Slug** : `gerer-socle` · **Branche** : `feat/gerer-socle` (worktree `loupe-gestion`, base `master` 9d38892) · **Date** : 2026-09-14 · **Épic** : `.product/features/gestion-locative-discovery.md`

## Demande d'origine

Pierre, 14/09/2026 : « Pour la partie banque, le but est de faire comme Rentila en utilisant les API bancaires pour se connecter au compte de la personne afin de détecter lorsqu'un virement a été fait. Une fois cela changé, commence l'implémentation en suivant le skill /new-feature. Auto-valide chaque étape. »

Les docs de l'épic sont mises à jour (décision 1 : API bancaires, G3 juste après le socle). Cette session implémente **la première feature de l'épic** : sans elle, la banque n'a rien à rapprocher (ni bien, ni location, ni loyer attendu).

## Analyse

### Quoi

Le socle de Gérer, utilisable de bout en bout :

1. **Le menu à deux sections** (Analyser, Gérer) et la carte **« Mon menu »** de Mon compte pour masquer l'une ou l'autre.
2. **Les données de gestion côté serveur**, liées au compte : biens, locataires, locations, paiements, préférences du menu ; API `/api/gestion/*` dans le worker des comptes (même origine, même cookie de session, même base D1).
3. **Un paquet de calcul pur** `@loupe/gestion` : loyers dus d'un mois (prorata d'entrée et de sortie), statut d'un loyer à une date (à venir, attendu, reçu, en retard), résumé du mois.
4. **Deux portes sur trois** : « J'ai acheté ce bien » (depuis une analyse) et « Ajouter à la main », chacune en deux clics. La porte banque est affichée « Bientôt » (feature G3).
5. **L'accueil du mois** : « 3 loyers sur 4 reçus », la liste des loyers du mois, « Reçu » en un clic et « Annuler ».

### Pourquoi

- La détection des virements (G3) rapproche une opération bancaire d'un **loyer attendu** : il faut d'abord des locations et leurs loyers dus.
- Le menu et les portes sont ce que Pierre verra en premier ; la règle des deux clics se prouve dès ce socle.

### Pour qui

Camille (un bien acheté après analyse) et Pierre (plusieurs biens déjà loués, qu'il ajoutera à la main en attendant la banque).

### Où

`packages/gestion` (nouveau), `apps/comptes` (routes, migration D1 `0002`), `apps/web` (menu, Mon compte, en-tête de projet, écrans `/gerer`).

## Outcomes

1. Depuis l'accueil de Gérer, **deux clics** créent un bien loué et ses loyers (tests de rendu qui comptent les clics).
2. Le mois en cours se lit en une phrase ; un loyer se marque reçu en un clic et s'annule.
3. Un compte ne voit jamais les données d'un autre (tests d'accès croisé).
4. Masquer une section rend le menu plus court sans rien perdre.

## Outputs

1. `packages/gestion` : schémas Zod (bien, locataire, location, paiement, préférences, création), périodes, loyers dus, statuts, résumé du mois. Montants en **centimes entiers**.
2. `apps/comptes` : `GET /api/gestion/etat`, `POST /api/gestion/locations`, `POST /api/gestion/paiements`, `DELETE /api/gestion/paiements/:id`, `PUT /api/gestion/preferences` ; dépôt D1 et dépôt mémoire ; migration `0002_gestion.sql` ; suppression des données avec le compte.
3. `apps/web` : client de gestion (réseau, mémoire), contexte, sections du menu, carte « Mon menu », bouton « J'ai acheté ce bien », écrans `/gerer`, `/gerer/ajouter`, `/gerer/pret/:id`, statut de projet « Acheté ».

## Scope

### IN

- Location nue ou meublée, un locataire par location, paiement mensuel à échoir, jour du loyer 1 à 28.
- Types de bien : appartement, maison, studio, parking.
- « Reçu » = paiement complet du mois ; annulation.
- Préférences du menu enregistrées avec le compte.

### OUT (features suivantes de l'épic)

- Connexion bancaire et détection des virements (G3, suivante).
- Quittance et reçu en PDF, paiement partiel, pages Loyers / Biens / Locataires, fiches, colocation, export des données (G1b).
- Envois d'e-mails, « Loyer reçu ? » (G2) ; révision, fin de bail, dépôt (G4) ; Argent, déclaration (G5).
- Parcours Playwright contre une vraie API : le job `e2e` ne sert que le site statique ; il sera équipé en G1b. Ici, la preuve des deux clics est faite par des tests de rendu ; les écrans rejoignent la spec « formats » avec des réponses simulées.

## Contraintes

- **Même origine** : l'API de gestion vit dans `apps/comptes` (cookie de session, CSRF couvert par `SameSite=Lax` et un contrôle d'origine sur les écritures).
- **Production** : la migration `0002` doit être appliquée à la base `deklic-comptes` ; tant qu'elle ne l'est pas, l'API répond `503 GESTION_INDISPONIBLE` et l'écran le dit, sans casser le reste du site.
- **Sessions parallèles** : `feat/coque-fixe` (menu fixe) touche `Sidebar.tsx` et `AppLayout.tsx` ; d'autres touchent `ProjetLayout`, `Compte`, `stockage/projets.ts`. Changements localisés, fusion de `master` avant la PR.
- Couverture 100 % : `packages/gestion`, `apps/comptes/src`, `apps/web/src/gestion`, textes.
- Machine lente et chargée (dix sessions en parallèle) : tests ciblés pendant l'implémentation, suite complète avant la PR.

## Risques

- **Conflits de fusion** avec les sessions parallèles sur la coque et l'en-tête de projet.
- **Heure et fuseau** : un loyer « du 5 » ne doit pas basculer selon l'heure UTC ; toutes les dates sont des jours civils `AAAA-MM-JJ`, la date du jour est injectée.
- **Arrondi du prorata** : centimes entiers, arrondi au plus proche, documenté.
- **Suppression du compte** : les données de gestion doivent partir aussi (clés étrangères en cascade dans D1, et nettoyage explicite testé).

## Definition of Done

- [ ] Deux clics par porte, prouvés par tests de rendu.
- [ ] API : chaque route testée (cas nominal, non connecté, validation, accès croisé, table absente) ; dépôt D1 testé à travers la D1 simulée ; migration appliquée sur base vide.
- [ ] `packages/gestion` couvert à 100 %.
- [ ] Menu à deux sections, « Mon menu », bouton « J'ai acheté ce bien » ; écrans ajoutés à la spec « formats ».
- [ ] Gates verts ; docs communes à jour ; PR en auto-merge.

## Auto-revue (checkpoint validé par Claude, sur autorisation de Pierre)

- **Pourquoi pas la banque tout de suite ?** Pierre a demandé l'implémentation de l'épic ; la banque rapproche des virements de loyers attendus, qui n'existent pas encore. Commencer par G3 aurait obligé à construire le socle en même temps (deux features en une session, contraire à la règle 1).
- **Découpage de G1 (proposition A)** accepté : sans cela, neuf stories dont quatre de taille M dans une session.
- **« Mon menu » exige un compte** : la page Mon compte n'existe que connecté ; le réglage vit donc avec le compte. Sans compte, le menu montre les deux sections, Gérer réduit à une ligne.
- **Centimes entiers** plutôt que les euros décimaux du moteur : un loyer est un montant exact, jamais une moyenne ; aucune erreur d'arrondi à l'addition.
- **Pas de table des loyers dus** : ils se déduisent des locations et des paiements à l'affichage (même principe que « les résultats ne sont jamais persistés ») ; seuls les paiements sont stockés.
