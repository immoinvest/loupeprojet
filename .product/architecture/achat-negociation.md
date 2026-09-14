# Architecture : Achat, négociation et travaux (fiche 04)

Discovery : `../features/achat-negociation-discovery.md`. Specs : `../specs/achat-negociation-specs.md`. État de la session : `../pipeline/achat-negociation.json`. Moteur : `moteur-calcul.md`. Hypothèses : `web-socle.md` (onglet Hypothèses, `hypotheses/`).

## Fichiers

```
packages/moteur/src/
├── schema/hypotheses.ts             AchatSchema.negociationTaux (0 à 0,3, défaut 0)
├── achat/index.ts                   prixRetenu, negociationMontant, resumerAchat, tauxPourPrixRetenu, NEGOCIATION_MAX, type ResumeAchat
├── financement/frais-acquisition.ts baseFraisAcquisition sur le prix retenu (honoraires en euros inchangés)
├── financement/index.ts             besoin de financement et effort sur le prix retenu
├── cashflow/charges.ts              provision d'entretien sur le prix retenu
├── rendement/index.ts               coût total sur le prix retenu
├── revente/index.ts                 valeur de revente et prix d'acquisition sur le prix retenu
├── estimation/index.ts              rendement local de repli et ecartPrix sur le prix retenu
├── verdict/index.ts                 feu prix : prix retenu ÷ surface
├── scenarios/prix-cible.ts          avecPrix fixe un prix retenu exact (négociation remise à 0) ; bornes et écart sur le prix affiché
├── scenarios/predefinis.ts          repli du levier « Négocier » : −10 % du prix retenu
├── calculer-base.ts                 ResultatsBase.achat = resumerAchat(projet.hypotheses.achat)
├── schema/resultats.ts              ResultatsSchema.achat (strict)
└── index.ts                         export * from './achat'
packages/moteur/tests/
├── achat/prix-retenu.test.ts        prixRetenu (taux nul sans arrondi, arrondi à l'euro), montant, résumé, taux pour un prix visé (bornes)
├── financement/frais-acquisition.test.ts   cas « 92 K » négocié à 5 % (DMTO sur 82 400 €, vérifié à la main)
├── integration/calculer-projet.test.ts     référence strictement inchangée à taux 0 ; T3 Marseille négocié module par module
├── scenarios/scenarios.test.ts      avecPrix remet la négociation à 0 ; repli du levier sur le prix retenu
└── schema/projet.test.ts            défaut 0, bornes

apps/web/src/
├── composants/Curseur.tsx           <input type="range"> accessible : libellé, valeur lue (aria-valuetext), cible 44 px ; texte seul en mode document
├── analyses/negociation.ts          CURSEUR_NEGOCIATION, pourcentPourViser (arrondi au pas, plafond 15 %, null si rien à négocier), libelles (prix retenu, résumé des travaux)
├── hypotheses/groupes-bien.ts       GROUPE_ACHAT : negociationTaux (pourcent), rénovation énergétique visibleSi nu ∧ travaux > 0, libellé et aide
├── hypotheses/types.ts              Descripteur.aide (phrase sous le champ)
├── ecrans/hypotheses/ChampHypothese.tsx    affiche l'aide
├── ecrans/hypotheses/CarteAchat.tsx        la carte « L'achat » : prix et honoraires, bloc Négociation (champ % + Curseur + prix retenu + Viser), dépliant Travaux
├── ecrans/Hypotheses.tsx            rend CarteAchat pour GROUPE_ACHAT, les autres groupes comme avant
├── ecrans/FormulaireProjet.tsx      « + Ajouter des travaux » (details) autour de « Travaux prévus »
├── ecrans/rapport/CartePrix.tsx     phrase « Prix affiché … · retenu … (−5 %) », jauge sur le prix au m² retenu
├── coque/ProjetLayout.tsx           en-tête : prix retenu · négocié −5 %
├── ecrans/{MesProjets,Comparer}.tsx, ecrans/document/DocumentProjet.tsx   prix retenu (prixRetenu du moteur sur le projet enregistré)
├── ecrans/{Revente,Adresse}.tsx     prix d'achat et prix au m² retenus
├── analyses/comparaison.ts          15 indicateurs : « Négociation » après « Prix affiché » ; prix au m² sur le prix retenu
├── analyses/defauts.ts              negociationTaux
└── textes/{methode-financement,methode-fiscalite,methode-verdict,explications}.ts   prix retenu, case de rénovation nommée, repli −10 % du prix retenu, défaut 0 %
apps/web/tests/
├── negociation.test.ts              pourcentPourViser, libellés
├── hypotheses-achat.test.tsx        curseur, champ %, prix retenu, Viser (présent / absent), dépliant, rénovation conditionnelle
├── comparaison.test.ts, methode.test.ts, hypotheses.test.ts, nouveau-projet.test.tsx, app.test.tsx   mis à jour
apps/web/e2e/hypotheses.spec.ts      négociation à 5 % : en-tête et Rapport
```

## Flux

- **Saisie** : curseur ou champ « Négociation » → `changer(descripteur, '5')` → `appliquerSaisie` (type `pourcent` : « 5 » → 0,05, provenance `achat.negociationTaux = utilisateur`) → `mettreAJour` (Zod) → `calculerProjet` → tout l'onglet et l'en-tête suivent. Le curseur appelle exactement le même chemin que le champ : une seule écriture.
- **Viser** : `pourcentPourViser(achat, estimation.centre)` (web, arrondi au pas et plafond du curseur, sur `tauxPourPrixRetenu` du moteur) → `changer(descripteur, String(pourcent))`.
- **Lecture** : partout où un écran a des `Resultats`, il lit `r.achat` ; là où il n'a qu'un `ProjetEnregistre` (listes, document), il appelle `prixRetenu(projet.hypotheses.achat)` du moteur. Aucun calcul de prix dans les écrans.
- **Moteur** : `prixRetenu` est appelé au plus tôt dans chaque module (financement, charges, rendement, revente, estimation, verdict) ; les scénarios construisent des variantes à négociation nulle avec un prix affiché égal au prix retenu voulu.

## Décisions

- **ADR-N1 : une fonction, pas un champ dérivé stocké.** Le prix retenu n'est jamais enregistré : il se recalcule de `prix` et `negociationTaux`. Un projet partagé ou ancien reste cohérent ; le taux survit à une correction du prix affiché.
- **ADR-N2 : arrondi à l'euro, sauf à taux nul.** Une offre d'achat se fait en euros entiers ; mais à négociation nulle le prix affiché est rendu tel quel pour que les cas de référence (et les prix non entiers) restent strictement identiques.
- **ADR-N3 : négociation sur le total affiché, honoraires fixes.** `baseFraisAcquisition = prixRetenu − honoraires` (si à la charge de l'acquéreur). L'inverse (honoraires proportionnels) tiendrait dans ces deux lignes.
- **ADR-N4 : `avecPrix` remet la négociation à zéro.** Les prix cibles et le levier « Négocier » raisonnent en prix retenu exact ; l'écart affiché reste relatif au prix affiché, puisque c'est de lui que l'on négocie.
- **ADR-N5 : carte « L'achat » dédiée.** Plutôt qu'un type de champ « curseur » générique dans le rendu des groupes, `CarteAchat` compose les descripteurs existants (`descripteurParChemin`) avec le curseur, le prix retenu, le bouton Viser et le dépliant. `GROUPE_ACHAT` reste la source des champs éditables (tests d'unicité, `appliquerSaisie`). `Curseur` est générique (fiche 06).
- **ADR-N6 : rénovation énergétique gardée, cachée.** `visibleSi` sur le descripteur ; libellé et aide lisibles (plafonds lus dans les règles). Aucune règle fiscale retirée.

## Auto-revue

- Recherche exhaustive de `achat.prix` dans le moteur après implémentation : seules les lectures légitimes restent (`achat/`, bornes et écart des prix cibles, exemple, `resumerAchat`).
- Le test d'intégration compare `calculerProjet(projetExemple)` et `calculerProjet` avec `negociationTaux: 0` par `toEqual` : aucun arrondi ne s'est glissé.
- `ResultatsSchema` strict : `achat` ajouté, sinon le test d'intégration échoue.
- Sessions parallèles : `AchatSchema` reçoit une ligne en fin d'objet ; `GROUPE_ACHAT` change dans un seul fichier ; Vérifier n'est touché qu'autour du champ Travaux.
