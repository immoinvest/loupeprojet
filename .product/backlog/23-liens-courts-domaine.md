# 23 — Liens de partage courts et domaine app.deklic.pro

Statut : `idée` · Notée le 14/09/2026 · Dépend de : l'achat de `deklic.pro` et sa zone DNS chez Cloudflare (**Pierre**) · Taille : deux sessions (domaine, puis liens courts) + actions de Pierre dans Cloudflare, Google, Apple et Resend

## La demande de Pierre

> Les liens de partage sont trop longs ; et il faut changer le domaine pour utiliser app.deklic.pro.

## Ce qui existe aujourd'hui

### Liens de partage

- `apps/web/src/stockage/partage.ts` : `lienPartage(origine, enregistre)` = `https://loupeprojet.pages.dev/partage#p=<ProjetEnregistre entier en JSON, en base64url>`. **Tout le projet** est dans l'adresse : hypothèses, provenance de chaque champ, adresse, réponses et notes de visite… → plusieurs milliers de caractères, que certaines messageries tronquent ou affichent en pavé illisible.
- Choix d'origine (feature `garder`, principe « rien d'enregistré ») : le fragment `#` n'est jamais envoyé au serveur ; aucun stockage.
- Bouton `coque/BoutonPartager.tsx` (partage natif sur téléphone, copie sinon).

### Domaine

- Production : `https://loupeprojet.pages.dev` (Cloudflare Pages) ; Worker `loupe-worker.erreip-gorguel.workers.dev`.
- **Domaine écrit en dur** (hors docs) : `apps/comptes/src/dependances.ts` (origines connues des comptes, `*.loupeprojet.pages.dev`), `apps/extension/manifest.json` (script `pont.js` sur `*.loupeprojet.pages.dev`), `apps/extension/src/config.ts` (`BASE_URL_PRODUCTION`), `apps/extension/scripts/build.ts` (identifiant Firefox `loupe@loupeprojet.pages.dev`), `apps/web/vite.bookmarklet.config.ts` (bouton-favori), `apps/web/index.html` (`og:image`), et une dizaine de tests (`apps/comptes/tests`, `apps/web/tests/bookmarklet`, `extension-page`, `extension-pont`, `hors-ligne*`, `apps/extension/tests/popup`). 12 documents `.md` le citent.
- Hors dépôt : URI de redirection Google et Apple (comptes), domaine d'envoi Resend, `ORIGINES_AUTORISEES` du Worker et du projet Pages, Cloudflare Web Analytics, Sentry.

## Ce que ça changerait pour l'utilisateur

1. L'application s'ouvre sur **https://app.deklic.pro** ; l'ancienne adresse redirige automatiquement.
2. Un lien partagé ressemble à **`app.deklic.pro/p/7fK2qA9x`** (≈ 30 caractères) ; on l'ouvre sans compte, on voit le projet, « Ajouter à mes projets » comme aujourd'hui.
3. **Les projets déjà enregistrés sur l'ancienne adresse ne sont pas perdus** (voir « Piège » ci-dessous).

## Partie A — Domaine app.deklic.pro

### Piège principal : les projets sans compte sont rangés par adresse de site

Le stockage local du navigateur (`localStorage`, clé des projets) est **propre à chaque domaine** : sur `app.deklic.pro`, un visiteur sans compte verrait **une liste vide**. Proposition :

- sur l'ancien domaine, avant de rediriger : si des projets locaux existent et n'ont pas encore été transférés, **transfert automatique** vers `https://app.deklic.pro/transfert#d=<projets compressés>` (fragment jamais envoyé au serveur, même mécanique que le partage) ; la nouvelle adresse les importe (validation Zod, sans écraser un projet de même identifiant plus récent), puis marque le transfert fait ;
- avec compte : rien à faire, la synchronisation D1 (`sync-projets`) les ramène ;
- l'ancienne adresse reste en redirection au moins 12 mois.

### Étapes (Pierre ⚙ / code 💻)

1. ⚙ Acheter `deklic.pro` si ce n'est pas fait, zone DNS sur Cloudflare ; dans Pages, **domaine personnalisé `app.deklic.pro`** (certificat automatique).
2. 💻 **Une seule constante d'origine** `ORIGINE_PRODUCTION = 'https://app.deklic.pro'` (package partagé, par ex. `@loupe/capture` déjà commun à web et extension, ou variable de build) utilisée par l'extension, le bouton-favori, `og:image`, les tests ; fin des chaînes en dur.
3. 💻 Comptes : origines connues `https://app.deklic.pro` + `*.loupeprojet.pages.dev` (previews gardées) ; Better Auth `baseURL` ; cookies inchangés (même origine que le site).
4. ⚙ Google et Apple : ajouter les URI de redirection `https://app.deklic.pro/api/auth/callback/google` et `/apple` (garder les anciennes pendant la transition). Resend : domaine d'envoi `deklic.pro` (SPF, DKIM) et `COURRIEL_EXPEDITEUR` (ex. `connexion@deklic.pro`).
5. 💻 Worker : `ORIGINES_AUTORISEES` (CORS) avec `https://app.deklic.pro` ; ⚙ en option `api.deklic.pro` comme domaine du Worker (sinon inchangé).
6. 💻 Extension : `matches` et permissions du pont sur `https://app.deklic.pro/*` (+ previews), `BASE_URL_PRODUCTION`, **nouvelle version** à recharger / republier ; l'identifiant Firefox **ne change pas** (sinon les installations existantes sont perdues).
7. 💻 Application installable (PWA) : `start_url` / `scope` relatifs (vérifier `manifest`) ; le service worker de l'ancienne adresse doit laisser passer la redirection (désinscription propre).
8. 💻 Redirection de `loupeprojet.pages.dev` vers `app.deklic.pro` : page de transfert (piège ci-dessus) servie **uniquement** sur l'hôte `loupeprojet.pages.dev`, redirection 301 des autres chemins ; previews `*.loupeprojet.pages.dev` non redirigées. ⚙ Alternative : règle de redirection Cloudflare (mais elle empêcherait le transfert des projets locaux → la page de transfert d'abord).
9. 💻 Docs : README, CLAUDE.md, `.product/` (12 fichiers), `marque/README.md`.

## Partie B — Liens de partage courts

### Options

| Option                                                                            | Longueur                           | Serveur                              | Remarque                                                                |
| --------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------ | ----------------------------------------------------------------------- |
| 1. Compresser le fragment (deflate + base64url)                                   | ÷ 3 à ÷ 5 (≈ 800-1 500 caractères) | aucun                                | toujours long, mais aucun stockage ; `CompressionStream` natif          |
| 2. Ne partager que l'utile (sans visite ni provenance, valeurs par défaut omises) | ÷ 5 à ÷ 10 avec 1                  | aucun                                | se combine avec 1 ; le destinataire voit les défauts marqués « estimé » |
| 3. **Lien court stocké** : `/p/<8 caractères>`                                    | ≈ 30 caractères                    | D1 `deklic-comptes`, table `partage` | vraiment court ; **change le principe « rien d'enregistré »** → ADR     |

**Proposition : 3, avec 1 + 2 en repli** (hors ligne, ou si le stockage est indisponible, on donne le lien long compressé).

### Réalisation de l'option 3

- D1 : migration `0005_partage.sql` — `partage(id TEXT PRIMARY KEY, projet TEXT, cree_le, expire_le, jeton_suppression_hash)` ; `id` aléatoire 8 caractères base62 (≈ 2,2 × 10¹⁴ possibilités, non devinable), contenu = `ProjetEnregistre` allégé (option 2), **aucun texte d'annonce** (principe n° 6), taille max 64 Ko.
- API (worker Pages, `apps/comptes`, même origine) : `POST /api/partage` (sans compte ; limite 10 par heure par IP ; validation Zod) → `{ id, jetonSuppression }` ; `GET /api/partage/:id` ; `DELETE /api/partage/:id` avec le jeton (ou par le propriétaire connecté).
- Expiration : 90 jours sans ouverture (proposition), purge par tâche planifiée ou à la lecture.
- Web : route `/p/:id` → lecture → écran `Partage` actuel ; `BoutonPartager` crée le lien court (et le garde en mémoire du projet pour ne pas en recréer à chaque clic ; nouveau lien si le projet a changé) ; « Arrêter le partage » dans le menu du projet.
- ADR `.product/adr/NNN-liens-de-partage-courts.md` : ce qui est stocké, durée, suppression, pourquoi c'est compatible avec la vie privée (données du projet, pas d'identité ; hébergement UE D1 à vérifier).
- Les anciens liens `#p=…` continuent de fonctionner.

## Questions ouvertes

1. **Domaine** : `deklic.pro` est-il acheté, et sa zone DNS est-elle chez Cloudflare ? (préalable)
2. **Liens courts stockés** (option 3, proposition) ou rester sans aucun stockage (options 1 + 2, liens ≈ 5 à 10 fois plus courts mais encore longs) ?
3. **Durée de vie** d'un lien court : 90 jours sans ouverture (proposition), 1 an, ou illimitée ?
4. **Contenu partagé** : sans les notes et réponses de visite (proposition : ce sont souvent des remarques personnelles), ou tout ?
5. **Transfert automatique** des projets locaux de l'ancienne adresse (proposition) ou bouton « Récupérer mes projets » à cliquer ?
6. **Worker** : passer aussi sur `api.deklic.pro` ?

## Tests à mettre à jour

- Partie A : tous les tests à origine en dur passent par `ORIGINE_PRODUCTION` ; comptes (origine connue `app.deklic.pro`, imitation `app.deklic.pro.pirate.example` refusée, previews acceptées) ; extension (pont sur le nouveau domaine) ; transfert (projets compressés, validation, pas d'écrasement d'un projet plus récent, transfert unique) ; Playwright : parcours de transfert simulé entre deux origines locales.
- Partie B : migration D1 (table, index d'expiration) sur la D1 simulée `node:sqlite` ; API (création, lecture, 404, expiration, suppression par jeton, limite par IP, taille max, pas de texte d'annonce) ; web (`/p/:id` ouvre le projet, repli lien long hors ligne) ; Playwright : partager puis ouvrir le lien court dans un contexte neuf.

## Coût et risques

- Coût : domaine `.pro` (≈ 10-20 €/an, à Pierre) ; D1 et Workers dans les quotas gratuits (quelques écritures par partage).
- **Risque n° 1 : perte des projets locaux** au changement de domaine → transfert (partie A) testé avant toute redirection.
- Risque : connexion Google / Apple cassée si les URI de redirection ne sont pas ajoutées avant la bascule → liste de contrôle de mise en service dans le README, anciennes URI gardées.
- Risque : extension non mise à jour qui ne reconnaît plus le site → garder `*.loupeprojet.pages.dev` dans ses correspondances pendant la transition.
- Vie privée : les liens courts stockent des projets côté serveur → ADR, expiration, suppression, contenu allégé.
