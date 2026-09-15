# 13 — Formulaire Vérifier : moins de clics, presque plus de chiffres à taper

Statut : `livrée` le 15/09/2026 (feature `formulaire-rapide` : [discovery](../features/formulaire-rapide-discovery.md), [specs](../specs/formulaire-rapide-specs.md), [architecture](../architecture/formulaire-rapide.md) ; questions restantes tranchées selon les propositions, détail dans la discovery) · Notée le 14/09/2026 · Dépend de : rien (réutilise `Curseur` de la fiche 06 et `SelecteurMode` de la fiche 05) · Taille : deux sessions (voir « Découpage »)

## La demande de Pierre

> Lorsque je crée un nouveau projet, je veux que le formulaire où je peux remplir les différents éléments soit beaucoup plus fluide pour l'utilisateur, avec moins de clics et moins besoin de taper des chiffres. Par exemple, le nombre de chambres : des clics pour augmenter ou baisser. L'année de construction : un curseur. Le DPE : une échelle où l'on choisit directement la lettre. Le code postal doit choisir la ville automatiquement. Réfléchis toi-même au meilleur moyen, la meilleure UX pour chaque élément, pour que ce soit super facile à remplir : le bien, la location, vous, charges connues, etc.

## Ce qui existe aujourd'hui

- Écran : `apps/web/src/ecrans/NouveauProjet.tsx` → étape « Vérifier » = `apps/web/src/ecrans/FormulaireProjet.tsx`, quatre cartes : **Le bien** (15 champs + travaux repliés), **La location** (`SelecteurMode` + 1 ou 2 champs + `EstimerLoyer`), **Vous** (apport, durée, tranche), **Charges connues** (4 champs), puis « J'ai déjà visité ce bien ».
- Un seul composant de champ, `ecrans/formulaire/Champ.tsx` : soit un `<input inputMode="decimal">` libre, soit un `<select>` natif (DPE, GES, état, oui/non, tranche). Badge de provenance « annonce » / « estimé » / « à toi ».
- État : `ecrans/formulaire/valeurs.ts` — toutes les valeurs sont des **chaînes** (`Valeurs`, 28 clés), `''` = inconnu ; `valider` (seuls prix, surface, code postal et ville sont exigés), `versSaisie` → `construireProjet`. Changer un champ passe la provenance à `utilisateur`.
- Les chiffres ne sont pas mis en forme pendant la frappe (« 155000 »).
- Code postal et ville : deux saisies libres, rien ne les relie.
- Données déjà disponibles : le référentiel `communes` (`data/src/schemas/communes.ts`) porte `codesPostaux` ; le Worker lit déjà `geo.api.gouv.fr` (`adresse/voisines.ts`) et a un proxy à liste blanche (`apps/worker/src/services/index.ts` : `geocodage`, `dpe`, `risques`).
- Ce que le moteur fait des champs (vérifié le 14/09) : `annee` ne sert qu'aux questions de visite (`moteur/src/visite/contexte.ts`) ; `lotsCopro` qu'à la vigilance copro ; **aucun barème de l'impôt** dans les règles (la tranche est choisie, pas calculée).

## Principes proposés pour tout le formulaire

1. **Une commande par nature de donnée** : compter → compteur − / + ; choisir parmi peu → tuiles (boutons radio) ; ordonner sur une échelle → échelle cliquable ; valeur continue sans besoin de précision → curseur ; montant précis → saisie gardée, mais mise en forme et pavé numérique.
2. **Cacher ce qui ne s'applique pas** : maison → ni étage, ni ascenseur, ni charges, lots et procédure de copropriété ; étage 0 → pas d'ascenseur.
3. **Déduire au lieu de demander** : ville depuis le code postal, chambres = pièces − 1 (marqué « estimé »), chambres louées = chambres (déjà fait).
4. **« Je ne sais pas » reste un choix** : chaque commande peut revenir à `''` (re-clic sur la tuile choisie ou la lettre choisie, compteur vidé). Jamais de valeur inventée : un défaut affiché porte « estimé ».
5. **Aucun changement de contrat** : chaque commande lit et écrit la même chaîne de `Valeurs` → `valider`, `versSaisie`, `construireProjet` et le moteur ne bougent pas.
6. Cibles de 44 px, boutons radio et `<input type="range">` natifs (clavier, lecteurs d'écran), comme `SelecteurMode` et `Curseur`.

## Champ par champ

### Le bien

| Champ                 | Aujourd'hui      | Proposition                                                                                                                                                                                                                                                                                                       | Pourquoi                                                                                                                                                                                             |
| --------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type de bien          | liste            | **2 tuiles avec icône** (Appartement, Maison), en tête de carte                                                                                                                                                                                                                                                   | 1 clic ; pilote l'affichage des champs de copro et d'étage                                                                                                                                           |
| Prix affiché          | saisie libre     | **Saisie montant** : pavé numérique, espaces des milliers pendant la frappe (« 155 000 € »), unité dans le champ                                                                                                                                                                                                  | Montant précis, souvent déjà lu dans l'annonce : un curseur serait pire                                                                                                                              |
| dont honoraires       | saisie libre     | Replié derrière « + Honoraires d'agence » (comme les travaux), ouvert d'office si l'annonce les donne                                                                                                                                                                                                             | Rarement connu : un champ de moins à voir                                                                                                                                                            |
| Surface               | saisie libre     | Saisie montant (m², une décimale)                                                                                                                                                                                                                                                                                 | Précision au m² utile au prix au m²                                                                                                                                                                  |
| Pièces                | saisie libre     | **Compteur − 3 +** (1 à 10)                                                                                                                                                                                                                                                                                       | Demande explicite                                                                                                                                                                                    |
| Chambres              | saisie libre     | **Compteur** (0 à 9), pré-rempli à pièces − 1 « estimé » tant qu'on n'y touche pas                                                                                                                                                                                                                                | Un clic au lieu d'une saisie                                                                                                                                                                         |
| Étage                 | saisie libre     | **Compteur** avec « RDC » à 0 (0 à 30) ; masqué pour une maison                                                                                                                                                                                                                                                   | —                                                                                                                                                                                                    |
| Ascenseur             | liste ?/oui/non  | **Interrupteur à 2 tuiles** Oui / Non (aucune = inconnu) ; masqué pour une maison ou au RDC                                                                                                                                                                                                                       | 1 clic au lieu de 2 (ouvrir la liste, choisir)                                                                                                                                                       |
| Année de construction | saisie libre     | **4 tuiles de périodes** calées sur les seuils des règles de visite : « Avant 1949 » (plomb) · « 1949 à 1996 » (amiante) · « 1997 à N−16 » · « N−15 et après » (installations récentes) ; lien « Je connais l'année » → saisie à 4 chiffres ; une année lue dans l'annonce s'affiche telle quelle, période cochée | Personne ne connaît l'année exacte, tout le monde sait « ancien / années 70 / récent » ; un curseur de 176 ans est imprécis au doigt ; les périodes donnent exactement les mêmes questions de visite |
| DPE                   | liste A-G        | **Échelle énergie** : 7 barres A → G aux couleurs officielles, largeur croissante, un clic choisit la lettre, re-clic = inconnu                                                                                                                                                                                   | Demande explicite ; se lit comme l'étiquette que tout acheteur connaît                                                                                                                               |
| GES                   | liste A-G        | Même échelle, teintes GES (violet), placée sous le DPE                                                                                                                                                                                                                                                            | Cohérence                                                                                                                                                                                            |
| État                  | liste            | **4 tuiles** À rénover · À rafraîchir · Bon état · Rénové                                                                                                                                                                                                                                                         | Choix ordonné et court                                                                                                                                                                               |
| Balcon ou terrasse    | liste ?/oui/non  | Interrupteur Oui / Non                                                                                                                                                                                                                                                                                            | —                                                                                                                                                                                                    |
| Code postal + Ville   | 2 saisies libres | **Un seul champ « Commune »** : taper 5 chiffres → la ville se remplit seule ; code postal partagé par plusieurs communes → une puce par commune, un clic ; taper un nom → suggestions (décidé)                                                                                                                   | Demande explicite ; supprime une saisie et les fautes de frappe de ville                                                                                                                             |
| Travaux               | replié + saisie  | Inchangé (replié), saisie montant                                                                                                                                                                                                                                                                                 | Déjà livré par la fiche 04                                                                                                                                                                           |

### La location

| Champ                        | Proposition                                                                                                                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type de location             | Inchangé (`SelecteurMode`, tuiles)                                                                                                                                                              |
| Loyer visé (nu, meublé, MD)  | Saisie montant ; **« Estimer le loyer » devient un bouton placé dans le champ** ; quand le loyer de marché est connu, il s'affiche en indication cliquable (« Marché : 690 €/mois — utiliser ») |
| Chambres louées (colocation) | Compteur (1 à 20), pré-rempli par les chambres (déjà fait)                                                                                                                                      |
| Loyer par chambre            | Saisie montant                                                                                                                                                                                  |
| Prix de la nuitée            | Saisie montant                                                                                                                                                                                  |
| Nuits louées par mois        | **Curseur** 0 → 31 avec le taux d'occupation affiché (« 18 nuits · 59 % »)                                                                                                                      |

### Vous

| Champ                | Proposition                                                                                                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apport               | **Tuiles 0 % · 10 % · 20 % · Autre** du coût total (10 % « estimé » par défaut, comme aujourd'hui) ; le montant en euros s'affiche sous les tuiles ; « Autre » ouvre la saisie montant |
| Durée du prêt        | **Tuiles 15 · 20 · 25 ans · Autre** (Autre = compteur 1 à 30) ; 25 ans reste le défaut « estimé »                                                                                      |
| Tranche d'imposition | **5 tuiles** 0 · 11 · 30 · 41 · 45 % avec une ligne d'aide (« Sur votre avis d'impôt : taux marginal »). Pas d'assistant de calcul sans barème sourcé dans les règles (Q4)             |

### Charges connues

| Champ                    | Proposition                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| Charges de copropriété   | Saisie montant €/mois ; masqué pour une maison                                                      |
| Taxe foncière            | Saisie montant €/an ; quand le taux REI de la commune est connu, indication « estimée à ~ 1 100 € » |
| Lots de copropriété      | Compteur avec pas adaptatif (1 jusqu'à 20, puis 10) ou saisie (Q5) ; masqué pour une maison         |
| Copropriété en procédure | Interrupteur Oui / Non ; masqué pour une maison                                                     |

### « J'ai déjà visité ce bien »

Case à cocher → interrupteur, inchangé sinon.

## Composants à créer (dossier proposé `apps/web/src/composants/saisie/`)

| Composant        | Rôle                                                                                                      | Base                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `Compteur`       | − / valeur / + ; la valeur reste un `<input inputMode="numeric">` éditable (garde `getByLabel(...).fill`) | nouveau ; boutons nommés « Une chambre de moins/plus » |
| `Tuiles`         | groupe de boutons radio générique, re-clic = inconnu en option                                            | généraliser `ecrans/hypotheses/SelecteurMode.tsx`      |
| `EchelleEnergie` | 7 lettres en barres colorées, radios natives ; variante `dpe` / `ges`                                     | nouveau ; couleurs en tokens dans `index.css`          |
| `ChampMontant`   | mise en forme fr-FR pendant la frappe, curseur de texte conservé, stocke la chaîne brute                  | nouveau ; remplace la branche `input` de `Champ`       |
| `ChampCommune`   | code postal → communes, puces de choix, repli en saisie libre hors ligne ou si le Worker ne répond pas    | nouveau + service Worker                               |
| `Curseur`        | ajouter l'état « sans valeur » (prop `valeur: number \| null`, texte « Je ne sais pas »)                  | `composants/Curseur.tsx` (fiche 06)                    |

`Champ` garde son rôle d'enveloppe (libellé, badge de provenance, erreur, indication) et reçoit la commande en enfant.

## Code postal → ville : le service

- Worker : nouveau service de proxy `communes` (`apps/worker/src/services/communes.ts`, ajouté à `SERVICES`) : `GET /proxy/communes?codePostal=13005` → `https://geo.api.gouv.fr/communes?codePostal=…&fields=nom,code,codesPostaux` ; réponse validée par Zod, `{ communes: [{ nom, codeInsee }] }` ; cache KV 30 jours (un code postal ne change quasiment jamais) ; limite par IP existante.
- Arrondissements : `geo.api.gouv.fr` renvoie « Marseille » pour 13005 ; le reste de l'app (DVF par arrondissement) retrouve déjà l'arrondissement par le code postal → on garde « Marseille », à vérifier en discovery.
- Web : `ClientWorker.communes(codePostal)` revalidé par Zod ; appel déclenché à la 5ᵉ chiffre, pas à chaque frappe ; `clientHorsLigne` → saisie de la ville à la main, comme aujourd'hui.
- Option : garder aussi le `codeInsee` choisi pour éviter un géocodage ensuite (hors périmètre si ça touche `construireProjet`).
- Déploiement : **Worker à redéployer par Pierre** (`npm run deploy -w apps/worker`).

## Affichage : le strict minimum d'abord (décidé)

Le formulaire ne montre d'emblée **que ce qui manque parmi l'essentiel** ; tout le reste est replié, jamais perdu.

1. **Visible, en haut, seulement s'il manque** : prix, surface, commune (les trois champs exigés), puis le loyer visé (le chiffre qui change le plus le verdict ; facultatif mais mis en avant). Le type de location reste visible s'il n'a pas été lu.
2. **Une ligne de résumé par groupe**, repliée :
   - « ✓ Lu dans l'annonce : 11 informations — Voir / modifier » (les champs de provenance `annonce`) ;
   - « Estimé pour vous : apport 10 %, 25 ans, tranche 30 % — Modifier » (provenance `estime`) ;
   - « Préciser pour une analyse plus juste (facultatif) : DPE, état, charges de copro, taxe foncière… — Ouvrir » (les champs vides, **les plus influents en tête** : DPE et état pèsent sur l'estimation, charges et taxe sur le cash-flow).
3. Ouvrir un résumé déplie ses champs, avec les commandes décrites plus haut, rangés par carte (Le bien, La location, Vous, Charges).
4. Saisie à la main (sans annonce) : même logique ; les trois champs exigés, le type et le loyer visibles, le reste dans « Préciser ».
5. Le bouton « Créer le projet et voir le rapport » est visible sans défiler dès que l'essentiel est rempli ; un champ exigé en erreur rouvre son groupe et y place le focus.
6. Rien ne change dans `valeurs.ts` : l'ordre et le repli se calculent depuis `Valeurs` et `ProvenanceValeurs` (fonction pure `grouperChamps(valeurs, provenance, typeBien, mode)`, testée à 100 %).

## Décisions prises (14/09/2026)

- Adresse : **un seul champ « Commune »** qui accepte le code postal ou le nom.
- Commandes : **choisies par Claude selon les bonnes pratiques** ; les exemples de Pierre (curseur pour l'année…) sont des pistes, pas des ordres. D'où les périodes pour l'année.
- Affichage : **le strict minimum d'abord**, ce qui manque en priorité (section ci-dessus).

## Questions restantes (Claude tranche en discovery si Pierre ne dit rien)

1. **Tranche d'imposition** : ajouter un petit calcul « revenu imposable + parts → tranche » ? Il faut alors le barème de l'impôt dans `packages/moteur/src/regles/` (sourcé, daté). Proposition : pas dans cette fiche.
2. **Lots de copropriété** : compteur à pas adaptatif, ou tuiles « Moins de 10 · 10 à 49 · 50 à 199 · 200 et plus » (il faudrait alors stocker une valeur représentative, ce qui fausse le nombre) ? Proposition : compteur.
3. **Onglet Hypothèses** : mêmes commandes dans `ecrans/hypotheses/ChampHypothese.tsx` ? Proposition : oui, mais en feature suivante (règle « une feature par session ») ; les composants sont écrits pour servir aux deux.
4. **Apport** : tuiles de pourcentage ou curseur 0 → 30 % ? Proposition : tuiles (1 clic, valeurs rondes que les banques demandent).

## Découpage proposé

1. **Session A — commandes et strict minimum** : `Compteur`, `Tuiles` (dont périodes de construction), `EchelleEnergie`, `ChampMontant`, masquage selon le type de bien, chambres déduites des pièces, `grouperChamps` et les résumés repliables. Aucun Worker.
2. **Session B — commune, location, vous, charges** : service `communes` (Worker + client), `ChampCommune`, commandes des cartes Location / Vous / Charges.

## Tests à mettre à jour

- Dix-sept fichiers remplissent le formulaire par libellé : Vitest `app`, `analyse-incomplete`, `financement-ecran`, `location-types-ecrans`, `nouveau-projet` (+ `-auto`, `-capture`, `-enrichi`, `-serveur`), `simulateur-ecran`, `tranche-supposee`, `verifier-travaux` ; Playwright `aides.ts` (`creerProjetMinimal` : Prix, Surface, Code postal, Ville, Loyer, Apport), `financement`, `hypotheses`, `incomplet`, `location-types`.
- Ce qui reste compatible : les saisies montant et la valeur du `Compteur` gardent leur libellé (`getByLabel('Prix affiché').fill` marche toujours). Ce qui casse : les `selectOption` (DPE, GES, état, oui/non, tranche) → `getByRole('radio', { name })` ; « Code postal » et « Ville » deviennent « Commune » ; les champs repliés doivent être ouverts avant d'être remplis (aide e2e `ouvrirGroupe`) → dans les tests, le client Worker simulé renvoie la commune, et hors ligne la saisie libre sert de repli (e2e sans Worker).
- Nouveaux tests : chaque composant (clavier, bornes, re-clic = inconnu, mise en forme des milliers avec le curseur de texte, lecteurs d'écran) ; masquage maison / RDC ; chambres estimées puis écrasées ; service `communes` du Worker (0, 1, plusieurs communes, réponse amont invalide, cache) ; `ChampCommune` hors ligne.

## Coût et risques

- Un appel à l'API Géo (gratuite, sans clé) par code postal saisi, mis en cache 30 jours : négligeable face au quota Workers.
- Risque principal : la mise en forme des montants pendant la frappe (position du curseur de texte, collage « 155 000 € ») — tests dédiés.
- Aucun changement du moteur ni des données enregistrées : les projets existants s'ouvrent à l'identique.
