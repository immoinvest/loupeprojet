# Architecture : Lecture d'une annonce par Deklic, sans extension (`lecture-serveur`)

Source : `features/lecture-serveur-discovery.md`, `specs/lecture-serveur-specs.md`. Décision de fond : **ADR-008** (amende l'ADR-002).

## Vue d'ensemble

```
Nouveau projet (web)
  │ lien collé, extension absente (ou en échec de chargement)
  ▼
useLectureAutomatique ──► AttenteLecture (étapes, progression estimée, astuces, Annuler)
  │
  ▼
lireParServeur(url, client, { signal })
  │ client.lirePage(url, signal)                      POST /lecture { url }
  ▼                                                        │
Worker  ── resoudreAnnonce (liste blanche, URL canonique) ◄┘
  ├─ bienici  → fetch https://www.bienici.com/realEstateAd.json?id=…   → page { type: donnees }
  └─ autres   → Bright Data Web Unlocker (zone, pays fr) ≤ 2 tentatives → page { type: html }
                 (réponse vide ou sans marqueur de données → nouvelle tentative)
  │
  ▼ réponse validée par Zod (web)
DOMParser(html) ou document vide + données
  → capturerAvecDonnees(document, url, REGISTRE_WEB, { mode: 'serveur', charger })
  → importerCapture → completerAvecIa → formulaire Vérifier
  → creer({ …, annonce: { photos, fiche, lueLe } })  → Rapport : carte « Le bien »
```

Le HTML et la description ne vivent qu'en mémoire dans le navigateur ; le Worker ne les met ni en cache ni au journal.

## Fichiers

### `packages/capture`

| Fichier                                          | Action   | Contenu                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                                   | modifier | export `./portails` (le Worker n'importe que la résolution d'URL, sans types DOM)                                                                                                                                                                                                                          |
| `src/schema.ts`                                  | modifier | champs enrichis (US-1), énumérations `ChauffageEnergieCaptureSchema`, `EtatCaptureSchema`, `VendeurCaptureSchema`, `ChargeHonorairesCaptureSchema`, `PhotosCaptureSchema` ; `ModeCaptureSchema` + `serveur` ; `CHAMPS_FICHE` et `FicheAnnonceSchema` (= `ChampsCaptureSchema.pick` des champs descriptifs) |
| `src/regles/schema.ts`                           | modifier | `TypeValeur` + `urls`, `date`                                                                                                                                                                                                                                                                              |
| `src/regles/chemin.ts`                           | modifier | étape `[*]` : applique la suite du chemin à chaque élément, aplatit, ignore les absents                                                                                                                                                                                                                    |
| `src/regles/convertir.ts`                        | modifier | tableau de valeurs simples → texte joint `", "` ; `urls` (https, ≤ 500 car., dédoublonnées, 30 max) ; `date` (`AAAA-MM-JJ` valide)                                                                                                                                                                         |
| `src/index.ts`                                   | modifier | nouveaux exports                                                                                                                                                                                                                                                                                           |
| `tests/regles/*.test.ts`, `tests/schema.test.ts` | modifier | cas US-1                                                                                                                                                                                                                                                                                                   |

### `apps/extension`

| Fichier                                                 | Action   | Contenu                                                                                                                          |
| ------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `regles/{leboncoin,seloger,logicimmo,bienici,pap}.json` | modifier | version `-2026-09-14`, extracteurs de l'inventaire                                                                               |
| `tests/fixtures/*-complet.{html,json}`                  | créer    | extraits **réduits et anonymisés** des pages réelles du 14/09/2026 (script d'état ou JSON-LD seul, textes et contacts remplacés) |
| `tests/regles-enrichies.test.ts`                        | créer    | US-2, par portail                                                                                                                |
| `manifest.json`, `package.json`                         | modifier | 0.3.0                                                                                                                            |

### `apps/worker`

| Fichier                                                      | Action   | Contenu                                                                                                                                                                                                                                      |
| ------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lecture/fournisseur.ts`                                 | créer    | interface `LecteurPages` ; `lecteurBrightData({ cle, zone, delaiMs }, fetcher, journal)` : `POST https://api.brightdata.com/request { zone, url, format: raw, country: fr }` ; statut du portail lu dans `x-brd-status-code` ; taille ≤ 3 Mo |
| `src/lecture/bienici.ts`                                     | créer    | `lireBienici(id, fetcher, delaiMs)` : JSON objet validé par Zod                                                                                                                                                                              |
| `src/lecture/route.ts`                                       | créer    | `creerLecture(deps)` : corps ≤ 2 Ko, `RequeteLectureSchema`, `resoudreAnnonce`, tentatives, marqueurs, codes, journal sans contenu, `Cache-Control: no-store`                                                                                |
| `src/lecture/index.ts`                                       | créer    | exports                                                                                                                                                                                                                                      |
| `src/erreurs.ts`                                             | modifier | codes `ANNONCE_INTROUVABLE`, `AMONT_VIDE`, `LECTURE_INDISPONIBLE`                                                                                                                                                                            |
| `src/dependances.ts`                                         | modifier | `lecteurPages: LecteurPages \| null`, `limiteurLecture` ; variables `BRIGHTDATA_API_KEY` (secret), `BRIGHTDATA_ZONE`                                                                                                                         |
| `src/app.ts`                                                 | modifier | `app.use('/lecture', limiterDebit(deps.limiteurLecture))`, `app.post('/lecture', creerLecture(deps))`, `/health` : `lecture: bool`, version 0.10.0                                                                                           |
| `wrangler.toml`                                              | modifier | `LIMITEUR_LECTURE` (namespace 1003, 5 / 60 s), `BRIGHTDATA_ZONE = "deklic_unlocker"`                                                                                                                                                         |
| `.dev.vars.example`                                          | modifier | clé et zone                                                                                                                                                                                                                                  |
| `package.json`                                               | modifier | dépendance `@loupe/capture`                                                                                                                                                                                                                  |
| `tests/aide.ts`                                              | modifier | `lecteurPages` et `limiteurLecture` dans le banc                                                                                                                                                                                             |
| `tests/lecture.test.ts`, `tests/lecture-fournisseur.test.ts` | créer    | US-3                                                                                                                                                                                                                                         |

### `apps/web`

| Fichier                                              | Action           | Contenu                                                                                                                                                                                                               |
| ---------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/annonces/regles.ts`                             | créer            | `REGISTRE_WEB` (les cinq fichiers de règles) ; `bookmarklet/lancer.ts` le réutilise (`REGISTRE_FAVORI` gardé en alias)                                                                                                |
| `src/annonces/lecture-serveur.ts`                    | créer            | `lireParServeur(url, client, { signal, analyser, maintenant })` → `{ ok, capture } \| { ok: false, raison }` ; `RaisonEchecServeur` = `indisponible`, `introuvable`, `bloquee`, `limite`, `reseau`, `vide`, `annulee` |
| `src/annonces/attente.ts`                            | créer            | `DUREES_HABITUELLES_MS`, `etatAttente(ecouleMs, portail)` → `{ progression, etape }` (pur)                                                                                                                            |
| `src/annonces/capture.ts`                            | modifier         | `champsStructures` : `etat`, `exterieur`, `honorairesAgence` ; `CaptureImportee` + `photos`, `fiche` ; mode `serveur`                                                                                                 |
| `src/annonces/fiche.ts`                              | créer            | `ficheDepuisCapture`, `exterieurDepuis`, `honorairesAcquereur` (purs)                                                                                                                                                 |
| `src/enrichissement/contrat.ts`                      | modifier         | `ReponseLectureSchema`                                                                                                                                                                                                |
| `src/enrichissement/client.ts`                       | modifier         | `lirePage(url, signal?)`, `DELAI_LECTURE_SERVEUR_MS = 160 000`, signal combiné (`AbortSignal.any`) ; `clientHorsLigne.lirePage`                                                                                       |
| `src/ecrans/nouveau-projet/useLectureAutomatique.ts` | créer            | hook (déplacé de `LectureAuto.tsx`, réexporté) : extension ou serveur, bascule, annulation, relance                                                                                                                   |
| `src/ecrans/nouveau-projet/LectureAuto.tsx`          | modifier         | `EtatLectureAuto` : attente serveur, échecs serveur, bouton « Lire sans l'extension »                                                                                                                                 |
| `src/ecrans/nouveau-projet/AttenteLecture.tsx`       | créer            | US-5                                                                                                                                                                                                                  |
| `src/ecrans/nouveau-projet/PastillesLien.tsx`        | modifier         | « lue par Deklic »                                                                                                                                                                                                    |
| `src/ecrans/NouveauProjet.tsx`                       | modifier         | props de l'état de lecture, `annonce` transmise à `creer`                                                                                                                                                             |
| `src/stockage/projets.ts`                            | modifier         | `AnnonceEnregistreeSchema`, `ProjetEnregistre.annonce?`, `OptionsCreation.annonce`                                                                                                                                    |
| `src/ecrans/Partage.tsx`                             | modifier         | l'annonce suit le projet ajouté                                                                                                                                                                                       |
| `src/ecrans/rapport/CarteBien.tsx`                   | créer            | US-7 : bandeau de photos, pastilles, lien vers l'annonce                                                                                                                                                              |
| `src/ecrans/Rapport.tsx`                             | modifier         | `CarteBien` en tête                                                                                                                                                                                                   |
| `src/textes/lecture-serveur.ts`                      | créer            | noms affichés des portails, étapes, astuces, phrases d'échec                                                                                                                                                          |
| `src/textes/fiche-bien.ts`                           | créer            | `pastillesFiche(fiche)` → libellés                                                                                                                                                                                    |
| `tests/…`                                            | créer / modifier | `lecture-serveur.test.ts`, `attente.test.ts`, `fiche.test.ts`, `lecture-serveur-ecran.test.tsx`, `carte-bien.test.tsx`, faux clients (+ `lirePage`)                                                                   |
| `e2e/reponses-worker.ts`                             | modifier         | `/lecture` simulé (503) pour les specs qui l'utilisent                                                                                                                                                                |

### Docs

`.product/adr/008-lecture-serveur.md` (créé), `adr/002` (renvoi), `architecture-overview.md`, `functional-spec.md`, `technical-spec.md`, `features-registry.md`, `README.md`, `CLAUDE.md`.

## Interfaces

```ts
// apps/worker/src/lecture/fournisseur.ts
export type ReponsePage =
  | { readonly ok: true; readonly statutPortail: number; readonly html: string }
  | { readonly ok: false; readonly code: 'AMONT_INDISPONIBLE' | 'AMONT_INVALIDE' };
export interface LecteurPages {
  readonly fournisseur: string;
  lire(url: string): Promise<ReponsePage>;
}

// apps/web/src/enrichissement/contrat.ts
ReponseLectureSchema = z.object({
  portail: PortailSchema,
  url: z.url(),
  tentatives: z.number().int().min(1).max(2),
  obtenuLe: z.iso.datetime(),
  page: z.discriminatedUnion('type', [
    z.object({ type: z.literal('html'), html: z.string().min(1).max(3_000_000) }),
    z.object({ type: z.literal('donnees'), donnees: z.record(z.string(), z.unknown()) }),
  ]),
});

// apps/web/src/annonces/lecture-serveur.ts
export type RaisonEchecServeur =
  'indisponible' | 'introuvable' | 'bloquee' | 'limite' | 'reseau' | 'vide' | 'annulee';
export function lireParServeur(
  url: string,
  client: ClientWorker,
  options?: OptionsLectureServeur,
): Promise<{ ok: true; capture: Capture } | { ok: false; raison: RaisonEchecServeur }>;

// apps/web/src/annonces/attente.ts
export type EtapeAttente = 'contact' | 'verification' | 'lecture' | 'details' | 'long';
export function etatAttente(
  ecouleMs: number,
  portail: Portail,
): { progression: number; etape: EtapeAttente };
```

## Règles de fonctionnement

- **Tentatives** : 2 au plus ; la seconde seulement si la première a rendu une page vide ou sans marqueur (`__NEXT_DATA__`, `__UFRN_LIFECYCLE_SERVERREQUEST__`, `application/ld+json`) et si moins de 75 s se sont écoulées. Statut du portail 404/410 → `ANNONCE_INTROUVABLE` immédiat.
- **Délais** : 70 s par appel Bright Data, 10 s pour Bien'ici ; le web attend 160 s.
- **Correspondance codes → raisons (web)** : `LECTURE_INDISPONIBLE`, `HORS_LIGNE`, `HTTP_404` (Worker ancien) → `indisponible` ; `ANNONCE_INTROUVABLE` → `introuvable` ; `AMONT_*`, `REPONSE_INVALIDE` → `bloquee` ; `TROP_DE_REQUETES` → `limite` ; `RESEAU` → `reseau` (ou `annulee` si le signal est interrompu) ; capture sans prix ni surface → `vide`.
- **Bascule** : extension `absente` → serveur ; extension `presente` → extension ; extension en échec `chargement` ou `vide` → serveur automatiquement ; autres échecs → bouton « Lire sans l'extension ».
- **Progression** : `0,95 × (1 − e^(−2,2·t/durée habituelle))` ; étapes aux fractions 0,15 / 0,45 / 0,8 / 1,5 de la durée habituelle.
- **Correspondances vers le moteur** : `etat` direct ; `exterieur` = `balcon ∨ terrasse ∨ jardin` (faux seulement si au moins un est indiqué et aucun n'est vrai) ; `honorairesAgence` = `honoraires` si `honorairesACharge = acquereur`.

## Patterns

- **Stratégie injectée** : `LecteurPages` (Bright Data aujourd'hui, autre fournisseur demain), `null` sans clé — comme `Extracteur`.
- **Mêmes règles partout** : le Worker ne parse rien ; le navigateur applique `REGISTRE_WEB`, identique à l'extension et au favori.
- **Fonctions pures** pour ce qui se teste sans DOM : `etatAttente`, `ficheDepuisCapture`, `pastillesFiche`, `convertir`, `lireChemin`.
- **Hook isolé** : `useLectureAutomatique` orchestre ; `EtatLectureAuto` et `AttenteLecture` affichent.

## Cas limites

| Module                  | Cas                                                                                                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chemin [*]`            | tableau vide, élément non objet, `[*]` sur un objet, `[*]` imbriqués                                                                                                                                 |
| `urls`                  | chaîne seule, `http:`, `javascript:`, URL invalide, doublons, > 30, > 500 caractères, objets                                                                                                         |
| `date`                  | `2026-02-30`, texte libre, nombre                                                                                                                                                                    |
| `/lecture`              | corps non JSON, > 2 Ko, URL de recherche, hôte imité (`leboncoin.fr.evil.com`), Bright Data 401/5xx/délai, 200 vide ×2, 404 portail, HTML > 3 Mo, Bien'ici 404 / non JSON / tableau, sans clé, débit |
| `lireParServeur`        | réponse forgée, HTML sans données, annulation avant et pendant, Bien'ici sans HTML                                                                                                                   |
| `useLectureAutomatique` | changement d'URL pendant la lecture (réponse tardive ignorée), extension détectée après coup, annulation puis relance                                                                                |
| `CarteBien`             | photos toutes cassées, fiche vide, projet sans annonce                                                                                                                                               |

## ADR locaux

- **ADR-LS1** : le Worker renvoie la page brute et le navigateur applique les règles. Les Workers n'ont pas de DOM ; embarquer un analyseur HTML alourdirait le Worker et dupliquerait les règles. Coût : 70 Ko à 1,6 Mo transférés (compressés par Cloudflare).
- **ADR-LS2** : aucun cache. Un cache KV réduirait la facture mais conserverait le contenu d'annonces chez Deklic (principe 6) et consommerait le quota d'écritures KV.
- **ADR-LS3** : pas de plafond global en KV (1 000 écritures/jour gratuites) ; limite par IP (binding Rate Limiting) et compte Bright Data sans fonds comme plafond de coût.
- **ADR-LS4** : `CaptureSchema` garde `version: 1` : les champs ajoutés sont optionnels, les anciens lecteurs les ignorent (Zod retire les clés inconnues).
- **ADR-LS5** : photos enregistrées comme adresses, affichées depuis les serveurs des portails avec `referrerPolicy="no-referrer"`, jamais copiées.

## Ordre d'implémentation

1. **US-1** capture enrichie + moteur de règles (`packages/capture`) → commit
2. **US-2** règles des cinq portails + fixtures anonymisées → commit
3. **US-3** `POST /lecture` (`apps/worker`) → commit
4. **US-6** correspondances et enregistrement (`apps/web` : `fiche.ts`, `capture.ts`, `projets.ts`, `Partage.tsx`) → commit
5. **US-4** client, `lireParServeur`, hook, `NouveauProjet`, e2e → commit
6. **US-5** écran d'attente → commit
7. **US-7** carte « Le bien » → commit
8. Refactor, QA, audit de sécurité, docs, PR

## Checklist

- [x] Aucun conflit : `/lecture` est une nouvelle route ; `ClientWorker` gagne une méthode (faux clients à compléter)
- [x] Patterns du dépôt : dépendances injectées, codes d'erreur, Zod aux frontières, textes dans `textes/`
- [x] Pas de changement cassant : capture version 1, `ProjetEnregistre.annonce` optionnel
- [x] Entrées validées ; seules les URL d'annonce des cinq portails partent au fournisseur
- [x] Aucun fichier prévu au-delà de 300 lignes (`NouveauProjet.tsx` ≈ 290 : hook sorti)
