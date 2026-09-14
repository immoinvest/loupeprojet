# Architecture : Lecture automatique d'un lien collé (`lecture-auto`)

Complète `architecture/extension.md`. Coller le lien d'une annonce dans Nouveau projet suffit quand l'extension Deklic est installée : l'extension ouvre l'annonce dans un onglet du navigateur de l'utilisateur, la lit, referme l'onglet, et le formulaire Vérifier se remplit.

```
packages/capture/src/
├── portails.ts        adresses SeLoger / Logic-Immo relevées le 13/09/2026 (identifiants alphanumériques) + anciennes ; Bien'ici à soulignés ; MOTIFS_PORTAILS
├── pont.ts            protocole page ↔ extension : MessageWeb (ping, lire), MessageExtension (pong, resultat), raisons d'échec (Zod)
├── schema.ts          + typeBien, lotsCopro, coproEnProcedure
└── regles/            source `donnees` + `donnees.url` (adresse relative au portail, {id}) ; analyserJson lit aussi window["X"]=JSON.parse("…") ;
                       capturerAvecDonnees(document, url, regles, { charger }) : chargeur injecté, un échec n'empêche pas la lecture de la page

apps/extension/
├── manifest.json      0.2.0 : host_permissions des cinq portails ; background (service_worker Chrome, scripts Firefox) ; content_scripts pont.js sur *.loupeprojet.pages.dev et localhost (document_start)
├── regles/*.json      réécrites d'après les pages réelles (LeBonCoin __NEXT_DATA__, SeLoger/Logic-Immo __UFRN_LIFECYCLE_SERVERREQUEST__, Bien'ici /realEstateAd.json, PAP JSON-LD)
├── src/pont.ts        écoute la page Deklic (source et origine vérifiées), répond au ping, relaie « lire » vers l'arrière-plan
├── src/arriere-plan.ts NAVIGATEUR (chrome.tabs / scripting / permissions), attendreChargement, ecouterDemandes (messages de cette extension seulement)
├── src/logique/lecteur.ts creerLecteur : permission → onglet caché à côté de Deklic → lectures jusqu'à prix + surface → sinon onglet affiché et nouvelles lectures → fermeture, retour sur Deklic ; une lecture à la fois ; ne lève jamais
├── src/logique/lire-page.ts lirePage (async, avec données) ; chargeurDuPortail (même origine, cookies du visiteur, refuse toute adresse hors portail)
├── src/contenu.ts     dépose une promesse du résultat ; executeScript attend la promesse
└── src/popup.ts       bouton « Autoriser la lecture automatique » (permissions.request) quand le navigateur n'accorde pas les hôtes d'office (Firefox)

apps/web/src/
├── annonces/extension.ts        detecterExtension (ping, 500 ms), lireParExtension (90 s) : window.postMessage, réponse par identifiant, source et origine vérifiées
├── annonces/capture.ts          importerCapture : champsPage (données de la page) + champs (complétés par les règles de texte) + description en mémoire
├── enrichissement/lecture.ts    completerAvecIa : s'il manque étage, ascenseur, DPE, année, charges, taxe foncière ou honoraires, l'IA lit la description ; les données de la page restent prioritaires
├── ecrans/nouveau-projet/LectureAuto.tsx  useLectureAutomatique (détection, pause de 600 ms après le collage, lecture, complément IA) + EtatLectureAuto (en cours, échec + Réessayer, invitation à installer)
├── ecrans/NouveauProjet.tsx     branche la lecture automatique ; la capture reçue par l'adresse est complétée de la même façon
├── ecrans/FormulaireProjet.tsx  + type de bien, GES, lots et procédure de copropriété
├── annonces/construire.ts       bien.type, bien.ges, bien.copro { lots, procedure } avec provenance
└── textes/lecture-auto.ts       une phrase par raison d'échec
```

## Flux

1. **Montage** : `detecterExtension(window)` poste `{ source: 'deklic-web', type: 'ping', id }` ; le pont (chargé à `document_start`) répond `pong`. Sans réponse en 500 ms : pas d'extension, l'écran invite à l'installer.
2. **Collage** : le lien est reconnu (`resoudreAnnonce`) ; 600 ms plus tard, `lireParExtension(window, urlCanonique)` poste `lire`. Le pont envoie `{ type: 'deklic-lire', url }` au service d'arrière-plan.
3. **Arrière-plan** (`creerLecteur`) : vérifie la permission du portail ; ouvre l'annonce dans un onglet inactif placé juste après l'onglet Deklic ; attend `status: complete` (20 s au plus) ; injecte `contenu.js` jusqu'à 5 fois (1 s d'écart) tant que prix ou surface manquent ; sinon affiche l'onglet (page qui ne se dessine pas cachée, contrôle anti-robot à valider) et réessaie jusqu'à 20 fois ; garde la capture la plus riche ; ferme l'onglet et réactive l'onglet Deklic.
4. **Contenu** : `lirePage` résout le portail, charge au besoin les données de l'annonce sur le portail même (Bien'ici `/realEstateAd.json?id=…`), applique les règles, rend `{ ok, capture | raison }`.
5. **Web** : `importerCapture` puis `completerAvecIa` (un appel au Worker `/extract` avec la description, seulement s'il manque des champs que le texte donne) ; le formulaire Vérifier se remplit, badge « lue par l'extension ». Échec : phrase par raison, « Réessayer la lecture », texte collé toujours disponible.

## Patterns

- **Protocole typé partagé** (`@loupe/capture/pont.ts`) : la page, le pont et l'arrière-plan valident chaque message par Zod ; tout ce qui ne vient pas de la page elle-même (source, origine) est ignoré ; les demandes à l'arrière-plan ne sont acceptées que de cette extension.
- **Orchestration sans `chrome.*`** : `lecteur.ts` reçoit un `Navigateur` ; `arriere-plan.ts` n'est qu'un branchement, testé avec un faux `chrome`.
- **Données chargées injectées** : `@loupe/capture` ne fait aucune requête ; le script de contenu fournit le chargeur, limité à l'origine du portail.
- **Priorité des sources** : données structurées de la page > IA sur le texte > règles regex sur le texte.

## ADR locaux

- **ADR-LA1** : permissions d'hôte sur les cinq portails. Nécessaires pour ouvrir et lire un onglet sans clic sur l'annonce ; c'est plus que `activeTab` (ADR-E3 de la feature `extension` amendé). Aucun accès aux autres sites, aucun stockage, aucun réseau vers nos serveurs depuis l'extension.
- **ADR-LA2** : l'onglet s'ouvre caché, puis s'affiche en second essai. Les portails à rendu serveur (LeBonCoin, SeLoger, Logic-Immo, PAP) se lisent cachés ; Bien'ici passe par ses données JSON ; l'affichage ne sert qu'aux pages protégées ou lentes.
- **ADR-LA3** : la requête `/realEstateAd.json` de Bien'ici part du navigateur de l'utilisateur, sur Bien'ici, avec ses cookies, comme la page elle-même : conforme à l'ADR-002 (lecture côté client).
- **ADR-LA4** : complément par l'IA seulement s'il manque des champs que le texte donne souvent : un appel au Worker au plus par annonce (quota du modèle gratuit : 50 lectures par jour).
