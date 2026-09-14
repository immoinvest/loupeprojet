# Architecture : Gérer, le socle (G1a)

Discovery : `../features/gerer-socle-discovery.md` · Specs : `../specs/gerer-socle-specs.md` · État : `../pipeline/gerer-socle.json`.

## 1. Existant réutilisé

| Existant                                                                                                                            | Réutilisation                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `apps/comptes` : Hono + Better Auth, `Dependances` injectées, `reponseErreur`, journal, D1 `deklic-comptes`, `banc` de test         | L'API de gestion est un sous-routeur de la même app ; la session vient de `auth(origine).api.getSession`                    |
| `apps/comptes/tests/d1.ts` : D1 simulée sur `node:sqlite` (types refusés comme D1)                                                  | Tous les tests de gestion passent par l'interface D1 (vraies requêtes SQL, vraies clés étrangères)                          |
| `scripts/migration.ts` (0001 générée par Better Auth), `serveur-node.ts`                                                            | Liste ordonnée des migrations ; le serveur Node applique celles qui manquent                                                |
| `apps/web/src/compte/` : client réseau + client mémoire + `CompteProvider` ; `AppEnMemoire({ compte })`                             | Même modèle pour `gestion/` : `clientGestionReseau`, `clientGestionMemoire`, `GestionProvider`, `AppEnMemoire({ gestion })` |
| `packages/capture` : paquet TypeScript servi en source (`main: src/index.ts`), Vitest 100 %                                         | Gabarit de `packages/gestion`                                                                                               |
| Coque responsive : `Sidebar` = tiroir sous 1 024 px (ADR-R1), `Page`, `TitrePage`, `Carte`, `Bouton`, `Pastille`, `pointer-coarse:` | Sections du menu dans le même `aside` ; écrans de Gérer avec les composants de mise en page                                 |
| `stockage/projets.ts` (`StatutProjetSchema`), `ProjetsContext.changerStatut`                                                        | Statut « Acheté » ajouté ; la porte 1 le pose                                                                               |
| `e2e/formats.ts` (`ecransDeReference`, réponses simulées par `page.route`)                                                          | Écrans Gérer ajoutés avec session et état simulés                                                                           |

Conflits : aucune PR ouverte ; dix sessions locales sur `9d38892` sans commit au démarrage, dont `feat/coque-fixe` (même `Sidebar`). Changements de la coque regroupés dans deux fichiers nouveaux (`SectionAnalyser`, `SectionGerer`) pour réduire la surface de conflit.

## 2. Fichiers

### À créer

```
packages/gestion/                       @loupe/gestion : calcul pur, zéro I/O, dépendance unique Zod
├── package.json, tsconfig.json, vitest.config.ts
├── src/index.ts
├── src/dates.ts                        Jour (AAAA-MM-JJ), Periode (AAAA-MM) : validation, joursDansMois, periodeDe, bornes, comparaison, ajout de jours
├── src/schemas.ts                      BienGere, Locataire, LocationGeree, Paiement, PreferencesMenu, CreationLocation, NouveauPaiement, EtatGestion
├── src/regles.ts                       JOUR_LOYER_DEFAUT (5), DELAI_RETARD_JOURS (5), mois de dépôt par type (nue 1, meublée 2), depotParDefaut
├── src/loyers.ts                       loyerDuMois(location, periode) (prorata), statutLoyer(du, paiements, aujourdhui)
└── src/mois.ts                         resumeDuMois(etat, periode, aujourdhui) : lignes triées, reçus / total, montants, retards
packages/gestion/tests/                 dates, schemas, loyers, mois (+ propriétés à graine fixe sur le prorata)

apps/comptes/
├── migrations/0002_gestion.sql         cinq tables, clés étrangères en cascade, index (écrite à la main)
├── scripts/d1-sqlite.ts                d1SurSqlite déplacé ici (tests + serveur Node) ; tests/d1.ts le réexporte
└── src/gestion/
    ├── depot.ts                        interface DepotGestion (etat, creer, payer, annulerPaiement, preferences) + erreurs métier
    ├── depot-d1.ts                     depotD1(base) : requêtes préparées, batch pour la création, lignes → schémas
    ├── lignes.ts                       conversions ligne SQL ↔ objet (booléens 0/1, null ↔ absent)
    ├── acces.ts                        middleware : session requise (401), origine des écritures (403), taille (413)
    └── routes.ts                       routeurGestion(deps, auth) : cinq routes, validation Zod, table absente → 503
apps/comptes/tests/                     gestion-depot.test.ts (D1), gestion-routes.test.ts, gestion-acces.test.ts, migration 0002

apps/web/src/
├── gestion/
│   ├── types.ts                        ClientGestion, CodeErreurGestion, Resultat
│   ├── reseau.ts                       clientGestionReseau(recuperer) : fetch + revalidation Zod des réponses
│   ├── memoire.ts                      clientGestionMemoire(options) : tests et AppEnMemoire
│   ├── saisie.ts                       centimesDepuisTexte, formulaire « à la main » → CreationLocation | erreurs par champ
│   ├── depuis-projet.ts                brouillonDepuisProjet(enregistre, aujourdhui) : lignes affichées + CreationLocation
│   ├── menu.ts                         sectionsAffichees(etat compte, préférences), basculer (au moins une section)
│   ├── GestionContext.tsx              GestionProvider, useGestion : état chargé si connecté, actions, préférences en cache local
│   └── index.ts
├── textes/gerer.ts                     textes de Gérer (titres, portes, statuts, erreurs, phrase du mois)
├── coque/SectionAnalyser.tsx           « Analyser » : Nouveau projet, 5 projets, Tous mes projets, Comparer
├── coque/SectionGerer.tsx              « Gérer » : Ajouter un bien, Accueil (+ retards) ; sans compte : une ligne
├── ecrans/compte/MonMenu.tsx           carte « Mon menu » (deux interrupteurs)
└── ecrans/gerer/
    ├── Gerer.tsx                       /gerer : sans compte | chargement | erreur | portes | mois
    ├── SansCompte.tsx, Portes.tsx, LoyersDuMois.tsx
    ├── AjouterMain.tsx                 /gerer/ajouter
    ├── PretAGerer.tsx                  /gerer/pret/:id
    └── Champ.tsx                       champ libellé + erreur, cible tactile
apps/web/tests/                         gestion-*.test.ts (logique), gerer-*.test.tsx (rendu, compte des clics), menu-sections.test.tsx, mon-menu.test.tsx
```

### À modifier

```
apps/comptes/src/app.ts                 monte routeurGestion sur /api/gestion
apps/comptes/src/dependances.ts         Dependances.gestion : DepotGestion (depotD1(env.DB))
apps/comptes/src/erreurs.ts             codes NON_CONNECTE, CHAMPS_INVALIDES (existant), PERIODE_DEJA_RECUE, CORPS_TROP_GROS, GESTION_INDISPONIBLE
apps/comptes/scripts/migration.ts       MIGRATIONS ordonnées, lireMigrations()
apps/comptes/scripts/serveur-node.ts    applique les migrations manquantes, depotD1 sur SQLite
apps/comptes/tests/aide.ts              bancD1() : auth et gestion sur la même D1 simulée ; connecter(banc, email)
apps/comptes/package.json               dépendance @loupe/gestion
apps/web/src/App.tsx                    routes /gerer, /gerer/ajouter, /gerer/pret/:id ; GestionProvider ; AppEnMemoire({ gestion })
apps/web/src/coque/Sidebar.tsx          remplace le bouton et la liste par SectionAnalyser + SectionGerer
apps/web/src/coque/ProjetLayout.tsx     bouton « J'ai acheté ce bien » si la section Gérer est affichée
apps/web/src/ecrans/Compte.tsx          carte MonMenu entre Profil et Connexion
apps/web/src/stockage/projets.ts        statut « achete » (Acheté)
apps/web/package.json                   dépendance @loupe/gestion
apps/web/vitest.config.ts, vitest.config.ts   couverture 100 % : packages/gestion/src, apps/web/src/gestion
apps/web/e2e/formats.ts                 écrans Gérer (sans compte, accueil simulé, ajouter à la main)
docs : README, CLAUDE.md, registre, technical-spec, architecture-overview, functional-spec
```

Aucun fichier prévu au-delà de 300 lignes ; `Sidebar.tsx` perd du code.

## 3. Patterns

- **Repository** : `DepotGestion` (interface) et `depotD1` (implémentation). Les routes ne parlent jamais SQL. Un seul dépôt (D1) : les tests passent par la D1 simulée, qui refuse les mêmes types que D1 et applique les clés étrangères.
- **Injection de dépendances** : `Dependances.gestion`, comme `courriel` ou `base`.
- **Fonctions pures aux frontières** : tout calcul de loyer, statut ou résumé est dans `@loupe/gestion` ; le web et (plus tard) la banque et les envois l'appellent.
- **Contexte + hook + client mémoire** (comme `compte/`) : `GestionProvider` lit l'état quand le compte est connecté ; `AppEnMemoire` fournit un client mémoire par défaut.
- **Schémas partagés** : le serveur valide les corps avec les schémas de `@loupe/gestion`, le client revalide les réponses avec les mêmes.
- **Validation d'abord, puis garde, puis dépôt** dans chaque route.

## 4. Flux

### Porte « Ajouter à la main »

```
Portes « Ajouter à la main » (clic 1) → /gerer/ajouter
AjouterMain : saisie → formulaireVersCreation (gestion/saisie.ts) → erreurs par champ | CreationLocation
« Créer » (clic 2) → useGestion.creer(creation) → client.creer → POST /api/gestion/locations
  acces : session ? origine connue ? ≤ 64 Ko ?
  routes : CreationLocationSchema.safeParse → depot.creer(userId, creation, ids, maintenant) → batch D1 (bien, locataire, location)
← 201 { bien, locataire, location } → contexte : état fusionné → naviguer('/gerer')
Gerer → resumeDuMois(etat, periode du jour, aujourdhui) → LoyersDuMois
```

### Porte « J'ai acheté ce bien »

```
ProjetLayout « J'ai acheté ce bien » (clic 1) → /gerer/pret/:id
PretAGerer : useProjets.trouver(id) → brouillonDepuisProjet(enregistre, aujourdhui) → blocs affichés + création sans locataire
« C'est parti » (clic 2) → creation + locataire saisi → creer → changerStatut(id, 'achete') → /gerer
« Pas encore loué » (clic 2) → creation sans locataire ni location → idem
```

### Reçu et annuler

```
LoyersDuMois « Reçu » → payer({ locationId, periode, montant: du.total, date: aujourdhui }) → POST /paiements
  depot.payer : location du compte ? (sinon 404) ; période déjà payée ? (409) → insert
← 201 → état ; bandeau « Loyer de Julie reçu · Annuler » → annulerPaiement(id) → DELETE /paiements/:id → 204
```

### Mon menu

```
Compte → MonMenu : useGestion.preferences → interrupteur → basculer (refus si plus aucune section)
  → optimiste : préférences locales + cache localStorage → PUT /preferences → échec : retour arrière + message
Sidebar : sectionsAffichees(etat compte, preferences) → SectionAnalyser ? SectionGerer ?
```

## 5. Décisions locales

- **ADR-G1 : l'API de gestion dans `apps/comptes`.** Même origine que le site, donc même cookie de session et pas de CORS ; même base D1, donc suppression du compte en cascade. Écarté : un nouveau worker (second domaine, cookie tiers) ou `apps/worker` (pas de session). Les tâches planifiées (G2, G3) iront dans `apps/worker`, qui accepte un déclencheur cron, avec un binding sur la même base : à écrire en ADR à ce moment.
- **ADR-G2 : montants en centimes entiers.** Un loyer est un montant exact ; les additions de loyers et le prorata arrondi au centime ne cumulent pas d'erreur de virgule flottante. Conversion à l'affichage (`euros(centimes / 100)`) et à la saisie (`centimesDepuisTexte`). Écart assumé avec le moteur (euros décimaux), qui calcule des moyennes et des projections.
- **ADR-G3 : les loyers dus ne sont pas stockés.** Ils se déduisent de la location et des paiements, pour une période et une date données. Une location modifiée recalcule d'elle-même ses loyers non payés ; seul un paiement est un fait enregistré.
- **ADR-G4 : un seul dépôt, D1, testé par la D1 simulée.** Les tests d'API utilisent Better Auth sur la même D1 simulée (comme le test de migration existant) : les clés étrangères vers `user` et la cascade à la suppression du compte sont réellement exercées.
- **ADR-G5 : base non migrée = 503, pas 500.** Une erreur SQLite « no such table » sur une table `gestion_*` devient `GESTION_INDISPONIBLE` : le site et les comptes restent servis si la migration 0002 n'est pas encore appliquée en production.
- **ADR-G6 : contrôle d'origine sur les écritures.** Cookie `SameSite=Lax` plus en-tête `Origin` exigé et connu (mêmes motifs que la garde des comptes) sur POST, PUT et DELETE.
- **ADR-G7 : dates civiles en texte.** `AAAA-MM-JJ` et `AAAA-MM`, jamais d'objet `Date` ni d'heure dans les calculs ; « aujourd'hui » est injecté (fuseau de l'utilisateur côté web).

## 6. Cas limites

| Module                   | Cas                                                                                                                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dates`                  | 29 février (année bissextile ou non), mois de 28/30/31 jours, `2026-13`, `2026-02-30`, espace, jour sur un chiffre, comparaison lexicale sûre                                                   |
| `loyerDuMois`            | entrée et sortie le même mois, entrée le dernier jour, sortie le premier jour, fin avant la période, jour du loyer avant l'entrée, charges nulles, loyer nul (bien prêté), arrondi à ,5 centime |
| `statutLoyer`            | paiement supérieur au dû, paiement d'une autre période, date du jour égale à la date due + 5, loyer nul (reçu d'office)                                                                         |
| `resumeDuMois`           | aucune location, locations terminées, location future, tri stable à statut égal (par bien puis locataire)                                                                                       |
| `CreationLocationSchema` | locataire sans location et inversement, nom de 81 caractères, e-mail vide ou `""`, code postal à 4 chiffres, surface 0, projet de plus de 64 Ko                                                 |
| `depotD1`                | batch partiellement invalide (rien n'est écrit), période unique, location d'un autre compte, paiement d'un autre compte, préférences absentes (défaut), JSON du projet illisible (ignoré)       |
| `routes` / `acces`       | sans cookie, cookie expiré, `Origin` absent sur POST, `Origin` d'une preview, corps non JSON, `Content-Length` menteur, identifiant de 5 000 caractères, table absente                          |
| `centimesDepuisTexte`    | « 650 », « 650,5 », « 650,50 € », « 1 300 », « 1 300,00 », espace insécable, « -3 », « 12,345 », « abc », vide                                                                                  |
| `brouillonDepuisProjet`  | courte durée (→ meublée), sans adresse enregistrée, maison, entrée le 1er du mois suivant en décembre                                                                                           |
| `sectionsAffichees`      | anonyme (tout, Gérer réduit), chargement (tout), préférences absentes, les deux fausses (lecture défensive : tout)                                                                              |
| Écrans                   | API indisponible, réseau coupé, double clic sur « Créer » (bouton désactivé pendant l'envoi), projet introuvable, 50 locations dans le mois                                                     |

## 7. Ordre d'implémentation (un commit par étape)

1. Docs : épic mis à jour (banque, ordre), discovery, specs, architecture
2. US-1 : `packages/gestion` et ses tests ; seuils de couverture
3. US-2 : migration 0002, `d1-sqlite` déplacé, dépôt D1, accès, routes, dépendances, serveur Node ; tests
4. US-3 : client de gestion (réseau, mémoire), contexte, `menu.ts`, sections du menu, Mon menu ; tests
5. US-4 : écrans `/gerer` (sans compte, portes, mois, reçu et annuler), textes ; tests
6. US-5 : `saisie.ts`, `AjouterMain` ; tests (deux clics)
7. US-6 : `depuis-projet.ts`, `PretAGerer`, bouton dans l'en-tête, statut Acheté ; tests (deux clics)
8. Formats e2e, refactor, QA, audit de sécurité, docs communes, fusion de master, PR

## 8. Checklist pré-implémentation

- [x] Pas de conflit avec l'existant (aucune route `/api/gestion`, aucune table `gestion_*`)
- [x] Patterns cohérents avec le code (dépendances injectées, client mémoire, contexte + hook, schémas Zod)
- [x] Migration additive ; retour arrière = `drop table` des cinq tables (aucune donnée existante touchée)
- [x] Aucune rupture sur les routes existantes (`/api/auth`, `/api/comptes`)
- [x] Requêtes : quatre `select … where userId = ?` pour l'état (index sur `userId`), aucune boucle N+1
- [x] Entrées validées (Zod), session et origine vérifiées, taille des corps bornée
- [x] Chaque module ≤ 7 fonctions publiques ; aucun nom en « et »
- [x] Aucun fichier prévu > 300 lignes
- [x] Cas limites listés par module

## 9. Auto-revue critique

- **Point faible : `GET /etat` renvoie tous les paiements.** Sans limite, un compte ancien grossit la réponse (12 paiements par location par an). Acceptable pour G1a (quelques biens) ; G1b paginera ou bornera à 24 mois.
- **Point faible : pas de parcours Playwright contre l'API réelle.** Les deux clics sont prouvés au rendu, avec le client mémoire. Parade : le client réseau est testé contre des réponses réelles de l'API (mêmes schémas), et G1b équipe le job `e2e` d'un serveur d'API.
- **Point faible : conflit probable avec `feat/coque-fixe`.** Parade : sections extraites dans leurs fichiers ; `Sidebar.tsx` ne garde que l'assemblage ; fusion de `master` juste avant la PR.
- **Changement suite à la revue** : le dépôt mémoire côté serveur est abandonné (prévu au départ) au profit de la seule D1 simulée ; il aurait masqué les erreurs SQL et la cascade des clés étrangères.
- **Changement suite à la revue** : « Loyers », « Biens », « Locataires », « Argent » n'apparaissent pas encore dans le menu : des liens vers des pages vides contrediraient « très clean ». Ils arrivent avec leurs pages.
