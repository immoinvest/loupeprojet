# Discovery — `formulaire-rapide` (fiches de backlog 13 et 20)

Session de nuit S3 du 15/09/2026, branche `feat/formulaire-rapide`. Fiches : `.product/backlog/13-formulaire-verifier-sans-saisie.md`, `.product/backlog/20-infobulles-termes.md`.

## Le problème

L'étape « Vérifier » de Nouveau projet (`ecrans/FormulaireProjet.tsx`) aligne 28 saisies libres et listes déroulantes dans quatre cartes : on tape chaque chiffre, on ouvre chaque liste, on relit ce que l'annonce a déjà donné, et des termes comme « DPE », « GES », « Lots de copropriété » ou « CFE » (Hypothèses) ne sont expliqués nulle part.

## Ce que l'utilisateur obtient (outcomes)

1. **Le strict minimum d'abord** : seuls les chiffres qui manquent parmi l'essentiel (prix, surface, commune, loyer visé, type de location s'il n'a pas été lu) sont affichés ; le reste est replié en trois résumés : « Lu dans l'annonce », « Estimé pour vous », « Préciser (facultatif) ».
2. **Presque plus de chiffres à taper** : compteurs − / + (pièces, chambres, étage, lots, chambres louées), tuiles (type de bien, état, oui / non, périodes de construction, apport, durée, tranche), échelles DPE et GES colorées, curseur des nuits louées, montants mis en forme pendant la frappe (« 155 000 »).
3. **Un seul champ « Commune »** : cinq chiffres → la ville se remplit (plusieurs communes : une liste, un clic) ; un nom → suggestions. Sans Worker à jour, « 69003 Lyon » tapé à la main suffit.
4. **Moins de questions inutiles** : maison → ni étage, ni ascenseur, ni copropriété ; rez-de-chaussée → pas d'ascenseur ; chambres déduites des pièces (« estimé »).
5. **Chaque terme technique expliqué** : icône ⓘ à côté des termes de Vérifier et d'Hypothèses, définition courte et source, chiffres lus dans les règles du moteur.

## Sorties (outputs)

- `apps/web/src/composants/saisie/` : `Tuiles`, `Compteur`, `EchelleEnergie`, `ChampMontant`, `Combobox` (générique, réutilisé par S6 pour l'adresse), `ChampCommune` ; logique pure testée à 100 %.
- `apps/web/src/verifier/` : regroupement « strict minimum », périodes de construction, chambres estimées, masquage (pur, 100 %).
- `apps/web/src/textes/glossaire.ts` + composant `Terme` ; `terme` sur `Descripteur` et sur `Champ`.
- Worker : service `communes` du proxy (API Géo), cache 30 jours par code postal, recherche par nom sans cache.
- Client web `communes` revalidé par Zod.

## Hors périmètre

Moteur (aucun changement), travaux estimés (S5), `CarteAchat` au-delà de l'infobulle, onglet Estimation (S6, S7), commandes riches dans Hypothèses (feature suivante, fiche 13 Q3), infobulles des autres onglets (Fiscalité, Revente, Financement, Rapport : faute de temps, composant `Terme` prêt).

## Contraintes

- **Aucun changement de contrat** : chaque commande lit et écrit la même chaîne de `Valeurs` ; `valider`, `versSaisie`, `construireProjet` et le moteur ne bougent pas. Projets existants inchangés.
- Accessibilité : boutons radio natifs, `input type="range"` natif, motif WAI-ARIA combobox, cibles de 44 px, champs de 16 px au doigt.
- Mobile d'abord (règle `responsive`), survol par recettes `survol-*`.
- Pas de déploiement : sans Worker 0.11, `ChampCommune` retombe sur la saisie libre « code postal ville ».

## Données vérifiées

- API Géo : `https://geo.api.gouv.fr/communes?codePostal=13005&fields=nom,code,codesPostaux&format=json` → `[{ nom: "Marseille", code: "13055", codesPostaux: [...] }]` (commune entière, pas l'arrondissement). Le reste de l'app retrouve déjà l'arrondissement par le code postal (`/marche`) : on garde « Marseille ». Recherche par nom : `?nom=lyon&fields=nom,code,codesPostaux&boost=population&limit=…`.
- Règles de visite : plomb avant 1949, amiante avant 1997, installations anciennes au-delà de 15 ans (année de référence 2026) → périodes « Avant 1949 », « 1949 à 1996 », « 1997 à 2011 », « 2012 et après » (bornes calculées depuis `obtenirRegles`, jamais recopiées).

## Décisions prises à la place de Pierre (questions ouvertes)

| Question                              | Décision (proposition des fiches)                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 13-Q1 barème pour la tranche          | Non : cinq tuiles et une ligne d'aide                                                                                     |
| 13-Q2 lots de copropriété             | Compteur à pas adaptatif (1 jusqu'à 20, puis 10)                                                                          |
| 13-Q3 mêmes commandes dans Hypothèses | Feature suivante ; seules les infobulles y arrivent                                                                       |
| 13-Q4 apport                          | Tuiles 0 · 10 · 20 % · Autre ; le montant reste affiché et modifiable sous les tuiles                                     |
| Année choisie par période             | Année représentative (milieu de la période) marquée « estimé » : mêmes questions de visite, jamais présentée comme exacte |
| Commune sans Worker                   | Le champ unique accepte « 69003 Lyon » : code postal et ville sont lus dans le texte                                      |
| Maison                                | Étage, ascenseur, charges, lots et procédure masqués et non transmis (modifiables ensuite dans Hypothèses)                |
| 20-Q1 bulle ou phrase                 | Bulle ⓘ pour la définition ; l'aide actuelle reste sous le champ                                                          |
| 20-Q2 où s'arrêter                    | Vérifier et Hypothèses ; autres onglets plus tard                                                                         |
| 20-Q3 page glossaire                  | Non : la page Méthode a été retirée le 14/09/2026                                                                         |
| 20-Q4 survol                          | Clic et focus seulement, comme le composant `Info` existant                                                               |

## Risques

- Mise en forme des montants pendant la frappe (position du curseur, collage) → logique pure testée.
- Dix-sept fichiers de tests remplissent le formulaire → mis à jour dans la même branche.
- Définitions du glossaire : chiffres lus dans les règles, sources citées ; relecture de Pierre recommandée.

## Auto-revue critique

Le périmètre réunit deux sessions de la fiche 13 et la fiche 20 : c'est gros. Pour tenir, les commandes riches restent limitées à Vérifier (pas Hypothèses), le « Marché : 690 € — utiliser » dans le champ loyer est remplacé par le bouton « Estimer le loyer » existant placé sous le loyer, et la taxe foncière estimée par le taux REI n'est pas affichée (donnée pas lue côté formulaire). Ces reports sont notés dans le rapport. Le regroupement est figé à l'ouverture du formulaire : un champ ne saute pas d'un groupe à l'autre pendant qu'on le remplit. Validé.
