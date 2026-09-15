# Architecture — adresse-suggestions

Discovery : `.product/features/adresse-suggestions-discovery.md` · Specs : `.product/specs/adresse-suggestions-specs.md` · Fiche : `.product/backlog/21-adresse-autocompletion.md`.

## Vue d'ensemble

```
ChampAdresse (Combobox de S3)
  ├─ frappe (250 ms, AbortController) ─▶ client.suggererAdresses ─▶ Worker /proxy/adresses ─▶ Géoplateforme autocomplete (sans cache KV)
  ├─ si faut chercher au cadastre ─────▶ client.adressesDvf ──────▶ Worker /marche/adresses-dvf ─▶ R2 dvf/<millésime>/<codeInsee>.csv (KV 24 h par commune)
  └─ choix ─▶ adresseDepuisSuggestion ─▶ Adresse.analyser(AdresseBien) ─▶ /marche/adresse (inchangé)
```

## Worker (Worker 0.11.0)

| Fichier                                             | Rôle                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/adresses.ts`                          | Service `adresses` : `q` 3-200, `limit` 1-10 (6), `lat`/`lon` facultatifs ensemble, `codePostal` facultatif ; URL `…/geocodage/search?autocomplete=1&index=address` ; réponse `{ suggestions }` sans `municipality` ; `ttlSecondes: 0` = aucun cache. Réutilise le schéma et les précisions de `geocodage.ts` (exportés). |
| `src/services/types.ts`                             | `ttlSecondes: 0` documenté : ni lecture ni écriture du cache.                                                                                                                                                                                                                                                             |
| `src/proxy/proxy.ts`                                | Saute `lireCache`/`ecrireCache` quand `ttlSecondes === 0` ; `Cache-Control` navigateur court (`private, max-age=300`).                                                                                                                                                                                                    |
| `src/app.ts`, `src/dependances.ts`, `wrangler.toml` | `limiteurSuggestions` (binding `LIMITEUR_SUGGESTIONS`, 120/60 s, namespace 1004) ; le middleware `/proxy/*` choisit ce limiteur pour `/proxy/adresses`. Route `/marche/adresses-dvf` sous `LIMITEUR`.                                                                                                                     |
| `src/adresse/adresses-dvf.ts`                       | Pur : `normaliserTexte` (majuscules, sans accents, ponctuation → espace, abréviations RES/RTE/AV/BD/CHE/IMP/ALL/PL/LOT/DOM → forme longue), `lireRecherche(texte)` → `{ numero, mots }` (numéro 1-4 chiffres, codes postaux et mots vides retirés), `regrouperAdresses(ventes)` → adresses par `numero                    | suffixe | codeVoie | voie`avec parcelles, point moyen des ventes situées, nombre de ventes ;`filtrerAdresses(adresses, recherche, limite)` : numéro égal s'il est tapé, au moins un mot significatif trouvé en début d'un mot de la voie, tri par mots trouvés puis ventes. |
| `src/adresse/route-adresses-dvf.ts`                 | `GET /marche/adresses-dvf?codeInsee&texte&limit` : Zod, cache `adresses-dvf` v1 par commune (liste regroupée), `ventesCommune` partagé avec `route.ts` (extrait), écriture seulement sans panne R2 ; réponse `{ codeInsee, millesime, adresses, sources }`.                                                               |

## Web

| Fichier                              | Rôle                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `enrichissement/contrat.ts`          | `SuggestionAdresseSchema`, `ReponseSuggestionsSchema`, `AdresseDvfSchema`, `ReponseAdressesDvfSchema`.                                                                                                                                                                                                                                                             |
| `enrichissement/client.ts`           | `suggererAdresses(texte, contexte, signal)`, `adressesDvf(codeInsee, texte, signal)` ; hors ligne → `HORS_LIGNE`.                                                                                                                                                                                                                                                  |
| `enrichissement/suggestions.ts`      | Pur : `numeroTape`, `fautChercherAuCadastre(texte, suggestions)`, `suggestionsAAfficher(ban, dvf, codePostalProjet)` (numéro > rue > lieu-dit, code postal du projet d'abord, cadastre après la BAN, dédoublonnage), `adresseDepuisSuggestion`, `adresseDepuisCadastre`, `adresseDeRue(suggestion, numero)`, `libelleCadastre` (casse de titre). Couverture 100 %. |
| `composants/saisie/ChampAdresse.tsx` | Sur `Combobox` de S3 : source asynchrone (BAN puis cadastre), options en deux lignes, message vide / indisponible, contexte « Suggestions d'abord à … ».                                                                                                                                                                                                           |
| `ecrans/adresse/NumeroRue.tsx`       | « Numéro ? » + « Analyser » + « Je ne connais pas le numéro ».                                                                                                                                                                                                                                                                                                     |
| `ecrans/Adresse.tsx`                 | Formulaire seulement : `ChampAdresse`, choix → `choisir(suggestion)` ; `chercher()` garde le géocodage et le message cadastre pour un numéro ≥ 9000.                                                                                                                                                                                                               |
| `textes/adresse.ts`                  | Phrases : cadastre, sans numéro, aucune suggestion, indisponible, contexte.                                                                                                                                                                                                                                                                                        |

## Écarts constatés pendant l'implémentation

- **Pas de `ttlSecondes: 0`** : la fiche 13 (PR #81) a livré l'option `enCache(parametres)` des services ; `adresses` la règle à `false` (aucune lecture ni écriture KV), `proxy.ts` n'est pas modifié.
- **Débit** : `limiterDebit` accepte un limiteur ou une fonction « chemin → limiteur » ; `/proxy/*` choisit `limiteurSuggestions` pour `/proxy/adresses`. Le binding `LIMITEUR_SUGGESTIONS` est facultatif (repli sur `LIMITEUR`) : un Worker déployé sans lui reste correct, et les environnements de test existants n'ont pas changé.
- **Contexte de l'écran** : le projet enregistré ne garde ni code postal ni ville (seulement `bien.departement`). `ContexteAdresse` = `{ departement, adresse? }` : les suggestions du département du projet passent d'abord (`dansLeDepartement`, qui réutilise `departementDuCodePostal`), la phrase d'aide dit « Suggestions d'abord dans le département 13. », la commune du cadastre vient de la première suggestion située, sinon de l'adresse enregistrée. Biais de position : le point de l'adresse enregistrée.
- **`Adresse.tsx` sous 300 lignes** : le choix (rue en attente, note, `chercher`, `choisir`, `numeroDeRue`) est dans `ecrans/adresse/useChoixAdresse.ts`.
- **Accessibilité** : l'annonce du Combobox sans résultat est courte (« Aucune suggestion ») ; la phrase complète est affichée sous le champ et le décrit (`aria-describedby`).
- **Numéro inconnu de la BAN pour une rue choisie** : analyse au point de la rue avec ce numéro et le code de voie de la rue (groupes « même côté » et « en face ») ; numéro fiscal → message du cadastre.
- Worker **0.12.0** (0.11.0 était déjà pris par la fiche 13, non déployée).

## Décisions

- Suggestions BAN sans KV ni Cache API (réponses rapides, pas d'état à gérer) ; cache navigateur 5 min.
- Adresse du cadastre : `codeVoie` DVF (`A285`) passé tel quel à `/marche/adresse` (regex `[0-9A-Za-z]{4}` déjà acceptée) ; le groupe « Même immeuble » se trouve par numéro + code de voie.
- Pas de nouveau champ dans `ProjetEnregistre` : l'origine « cadastre » n'est affichée que pendant la session.
- Le point d'une adresse du cadastre = moyenne des points des ventes (le CSV porte le point de la parcelle).

## Ordre d'implémentation

1. US-1 Worker adresses DVF (commit) · 2. US-2 Worker suggestions + débit (commit) · 3. US-3/US-4 web logique pure + client (commit) · 4. écran et composant (commit) · 5. e2e (commit) · 6. docs.

## Auto-revue critique

- `ttlSecondes: 0` évite un second chemin de proxy tout en gardant la liste blanche ; testé par l'absence d'appel au cache.
- Extraire `ventesCommune` de `route.ts` touche un fichier voisin (même périmètre `adresse/`), sans changer son comportement.
- L'API exacte du `Combobox` de S3 sera lue après sa fusion ; `ChampAdresse` s'y adapte sans modifier le composant, sauf manque signalé dans la PR.
  Validé.
