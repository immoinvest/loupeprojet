# Architecture : Quittances envoyées par e-mail (G2-1, G2-2, G1-8 téléphone, bailleur par bien)

**Session** : nuit du 15-16/09/2026, C1 · **Branche** : `feat/quittances-auto` · **Migration réservée** : `0009_gestion_envois.sql`
**Specs** : `.product/specs/gestion-locative-specs.md` (G2-1, G2-2, § 2, § 3, § 6) · **Base** : `gerer-socle.md`, `quittances-fiches.md`, `gerer-biens.md`, `gerer-parcours.md` (ADR-G1 à G23, toujours valables)

Pierre dort : discovery, specs et architecture sont auto-validées (auto-revue en fin de document). Les questions ouvertes prennent la proposition de la fiche de session.

## 1. Discovery

**Problème** : le bailleur imprime ou télécharge chaque quittance à la main. La loi l'autorise à l'envoyer par e-mail si le locataire a donné son **accord exprès** (loi n° 89-462 du 6 juillet 1989, art. 21). Deklic doit obtenir cet accord sans travail pour le bailleur, puis envoyer la quittance au paiement complet.

**Résultats attendus pour le bailleur**

1. Un locataire ajouté avec son e-mail reçoit tout seul « Vos quittances de loyer par e-mail » ; un clic de sa part suffit.
2. « Reçu » sur un loyer : la quittance part par e-mail (PDF joint) quelques secondes plus tard, et la ligne le dit.
3. Une adresse qui refuse l'e-mail apparaît dans « À faire ».
4. Le téléphone du locataire et une identité de bailleur par bien (SCI) complètent les fiches.

**Contraintes** : migration additive seulement, fusion sans migration appliquée (tout marche sans elle), aucun e-mail réel en test, aucun secret dans le code, domaine d'envoi pas encore vérifié chez Resend (Resend ne livre alors qu'au propriétaire du compte), taille du `_worker.js` (Better Auth y est déjà).

**Hors périmètre (C2)** : « Loyer reçu ? », relances, avis d'échéance, résumé mensuel, réglages de copie, tâche quotidienne (reprise des envois perdus, étalement sous quota). Webhooks de rebond Resend : plus tard.

## 2. Stories

| #    | Story                                                                                                          | Priorité |
| ---- | -------------------------------------------------------------------------------------------------------------- | -------- |
| US-1 | Règles pures : statut d'accord, destinataires, masquage de l'adresse, délais (`@loupe/gestion`)                | P0       |
| US-2 | Migration 0009 additive et preuve « migration sans risque »                                                    | P0       |
| US-3 | Envoyeur partagé : pièces jointes, gabarits testés par instantané, PDF de la quittance, jetons                 | P0       |
| US-4 | API : accord (invitation, page publique, déclaration), quittance envoyée, renvoi, téléphone, bailleur par bien | P0       |
| US-5 | Web : page publique d'accord, fiche du locataire, ligne du loyer, formulaires, fiche du bien, « À faire »      | P0       |

```gherkin
Scénario : invitation sans clic (US-4)
  Étant donné les envois actifs (Resend ou journal, et une clé de jetons)
  Quand je crée une location, loue un bien ou ajoute l'e-mail d'un locataire
  Alors chaque locataire du bail avec un e-mail et sans accord pour cette adresse reçoit l'invitation
  Et son accord passe « en attente » ; une seconde invitation n'est possible qu'après 24 h

Scénario : page publique (US-5)
  Quand le locataire ouvre le lien (jeton signé, 30 jours, usage unique)
  Alors la page nomme le bailleur et le logement, et propose « Oui, recevoir mes quittances par e-mail » et « Non merci »
  Et ouvrir la page ne consomme rien (antivirus) ; seul le bouton enregistre la réponse
  Et un jeton expiré, réutilisé, modifié, ou dont l'adresse a changé mène à « Ce lien n'est plus valable »

Scénario : accord déclaré (US-4, US-5)
  Quand je clique « Mon locataire m'a déjà donné son accord » sur sa fiche
  Alors l'accord passe « declare_par_bailleur », daté, pour son adresse actuelle

Scénario : quittance envoyée (US-4)
  Étant donné un accord valide pour l'adresse actuelle
  Quand un loyer devient entièrement reçu (« Reçu », ou « En partie » qui solde)
  Alors 12 secondes plus tard, si le mois est toujours soldé, la quittance est émise (idempotente) et envoyée, PDF joint
  Et un « Annuler » dans les 10 secondes empêche l'envoi
  Et un échec est retenté une fois ; puis « E-mail de Julie à vérifier » dans « À faire »

Scénario : renvoyer (US-4, US-5)
  Quand je clique « Renvoyer » sur la trace « Envoyée le 06/10 à julie@… »
  Alors le même document (même numéro, même contenu) repart ; pas plus d'un renvoi par minute

Scénario : sans migration 0009 (US-2)
  Alors toutes les routes existantes répondent comme avant, « Reçu » marche, aucune invitation ne part
  Et les routes de ce module rendent 503 ENVOIS_INDISPONIBLE ; le web dit « Bientôt disponible » dans ses cartes seulement
```

## 3. Décisions (ADR-G40 à G46)

Numérotation à partir de G40 : les sessions A1 et B1 démarrent en même temps et prennent la suite de G23.

- **ADR-G40 — PDF écrit à la main, sans bibliothèque.** `pdf-lib` pèse plusieurs centaines de Ko minifiés et le `_worker.js` porte déjà Better Auth. La quittance est du texte sur une page A4 : un écrivain PDF de ~200 lignes (`apps/comptes/src/courriel/pdf.ts`, polices standard Helvetica en WinAnsiEncoding, aucune police embarquée, table xref calculée) suffit, se teste entièrement et ne coûte rien au bundle. Le rendu reprend l'ordre et les phrases de `DocumentLoyer` (web) depuis le **contenu figé** : un document émis ne se recalcule jamais. Caractères hors WinAnsi (espaces fines de `Intl`) → espace ; inconnus → « ? ».
- **ADR-G41 — Jetons signés HMAC SHA-256 + usage unique en base.** Jeton = `<id>.<expiration en secondes>.<signature base64url>` avec `JETON_COURRIEL_SECRET` (32 caractères ou plus ; absent hors dev → aucune invitation, l'écran le dit ; secret fixe en dev). La signature est vérifiée par `crypto.subtle.verify` (temps constant) avant toute lecture ; la ligne `gestion_jeton` porte l'usage (`utiliseLe`), l'expiration et l'empreinte SHA-256 de l'adresse invitée. Le jeton voyage dans le **fragment** de l'adresse (`/accord#…`) : jamais dans les journaux d'accès ni le Referer.
- **ADR-G42 — Accord lié à l'adresse.** `gestion_accord` garde l'empreinte SHA-256 de l'adresse (minuscules, sans espaces) à laquelle l'accord s'applique, jamais l'adresse. Adresse changée → statut effectif « non demandé » et nouvelle invitation : on n'envoie jamais une quittance à une adresse que le locataire n'a pas acceptée. Statuts effectifs calculés par `statutAccord` (paquet pur).
- **ADR-G43 — Envoi différé de 12 secondes, dans la requête « Reçu ».** Émettre la quittance dans la requête bloquerait « Annuler » (`DOCUMENT_EMIS`, 10 s) et un clic de travers enverrait une preuve de paiement. La requête de paiement confie la tâche à `executionCtx.waitUntil` (limite Cloudflare : 30 s après la réponse) : attendre 12 s, relire le mois, émettre si soldé, envoyer. Sans contexte d'exécution (serveur Node de dev) : promesse détachée. Une tâche perdue (isolat arrêté) n'est pas rattrapée ici : la tâche quotidienne de C2 reprendra les mois soldés sans envoi. Toujours sans tâche planifiée, comme le demande la fiche.
- **ADR-G44 — Déclencheurs en intergiciel, pas dans les routes existantes.** `declencheursEnvois(deps)` s'enregistre d'une ligne dans `routes.ts` : après `POST /locations`, `POST /biens/:id/locations`, `PATCH /locataires/:id` (réponse 2xx) il invite ; après `POST /paiements` (201) il programme la quittance. Toute erreur (table absente, envoyeur en panne) est journalisée sans donnée personnelle et n'altère jamais la réponse d'origine.
- **ADR-G45 — Traces minimales.** `gestion_envoi` : une ligne par (document, locataire), destinataire **masqué** (`julie@…`), statut `envoye` / `echec`, tentatives, dates. Idempotence : insertion `on conflict do nothing` ; une ligne existante `envoye` bloque l'envoi automatique ; « Renvoyer » la met à jour. Suppression du compte, du bien, du locataire ou du document : cascade.
- **ADR-G46 — Données latérales et identité de bailleur par bien.** Téléphone dans `gestion_locataire_contact`, identité par bien (personne ou SCI, nom, adresse) dans `gestion_bien_bailleur`, lues par les routes de ce module seulement ; l'émission d'un document lit l'identité du bien **en tolérant la table absente**, sinon celle du compte. Les documents déjà émis ne changent pas (contenu figé, ADR-G8). `Reply-To` des e-mails au locataire : l'adresse du compte du bailleur (le locataire répond à son bailleur, jamais à Deklic).

## 4. Inventaire des fichiers

### `packages/gestion`

- `src/envois.ts` : statuts d'accord (`STATUTS_ACCORD`, `statutAccord`, `accordValide`), `destinatairesQuittance`, `masquerEmail`, `normaliserEmail`, `invitationPossible`, `renvoiPossible`, `locatairesAVerifier`, schémas (`EtatEnvoisSchema`, `ContactLocataireSchema`, `BailleurBienSchema`, `LectureAccordSchema`, `ReponseAccordSchema`…), règles datées (`REGLES_ENVOIS` : 30 jours, 2 tentatives, 12 s, 1 min, 24 h ; `ENVOI_DEMATERIALISE` art. 21).

### `apps/comptes`

- `migrations/0009_gestion_envois.sql` ; `scripts/migration.ts` (une ligne).
- `src/courriel.ts` : `Message.pieces` et `Message.repondreA` (Resend `attachments`, `reply_to`), `Envoyeur.mode`, type `EnvoyeurCourriel`.
- `src/courriel/pdf.ts` (écrivain PDF), `src/courriel/format.ts` (euros, dates en lettres), `src/courriel/gabarits.ts` (invitation, quittance : texte + HTML échappé), `src/courriel/pdf-quittance.ts`.
- `src/gestion/envois/` : `jetons.ts` (HMAC), `depot.ts` (interface, `estTableEnvoisAbsente`), `depot-d1.ts`, `taches.ts` (inviter, envoyer la quittance, renvoyer, avec une nouvelle tentative), `declencheurs.ts` (intergiciel), `routes.ts` (`/envois/*` sous la garde de session), `public.ts` (`/api/accord/*` sans session).
- `src/dependances.ts` : `envois`, `jetons`, `attendre` ; variable `JETON_COURRIEL_SECRET`. `src/app.ts` : une ligne pour `/api/accord`. `src/gestion/routes.ts` : deux lignes. `src/gestion/depot-documents.ts` : identité du bien tolérante.

Routes (réponses `no-store`) :

| Méthode et chemin                                     | Rôle                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------- |
| `GET /api/gestion/envois`                             | mode, accords effectifs, envois, contacts, identités par bien |
| `POST /api/gestion/envois/locataires/:id/accord`      | « Mon locataire m'a déjà donné son accord »                   |
| `POST /api/gestion/envois/locataires/:id/invitation`  | « Renvoyer la demande » (24 h entre deux)                     |
| `PUT /api/gestion/envois/locataires/:id/contact`      | téléphone (`telephone: null` le retire)                       |
| `PUT /api/gestion/envois/biens/:id/bailleur`          | identité du bien (`null` la retire)                           |
| `POST /api/gestion/envois/documents/:id/renvoyer`     | même document, mêmes destinataires valides                    |
| `POST /api/accord/lire` · `POST /api/accord/repondre` | page publique, sans session, hôte et `Origin` connus          |

Codes : `ENVOIS_INDISPONIBLE` (503), `ENVOIS_INACTIFS` (409 : pas d'envoyeur ou pas de clé de jetons), `SANS_EMAIL` (409), `ENVOI_RECENT` (429), `INVITATION_RECENTE` (429), `LIEN_INVALIDE` (410), `BAILLEUR_MANQUANT`, `INTROUVABLE`, `CHAMPS_INVALIDES`.

### `apps/web`

- `src/gestion/envois/` : `types.ts`, `reseau.ts`, `memoire.ts`, `EnvoisContext.tsx` (`EnvoisProvider`, `useEnvois()` : sans fournisseur, « indisponible »), `logique.ts` (trace d'un loyer, statut lisible, accords vus).
- `src/stockage` inchangé ; `src/gestion/parcours.ts` : `CHEMIN_ACCORD`.
- `src/ecrans/accord/Accord.tsx` (hors coque), `src/ecrans/gerer/envois/` : `CarteAccord.tsx`, `TraceEnvoi.tsx`, `ChampTelephone.tsx`, `BailleurDuBien.tsx`.
- Modifiés : `App.tsx` (route, fournisseur), `FicheLocataire.tsx`, `ModifierLocataire.tsx`, `nouveau/FormulaireLouer.tsx`, `LigneDeLoyer.tsx`, `FicheBien.tsx`, `gestion/a-faire.ts`, `AFaire.tsx`, `useActionsLoyer.ts` (message « La quittance partira par e-mail »).
- Textes : `src/textes/gerer-envois.ts`. e2e : `ECRANS_QUITTANCES_AUTO` dans `e2e/ecrans-gerer.ts`, réponses simulées dans `e2e/reponses-gestion.ts`.

## 5. Flux

**Invitation** : route d'origine 2xx → intergiciel lit les locataires concernés → pour chacun avec e-mail, statut effectif `non_demande` (ou `en_attente` depuis plus de 24 h pour « Renvoyer ») → jeton (ligne `gestion_jeton`) → `upsert` de l'accord `en_attente` → e-mail (vouvoiement, nom du bailleur ou « votre bailleur », adresse du logement, bouton vers `<origine de la requête>/accord#<jeton>`).

**Réponse** : `POST /api/accord/repondre` → signature → consommation atomique (`update … where utiliseLe is null and expireLe > ?`) → adresse du locataire inchangée (empreinte) → accord `accorde` ou `refuse`, daté.

**Quittance** : `POST /paiements` 201 → `waitUntil(attendre 12 s → lire la location et ses paiements → soldé ? → émettre → destinataires valides → pour chacun : insérer la trace si absente → PDF + e-mail → nouvelle tentative si échec → statut)`.

## 6. Sécurité et données personnelles

- Routes du compte derrière `acces` (session, hôte, `Origin` pour écrire), 404 hors compte, testées en accès croisé.
- Page publique : jeton signé, usage unique, 30 jours ; `Origin` connu exigé pour répondre ; aucune réponse ne dit si un compte ou un locataire existe (`LIEN_INVALIDE` pour tout échec).
- HTML des e-mails échappé (noms, adresses saisis par le bailleur) ; aucun lien construit depuis une donnée saisie.
- Journaux : `envoi.echec` avec le code et le statut HTTP, jamais d'adresse, de nom ni de montant. Le journal de développement (`envoyeurJournal`) écrit le texte du message : dev seulement, pour suivre le lien d'accord.
- Minimisation : adresse invitée et adresse d'accord en empreinte ; destinataire masqué dans les traces ; téléphone facultatif.
- Suppression du compte : cascade sur les quatre nouvelles tables (testé).

## 7. Ordre d'implémentation

US-1 → US-2 → US-3 → US-4 → US-5, un commit par story (ou par module pour US-5), gates avant chaque commit.

## 8. Écarts assumés et risques

- Rebonds signalés après coup par Resend (webhook) : pas captés ; seul le refus immédiat compte comme échec.
- Quota Resend dépassé : l'envoi échoue deux fois et devient « à vérifier » ; l'étalement viendra avec la tâche quotidienne (C2).
- Tâche `waitUntil` perdue : pas de reprise avant C2.
- Sans domaine vérifié, Resend ne livre qu'au propriétaire du compte : le bailleur voit « Envoyée » pour les tests de Pierre seulement.
- Export JSON de gestion : n'inclut pas encore téléphone, accords et traces (A2 reprend l'export).

## Auto-revue (checkpoint validé par Claude, sur autorisation de Pierre)

- **Sur-ingénierie ?** L'envoi différé ajoute une attente, mais c'est la seule façon de garder « Annuler » (G1b) sans tâche planifiée ; testé par une horloge injectée. L'écrivain PDF évite une dépendance lourde au prix d'un rendu sobre : acceptable pour une quittance.
- **Migration sans risque** : quatre `create table` et leurs index, aucune colonne ajoutée ; `GET /etat` inchangé ; l'émission de documents tolère l'absence de `gestion_bien_bailleur` ; les déclencheurs avalent l'erreur de table absente. Preuve par test sur une base migrée jusqu'à la migration précédente.
- **Loi** : envoi seulement avec accord exprès (art. 21) ; aucune quittance pour un paiement partiel (reçu seulement, non envoyé) ; aucun frais.
- **Risque de conflit** avec A1 et B1 : `routes.ts` (deux lignes), `dependances.ts`, `tests/aide.ts`, `scripts/migration.ts`, `App.tsx`, `e2e/ecrans-gerer.ts`, `a-faire.ts` : ajouts courts en fin de liste.
