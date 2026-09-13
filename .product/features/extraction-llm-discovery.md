# Feature Discovery + Specs : Extraction LLM (`POST /extract`)

## Demande

« The key is setup, use the best free model on OpenRouter » (Pierre, 13/09/2026), après la décision d'utiliser une clé OpenRouter plutôt que Mistral direct.

## Analyse

- Le Worker fait lire le texte d'une annonce à un modèle de langage et rend les champs que la page ne donne pas en structuré (étage, ascenseur, charges, taxe foncière, DPE, année, lots, procédure, loyer actuel, chauffage…), au format du contrat Loupe — mêmes noms que la lecture par règles du web (`ChampsExtraits`).
- Le modèle **lit, ne calcule pas** (ADR-003) : température 0, JSON imposé, chaque champ validé par Zod ; hors contrat → `null` + liste `rejetes`.
- Le texte n'est jamais conservé ni journalisé : empreinte SHA-256 (modèle + version du prompt + texte normalisé) comme clé de cache KV 30 jours.
- Fournisseur : connecteur « chat completions » (OpenAI-compatible) → OpenRouter aujourd'hui, Mistral direct demain (`LLM_URL`, `LLM_MODELE`, secret `OPENROUTER_API_KEY`). Sans clé, `/extract` répond `503 EXTRACTION_INDISPONIBLE` et le web garde sa lecture par règles.
- Modèle gratuit choisi d'après le catalogue public d'OpenRouter (`/api/v1/models`, prix 0, `response_format` accepté) : `nvidia/nemotron-3-super-120b-a12b:free`.

## Stories

| Story | Titre                        | Gherkin (résumé)                                                                                                                                                                                                                                                                                                                                 |
| ----- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| US-1  | Contrat                      | `RequeteExtractionSchema` (texte 40 à 8 000 caractères) ; 20 champs nommés ; `normaliserChamps` : coercition des nombres, hors contrat → null + `rejetes`, non-objet → `ErreurAmontInvalide`                                                                                                                                                     |
| US-2  | Prompt et fournisseur        | instructions versionnées (`VERSION_PROMPT`), texte normalisé ; `extracteurChat` : POST OpenAI-compatible, `json_object`, délai 25 s, statuts traduits (429 → `AMONT_SATURE`, 401/403 → `EXTRACTION_INDISPONIBLE`, 5xx → `AMONT_INDISPONIBLE`, contenu illisible → `AMONT_INVALIDE`), `extraireJson` tolérant (clôtures de code, blocs `<think>`) |
| US-3  | Route                        | `POST /extract` : 400 sur corps illisible ou texte invalide, 503 sans clé, cache HIT/MISS (`Cache-Control: no-store` côté navigateur), limite dédiée 10/min/IP, journal des champs écartés (noms seulement)                                                                                                                                      |
| US-4  | Configuration et déploiement | `wrangler.toml` (vars `LLM_URL`, `LLM_MODELE`, binding `LIMITEUR_EXTRACTION`), `.dev.vars.example`, `/health` expose le modèle actif ; déploiement puis test avec une vraie annonce                                                                                                                                                              |
| US-5  | Documentation                | ADR-003 amendé, architecture, README, CLAUDE.md, registre                                                                                                                                                                                                                                                                                        |

## Périmètre

- **IN** : ce qui précède, tests 100 % sur `apps/worker/src/**`.
- **OUT** : l'appel de `/extract` depuis le web (feature `enrichissement-marche`, avec le géocodage, une fois la PR extension fusionnée : elle touche `NouveauProjet.tsx`), la vision (photos), le quota journalier (v1.5 avec les comptes).

## Auto-validation critique

- Un modèle gratuit peut être retiré du catalogue du jour au lendemain : `/health` affiche le modèle actif, `llm.erreur`/`llm.sature` dans les journaux signalent le problème, et le changement se fait par variable sans redéployer le code.
- Les modèles gratuits ont des limites de débit basses (50 requêtes/jour sans crédit) : suffisant pour la bêta, à surveiller ; le cache de 30 jours absorbe les relectures.
- Pas d'indice de confiance : le web signalera « à vérifier » tout champ lu par le LLM, c'est le formulaire Vérifier qui tranche.
