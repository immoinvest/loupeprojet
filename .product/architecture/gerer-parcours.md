# Architecture : Gérer, pages reliées (G1d)

**Specs** : `.product/specs/gerer-parcours-specs.md` · **Base** : `.product/architecture/gerer-socle.md` (ADR-G1 à G7), `quittances-fiches.md` (G8 à G13), `gerer-biens.md` (G14 à G18), toujours valables

## 1. Vue d'ensemble

```
apps/web seulement : aucune route d'API, aucune migration, @loupe/gestion inchangé

EtatGestion (GestionProvider, déjà chargé)
   │
   ├─ gestion/parcours.ts ─────── adresses des pages, `retour` validé, destination du retour, message après création
   ├─ gestion/fiche-locataire.ts ─ occupations et loyers d'un locataire (réutilise fiche.ts)
   ├─ gestion/a-faire.ts ──────── retards > vacants > e-mails manquants
   └─ gestion/saisie-louer.ts ─── + bien choisi, options de la liste, changement de bien
            │
            ▼
ecrans/gerer/  FicheLocataire (nouveau) · NouveauLocataire (nouveau) · AFaire (nouveau)
               FilAriane · NomsDeLocataires · LocationCreee (nouveaux, partagés)
               LigneDeLoyer · CarteLocation · FriseMois · MesBiens · MesLocataires · LoyersDuMois
               Loyers · FicheBien · ImprimerDocument · useActionsLoyer (liens ajoutés)
```

## 2. Décisions (ADR-G19 à G23)

| ADR | Décision                                                                                                                                                                                                                                                                                                                                                        | Pourquoi                                                                                                                                             | Écarté                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| G19 | **Un objet = une adresse**, construite par une seule fonction de `gestion/parcours.ts` (`lienFicheBien`, `lienFicheLocataire`, `lienNouveauLocataire`, `lienLoyers`, `lienDocument`) ; les écrans de Gérer n'écrivent plus d'adresse à la main                                                                                                                  | Un seul endroit à tester et à changer ; identifiants encodés ; paramètres dans un ordre stable                                                       | Gabarits de chaînes dans chaque écran (divergences, oubli d'encodage)                     |
| G20 | **Retour par le paramètre d'adresse `retour`**, validé par `retourValide` : chemin interne commençant par `/gerer` suivi de rien, `/` ou `?`, sans `//`, `\`, caractère de contrôle ni plus de 300 caractères ; libellé du retour déduit de l'adresse et des données (`destinationRetour`)                                                                      | Survit au rechargement et à l'ouverture dans un nouvel onglet (quittance imprimée) ; aucune redirection ouverte                                      | État de navigation (perdu au rechargement) ; historique `navigate(-1)` (origine inconnue) |
| G21 | **Formulaire unique « Nouveau locataire »** : une page ; le bien se choisit dans `MenuChoix` (« Sans locataire » puis « Déjà loués ») ; choix initial `?bien` s'il existe, sinon premier bien vacant, sinon premier bien ; changer de bien reprend type, loyer, charges et jour de sa dernière location et garde le reste ; `/gerer/biens/:id?louer=1` redirige | Décision de Pierre ; un seul formulaire à faire évoluer (G2 : accord du locataire) ; toujours un bien choisi, donc aucune erreur « choisis le bien » | Formulaire dépliant dans chaque page ; `<select>` natif (règle de `coque-menus`)          |
| G22 | **« À faire » déduit à l'affichage** (`actionsAFaire`), jamais stocké (spec de l'épic § 2) : retards du mois en cours, puis biens vacants par nom, puis locataires en cours ou à venir sans e-mail par nom ; trois lignes, « Voir les N autres » déplie (état local)                                                                                            | Décision de Pierre ; même règle de retard que la pastille du menu ; aucune donnée nouvelle                                                           | Table de tâches ; retards des mois passés (ils restent dans Tous les loyers)              |
| G23 | **Fiche d'un locataire calculée côté web** (`ficheDuLocataire`), comme Mes biens et Mes locataires (ADR-G18) ; loyers du locataire = frise de ses locations (`friseDesLocations`, extraite de `friseDuBien`) sans les mois où il ne devait rien                                                                                                                 | Aucun aller-retour, aucune route ; même calcul de statut que la fiche du bien                                                                        | Route `GET /locataires/:id` (duplication de l'état) ; téléphone (migration, reporté)      |

Le message « Léa Bernard loue Parking Prado. » passe par l'**état de navigation** (`{ loue: { locataireId, locataire, bien } }`, lu par `locationCreee(state)`), comme « … a été supprimé » de G1c : il n'a de sens qu'à l'arrivée.

## 3. Inventaire des fichiers (`apps/web`)

| Fichier                                              | Rôle                                                                                                                                                                                                                                                                                                                 | État               |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `src/gestion/parcours.ts`                            | `lienFicheBien(id, { modifier? })`, `lienFicheLocataire(id, { modifier? })`, `lienNouveauLocataire({ bienId?, retour? })`, `lienLoyers({ periode?, bienId? })`, `lienDocument(id, retour)`, `retourValide`, `cheminDe(location)`, `destinationRetour(chemin, donnees)` → `{ chemin, cible }`, `locationCreee(state)` | nouveau            |
| `src/gestion/fiche-locataire.ts`                     | `ficheDuLocataire(donnees, id, aujourdhui)` → locataire, occupations (location, bien, état `en_cours` / `a_venir` / `terminee`, montants du mois, autres colocataires), loyers                                                                                                                                       | nouveau            |
| `src/gestion/a-faire.ts`                             | `actionsAFaire(donnees, aujourdhui)` → `retard` / `vacant` / `email` ; `A_FAIRE_VISIBLES = 3`                                                                                                                                                                                                                        | nouveau            |
| `src/gestion/fiche.ts`                               | `friseDesLocations(donnees, locations, aujourdhui)` extraite ; `friseDuBien` l'appelle                                                                                                                                                                                                                               | modifié            |
| `src/gestion/saisie-louer.ts`                        | `optionsDesBiens(donnees, aujourdhui)` (groupes de la liste), `bienInitial(options, demande)`, `apresChangementDeBien(saisie, derniere)`                                                                                                                                                                             | modifié            |
| `src/textes/gerer-parcours.ts`                       | fil d'Ariane, « Nouveau locataire », « Louer », « Voir sa fiche », message après création, libellés de retour, « À faire », nom accessible du montant                                                                                                                                                                | nouveau            |
| `src/textes/gerer-locataire.ts`                      | textes de la fiche d'un locataire                                                                                                                                                                                                                                                                                    | nouveau            |
| `src/textes/gerer-louer.ts`                          | « Enregistrer », « Annuler », libellé « Bien », nom du formulaire « Nouveau locataire »                                                                                                                                                                                                                              | modifié            |
| `src/textes/gerer-loyers.ts`                         | `separateurNom(rang, total)` (« , » puis « et »), réutilisé par `nomsDesLocataires`                                                                                                                                                                                                                                  | modifié            |
| `src/ecrans/gerer/FilAriane.tsx`                     | `nav` « Fil d'Ariane », liste ordonnée, dernière étape `aria-current="page"`, liens `survol-texte` de 44 px au doigt                                                                                                                                                                                                 | nouveau            |
| `src/ecrans/gerer/NomsDeLocataires.tsx`              | noms en liens vers les fiches, séparés comme `nomsDesLocataires`                                                                                                                                                                                                                                                     | nouveau            |
| `src/ecrans/gerer/LocationCreee.tsx`                 | message `role="status"` après « Enregistrer » et « Voir sa fiche » (absent sur la fiche de ce locataire)                                                                                                                                                                                                             | nouveau            |
| `src/ecrans/gerer/FicheLocataire.tsx`                | page `/gerer/locataires/:id`                                                                                                                                                                                                                                                                                         | nouveau            |
| `src/ecrans/gerer/locataire/CarteOccupation.tsx`     | une location du locataire                                                                                                                                                                                                                                                                                            | nouveau            |
| `src/ecrans/gerer/NouveauLocataire.tsx`              | page `/gerer/locataires/nouveau` (attente, portes, fil d'Ariane, formulaire)                                                                                                                                                                                                                                         | nouveau            |
| `src/ecrans/gerer/nouveau/FormulaireLouer.tsx`       | le formulaire de `fiche/LouerBien.tsx` déplacé, avec la liste des biens en tête, « Annuler » et « Enregistrer »                                                                                                                                                                                                      | déplacé, modifié   |
| `src/ecrans/gerer/AFaire.tsx`                        | bloc « À faire »                                                                                                                                                                                                                                                                                                     | nouveau            |
| `src/ecrans/gerer/LigneDeLoyer.tsx`                  | noms en liens ; montant en lien vers « Modifier » ; ligne mise en évidence (`aria-current`)                                                                                                                                                                                                                          | modifié            |
| `src/ecrans/gerer/fiche/CarteLocation.tsx`           | noms en liens ; « Modifier » ouvert à l'arrivée                                                                                                                                                                                                                                                                      | modifié            |
| `src/ecrans/gerer/fiche/FriseMois.tsx`               | mois en lien vers les loyers de ce mois ; titre et filtre pour la fiche du locataire                                                                                                                                                                                                                                 | modifié            |
| `src/ecrans/gerer/FicheBien.tsx`                     | fil d'Ariane, message, lien « Ajouter le locataire », redirection `?louer=1`, `?modifier=`                                                                                                                                                                                                                           | modifié            |
| `src/ecrans/gerer/MesBiens.tsx`, `MesLocataires.tsx` | « Louer », noms en liens, « Ajouter un locataire », message                                                                                                                                                                                                                                                          | modifiés           |
| `src/ecrans/gerer/LoyersDuMois.tsx`, `Loyers.tsx`    | « À faire », message ; `?bien=` met la ligne en évidence                                                                                                                                                                                                                                                             | modifiés           |
| `src/ecrans/gerer/ImprimerDocument.tsx`              | retour à l'origine                                                                                                                                                                                                                                                                                                   | modifié            |
| `src/ecrans/gerer/useActionsLoyer.ts`                | le document s'ouvre avec la page courante en `retour`                                                                                                                                                                                                                                                                | modifié            |
| `src/ecrans/gerer/ModifierLocataire.tsx`             | focus sur l'e-mail à l'ouverture par un lien                                                                                                                                                                                                                                                                         | modifié            |
| `src/App.tsx`                                        | routes `gerer/locataires/nouveau` et `gerer/locataires/:id`                                                                                                                                                                                                                                                          | modifié            |
| `e2e/ecrans-gerer.ts`, `e2e/gerer-parcours.spec.ts`  | écrans de référence ; parcours de navigation                                                                                                                                                                                                                                                                         | modifié, nouveau   |
| `tests/…`                                            | `gestion-parcours`, `gestion-a-faire`, `gestion-fiche-locataire`, `gerer-fiche-locataire`, `gerer-nouveau-locataire`, `gerer-a-faire`, `gerer-raccourcis` ; `gerer-louer`, `gerer-accueil`, `gerer-pret`, `gerer-document` mis à jour                                                                                | nouveaux, modifiés |

`fiche/LouerBien.tsx` disparaît (déplacé). Aucun fichier ne dépasse 300 lignes.

## 4. Flux

**Louer depuis Mes biens**

```
MesBiens · ligne vacante « Louer » ── lienNouveauLocataire({ bienId, retour: '/gerer/biens' })      clic 1
  → NouveauLocataire : optionsDesBiens, bienInitial(?bien) ; FormulaireLouer prérempli par derniereLocation
  → « Enregistrer » : occupationDepuisSaisie → useGestion().louer(bienId, occupation)                 clic 2
     ok → navigate(retourValide(?retour) ?? lienFicheLocataire(nouveau.id), { state: { loue } })
  ← MesBiens : LocationCreee lit l'état : « Léa Bernard loue Parking Prado. » · « Voir sa fiche »
```

**Quittance ouverte depuis la fiche d'un bien**

```
FriseMois « mars 2026 » ── lienLoyers({ periode: '2026-03', bienId })                                clic 1
  → Loyers : ligne du bien aria-current ; « Quittance » → useActionsLoyer.ouvrirDocument             clic 2
     → emettreDocument → navigate(lienDocument(id, cheminDe(location)))
  → ImprimerDocument : destinationRetour('/gerer/loyers?mois=2026-03&bien=…', donnees) → « ← Loyers de mars 2026 »
```

## 5. Sécurité

- `retour` : liste blanche de forme (§ ADR-G20), testée avec `https://…`, `//…`, `/\…`, `/gererx`, `/projets`, `javascript:`, caractères de contrôle, longueur ; en cas de doute, valeur par défaut.
- `bien`, `modifier`, `mois` : utilisés seulement pour choisir parmi les données du compte déjà chargées ; un identifiant inconnu ne fait rien.
- Aucun `dangerouslySetInnerHTML`, aucune donnée nouvelle, aucun appel réseau nouveau.

## 6. Ordre d'implémentation

1. **US-1** : `parcours.ts` (adresses), `fiche-locataire.ts`, `friseDesLocations`, `FilAriane`, `NomsDeLocataires`, `FicheLocataire`, noms en liens, fil d'Ariane de la fiche du bien, route.
2. **US-2** : `saisie-louer.ts` (liste, choix, changement), `FormulaireLouer` déplacé, `NouveauLocataire`, `LocationCreee`, `retourValide`, `locationCreee`, « Louer » / « Ajouter un locataire » / fiche, redirection `?louer=1`.
3. **US-3** : `lienDocument`, `destinationRetour`, `ImprimerDocument`, `useActionsLoyer`, frise en liens, `?bien=` sur Loyers, montant en lien, `?modifier=`.
4. **US-4** : `a-faire.ts`, `AFaire`, retrait de « Sans locataire : … ».
5. **US-5** : spec des formats, parcours Playwright.

Un commit par story ; `master` fusionnée avant la QA et juste avant la PR.

## 7. Vérifications avant de coder

- [x] Aucune migration, aucune route : merge automatique possible.
- [x] `MenuChoix` affiche la première option quand la valeur est absente : le formulaire garde donc toujours un bien choisi (ADR-G21).
- [x] `NavLink` « Mes locataires » sans `end` : reste surligné sur `/gerer/locataires/:id` et `/nouveau`.
- [x] Route statique `locataires/nouveau` prioritaire sur `locataires/:id` (classement de React Router).
- [x] Cas limites : colocation (deux liens), location à la chambre (plusieurs locations, « Déjà loués »), locataire sans location, ligne de loyer sans locataire retrouvé (texte seul), bien sans location (repli par défaut), `?modifier=` d'une location d'un autre bien (ignoré).

## Auto-revue (checkpoint validé par Claude, sur autorisation de Pierre)

- **Un module d'adresses (G19)** : sans lui, cinq écrans construiraient `retour` à la main ; la validation serait contournable par un seul oubli.
- **`retour` par l'adresse (G20)** : le seul moyen fiable pour une page hors coque qu'on imprime ; validé strictement parce qu'il devient une destination de navigation.
- **Toujours un bien choisi (G21)** : supprime une erreur et un état de formulaire ; le bailleur corrige le choix s'il le faut, sans clic compté.
- **« À faire » limité au mois en cours (G22)** : cohérent avec la pastille du menu ; les retards anciens restent visibles dans Tous les loyers ; élargir plus tard ne change pas l'API.
- **Risque principal** : les tests de G1b et G1c qui passaient par « Louer » dans la fiche ; ils sont réécrits dans US-2 avec les mêmes preuves (préremplissage, colocataires, chambre, erreurs, refus du serveur, deux clics).
