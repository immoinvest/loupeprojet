# Architecture — `formulaire-rapide` (fiches 13 et 20)

Specs : `.product/specs/formulaire-rapide-specs.md`.

## Vue d'ensemble

```
NouveauProjet ─▶ FormulaireProjet (état : Valeurs, provenance, groupes ouverts)
                   │  verifier/groupes.ts   grouperChamps (figé à l'ouverture), resumes, itemsVisibles
                   │  verifier/deductions.ts chambres estimées, valeurs masquées retirées
                   │  verifier/periodes.ts   périodes de construction depuis obtenirRegles
                   ├─ formulaire/Champ.tsx (enveloppe : libellé, ⓘ terme, badge, erreur, indication)
                   ├─ formulaire/Commandes*.tsx (une commande par item)
                   └─ composants/saisie/ Tuiles · Compteur · EchelleEnergie · ChampMontant · Combobox · ChampCommune
ChampCommune ─▶ ClientWorker.communes ─▶ Worker GET /proxy/communes ─▶ geo.api.gouv.fr
ChampHypothese ─▶ Info(GLOSSAIRE[d.terme])
```

## Fichiers

| Fichier                                                                                                  | Rôle                                                                                                     |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `apps/worker/src/services/communes.ts`                                                                   | Service `communes` : paramètres (code postal xor nom), URL API Géo, contrat Zod, `enCache` = code postal |
| `apps/worker/src/services/types.ts`, `proxy/proxy.ts`                                                    | `Service.enCache(parametres)` (défaut : toujours) ; le proxy ne lit ni n'écrit le cache sinon            |
| `apps/web/src/enrichissement/contrat.ts`, `client.ts`                                                    | `ReponseCommunesSchema`, `ClientWorker.communes(recherche, signal)`                                      |
| `apps/web/src/enrichissement/communes.ts`                                                                | Pur : `lireSaisieCommune`, `texteCommune`, `rechercheDepuisTexte`, `optionsCommunes`                     |
| `apps/web/src/composants/saisie/montant.ts`                                                              | Pur : `nettoyerMontant`, `formaterMontant`, `significatifsAvant`, `positionApres`                        |
| `apps/web/src/composants/saisie/compteur.ts`                                                             | Pur : `pasAdaptatif`, `valeurApresPas`, `bornesAtteintes`                                                |
| `apps/web/src/composants/saisie/combobox.ts`                                                             | Pur : `indexActifApres(touche, index, total)`                                                            |
| `apps/web/src/composants/saisie/energie.ts`                                                              | Pur : lettres, largeurs, couleurs de texte                                                               |
| `apps/web/src/composants/saisie/{Tuiles,Compteur,EchelleEnergie,ChampMontant,Combobox,ChampCommune}.tsx` | Commandes contrôlées, sans connaissance du formulaire                                                    |
| `apps/web/src/composants/Curseur.tsx`                                                                    | `valeur: number \| null`, `texteSansValeur`                                                              |
| `apps/web/src/ecrans/hypotheses/SelecteurMode.tsx`                                                       | Réécrit sur `Tuiles`                                                                                     |
| `apps/web/src/textes/glossaire.ts`                                                                       | `CodeTerme`, `GLOSSAIRE`, `texteDuTerme` ; chiffres lus dans `obtenirRegles`                             |
| `apps/web/src/composants/Terme.tsx`                                                                      | `<Terme code="cfe">CFE</Terme>` : mot + ⓘ                                                                |
| `apps/web/src/hypotheses/types.ts` + `groupes-*.ts`                                                      | `terme?: CodeTerme` sur les descripteurs techniques                                                      |
| `apps/web/src/ecrans/hypotheses/ChampHypothese.tsx`                                                      | ⓘ hors du `<label>` (label `htmlFor`)                                                                    |
| `apps/web/src/verifier/items.ts`                                                                         | `Item` (unité d'affichage), carte, libellé de résumé, terme                                              |
| `apps/web/src/verifier/groupes.ts`                                                                       | `grouperChamps(valeurs, provenance)`, `itemsVisibles`, `resumeEstimes`, `resumePreciser`, `itemDeCle`    |
| `apps/web/src/verifier/deductions.ts`                                                                    | `chambresEstimees`, `sansValeursMasquees`, `choixApport`                                                 |
| `apps/web/src/verifier/periodes.ts`                                                                      | `periodesConstruction(regles)`, `periodeDeAnnee`, `anneeRepresentative`                                  |
| `apps/web/src/ecrans/formulaire/Champ.tsx`                                                               | Enveloppe à fonction enfant (ids d'accessibilité)                                                        |
| `apps/web/src/ecrans/formulaire/Commande.tsx`                                                            | Rendu d'un item (switch) ; `ChoixAnnee.tsx`, `ChoixApport.tsx`, `ChoixDuree.tsx`                         |
| `apps/web/src/ecrans/formulaire/Groupe.tsx`                                                              | Résumé repliable et ses cartes                                                                           |
| `apps/web/src/ecrans/FormulaireProjet.tsx`                                                               | Orchestration : état, groupes, soumission, focus d'erreur                                                |

## API des composants réutilisables

### `Combobox<T>` (motif WAI-ARIA « combobox avec liste », autocomplétion `list`)

```ts
interface PropsCombobox<T> {
  id: string; // id de la saisie (label externe par htmlFor)
  nom?: string; // attribut name
  texte: string; // contrôlé
  onTexte: (texte: string) => void; // chaque frappe
  chercher: (texte: string, signal: AbortSignal) => Promise<readonly T[]>; // source injectée
  doitChercher?: (texte: string) => boolean; // défaut : 2 caractères au moins
  delaiMs?: number; // anti-rebond, défaut 250
  cleOption: (o: T) => string;
  libelleOption: (o: T) => string;
  detailOption?: (o: T) => string | undefined;
  onChoix: (o: T) => void;
  onResultats?: (options: readonly T[], texte: string) => void; // ex. choix automatique d'une option unique
  messageAucun?: string; // défaut « Aucun résultat »
  decritPar?: string;
  invalide?: boolean;
  placeholder?: string;
  inputMode?: 'text' | 'numeric';
  autoComplete?: string;
}
```

Clavier : Flèche bas / haut (boucle), Entrée choisit l'option active, Échap ferme puis efface, Tab ferme. La recherche part de la frappe (jamais d'un changement de `texte` par le parent) ; chaque nouvelle frappe annule le minuteur et la requête en cours (`AbortController`) ; une réponse tardive est ignorée. Région `role="status"` pour le nombre de résultats.

### `Tuiles<V>`, `Compteur`, `EchelleEnergie`, `ChampMontant`

Contrôlés par une chaîne (`''` = inconnu), nommés par `idLibelle` / `id`, `decritPar` pour l'aide et l'erreur ; aucun ne connaît `Valeurs`.

## Données et contrats

- Worker : `GET /proxy/communes?codePostal=NNNNN | nom=…` → enveloppe du proxy `{ service, obtenuLe, donnees: { communes: [{ nom, codeInsee, codesPostaux }] } }`. TTL 30 jours, cache seulement par code postal. Worker 0.11.0.
- Web : aucun changement de `Valeurs`, `versSaisie`, `construireProjet`, `ProjetEnregistre`.

## Décisions

- ADR non nécessaire : pas de nouvelle dépendance, même proxy.
- Regroupement figé à l'ouverture (état initial) ; visibilité (maison, RDC) recalculée à chaque rendu.
- Items masqués retirés avant `valider` et `versSaisie` (`sansValeursMasquees`).
- Couverture 100 % : `apps/web/src/{verifier,composants/saisie/*.ts}` ajoutés au glob.

## Ordre d'implémentation

US-1 Worker → US-2 client → US-3 commandes → US-4 Combobox/Commune → US-5 glossaire → US-6 commandes du formulaire → US-7 strict minimum + tests (US-8).

## Auto-revue critique

L'API de `Combobox` sépare la frappe (`onTexte`) du choix (`onChoix`) et injecte la source : S6 pourra brancher le géocodage d'adresse sans toucher au composant. Le risque principal est la taille de `FormulaireProjet` : le rendu par item part dans `Commande.tsx` et les groupes dans `Groupe.tsx` pour rester sous 300 lignes. Validé.
