# Architecture : Visite — base de questions, règles, réponses conservées

Discovery : `../features/visite-questions-discovery.md`. Specs : `../specs/visite-questions-specs.md`. État : `../pipeline/visite-questions.json`. Socles : `moteur-calcul.md`, `web-socle.md`, `garder.md` (impression, partage), `responsive.md`.

## Fichiers

```
packages/moteur/src/
├── regles/types.ts, 2026-09.ts        + visite : amianteAvantAnnee 1997, plombAvantAnnee 1949, installationsAnciennesAns 15,
│                                        etageSansAscenseur 3, chambreColocationM2 9 (sources en commentaire)
├── verdict/vigilance.ts               ne garde que les cinq points financiers (EFFORT_HCSF_DEPASSE, DUREE_PRET_HORS_HCSF,
│                                        PLAFOND_MICRO_DEPASSE, LOYER_AU_DESSUS_PLAFOND, PS_BIC_A_CONFIRMER)
├── verdict/index.ts                   pointsDeVigilance(projet, financement, fiscalite)
└── visite/
    ├── types.ts                       CategorieVisite (7, ordonnées), TypeExploitation (5), ContexteVisite, Question, QuestionPosee, ValeurQuestion
    ├── contexte.ts                    typeExploitation(projet), contexteVisite(projet, resultats) ; prédicats : copro, maison, appartement,
    │                                    avant(cleRegle), anneeInconnue, dpeParmi, dpeInconnu, exploitationParmi, meuble, feu(axe, etat),
    │                                    risquesSignales, tous, unDe, non
    ├── base/{documents,diagnostics,logement,immeuble,quartier,vendeur,exploitation}.ts
    │                                  la base, une catégorie par fichier (moins de 300 lignes chacun), chaque question sourcée
    ├── questions.ts                   QUESTIONS_VISITE (assemblage), VERSION_QUESTIONS_VISITE, questionsPourProjet(projet, resultats)
    └── index.ts
packages/moteur/tests/visite/
├── contexte.test.ts                   typeExploitation, prédicats un par un (vrai et faux), contexte du projet d'exemple
└── questions.test.ts                  cohérence de la base, trois projets types (présences, absences, comptages), paramètres, gabarits

apps/web/src/
├── stockage/projets.ts                EtatReponseSchema, ReponseVisiteSchema (note ≤ 300), VisiteSchema, ProjetEnregistre.visite?,
│                                        OptionsCreation.visite? et adresse?
├── stockage/ProjetsContext.tsx        mettreAJour(id, projet, { adresse?, visite? })
├── visite/
│   ├── reponses.ts                    VISITE_VIDE, visiteDe, reponseDe, repondre, noter, marquerFaite, rouvrir, progression, aDesReponses
│   ├── questions.ts                   questionsDuProjet(enregistre, resultats), grouperParCategorie, descripteurDeValeur
│   └── index.ts
├── textes/visite.ts                   CATEGORIES_VISITE, ETATS_REPONSE, texteQuestion (jetons → formats), phraseProgression, phraseVisite (Rapport)
├── textes/vigilance.ts                phraseVigilance pour les cinq codes financiers ; plus de catégories
├── textes/methode-verdict.ts          phrase sur la visite corrigée
├── ecrans/Visite.tsx                  page : en-tête (titre, progression, feux), groupes, « Marquer la visite comme faite », compte rendu, « Rouvrir »
├── ecrans/visite/
│   ├── QuestionVisite.tsx             une question : texte, source, ChoixEtat, note, champ à valeur ; lecture seule en mode document ou visite faite
│   ├── ChoixEtat.tsx                  quatre boutons radio (fieldset, legend sr-only), 44 px au doigt
│   ├── ChampValeur.tsx                ChampHypothese branché sur appliquerSaisie + mettreAJour, passe la question à « OK »
│   └── Progression.tsx                barre (role progressbar) et phrase
├── ecrans/rapport/Vigilance.tsx       carte « Avant de faire une offre » (points financiers) et lien vers la visite
├── ecrans/Rapport.tsx                 insère la carte sous les feux
├── ecrans/FormulaireProjet.tsx        case « J'ai déjà visité ce bien » ; onCreer(saisie, { visiteFaite })
├── ecrans/NouveauProjet.tsx           creer({ …, visite }) quand la case est cochée
├── ecrans/Partage.tsx                 « Ajouter » transmet visite et adresse
├── ecrans/document/DocumentProjet.tsx volet Visite : « Préparer la visite » (non faite) ou « Compte rendu de visite » (faite, avec réponses) ; absent sinon
└── coque/ProjetLayout.tsx             onglet Visite masqué quand la visite est faite
apps/web/tests/
├── visite.test.ts                     reponses.ts, questions.ts, textes/visite.ts (100 %)
├── visite-ecran.test.tsx              écran : groupes, répondre, note, valeur, marquer, compte rendu, rouvrir
├── stockage.test.tsx, partage.test.tsx  visite : migration, création, mise à jour, aller-retour, taille au pire
├── onglets.test.tsx, impression.test.tsx, textes.test.tsx, nouveau-projet.test.tsx, app.test.tsx  mis à jour
apps/web/e2e/
├── onglets.spec.ts                    parcours visite réécrit (radios, rechargement, visite faite)
└── formats.ts                         écran « Visite faite » (compte rendu) ajouté aux écrans de référence
```

## Modèle

```ts
// moteur
type CategorieVisite = 'documents' | 'diagnostics' | 'logement' | 'immeuble' | 'quartier' | 'vendeur' | 'exploitation';
type TypeExploitation = 'nue' | 'meublee' | 'colocation' | 'courte_duree' | 'moyenne_duree';
interface ContexteVisite { projet: Projet; exploitation: TypeExploitation; feux: readonly FeuVerdict[]; regles: Regles; anneeReference: number }
interface Question {
  id: string; categorie: CategorieVisite; texte: string; source: string;
  condition?: (ctx: ContexteVisite) => boolean;          // absente = pour tout projet
  parametres?: (ctx: ContexteVisite) => Record<string, number | string>;
  valeur?: { chemin: string; type: 'euros' | 'entier' | 'nombre' | 'enum' };
}
interface QuestionPosee { id; categorie; texte; source; parametres; valeur? }
questionsPourProjet(projet: Projet, resultats: Pick<Resultats, 'verdict'>): readonly QuestionPosee[]

// web, stockage
Visite = { faite: boolean; date?: string; reponses: Record<string, { etat: 'a_verifier' | 'ok' | 'probleme' | 'sans_objet'; note?: string }> }
ProjetEnregistre.visite?: Visite   // absent = visite non faite, aucune réponse
```

## Flux

- **Afficher** : `useProjetCourant()` → `questionsPourProjet(projet, resultats)` (mémoïsé sur `resultats`) → `grouperParCategorie` → une carte par catégorie → `QuestionVisite` lit `reponseDe(visiteDe(enregistre), id)`.
- **Répondre** : radio → `repondre(visite, id, etat)` → `mettreAJour(id, enregistre.projet, { visite })` → `localStorage` → re-rendu. Note : `noter(visite, id, texte)`, même chemin. Une réponse « à vérifier » sans note est retirée du `Record` (état par défaut) : le fragment de partage reste court.
- **Valeur** : `ChampValeur` → `appliquerSaisie(projet, descripteurParChemin(chemin), texte)` → `mettreAJour(id, projet, { visite: repondre(visite, id, 'ok') })` si la question était encore « à vérifier ». La provenance « utilisateur » vient d'`appliquerSaisie`. Les conditions se recalculent avec le nouveau projet : répondre à l'année de construction fait apparaître amiante ou plomb.
- **Marquer** : `marquerFaite(visite, isoDuJour)` → `mettreAJour` → `naviguer('/projets/:id')`. `ProjetLayout` filtre l'onglet. `/projets/:id/visite` reste servi : compte rendu + « Rouvrir » (`rouvrir(visite)`).
- **Créer** : Vérifier coche → `NouveauProjet` → `creer({ nom, source, visite: { faite: true, date, reponses: {} } })`.
- **Imprimer / partager** : `DocumentProjet` choisit le volet Visite selon `visite.faite` et `aDesReponses` ; `Visite` en mode document rend les états en pastilles et les notes en texte. Le fragment de partage porte `visite` par `ProjetEnregistreSchema` ; « Ajouter » transmet `visite` et `adresse`.
- **Rapport** : `r.verdict.vigilance` (financiers) → `phraseVigilance` → carte « Avant de faire une offre » ; lien `phraseVisite(visite, progression)`.

## Décisions

- **ADR-V1 : gabarits dans le moteur, formatage dans le web.** Le texte d'une question vit dans la base (fiche 07) avec des jetons `{dpe}`, `{etage}`, `{annee}`, `{lots}`, `{ecart}`, `{risques}`, `{honoraires}`, `{travaux}`, `{surface}`, `{chambres}`. Le moteur fournit les paramètres bruts (nombres, codes) ; `texteQuestion` du web les formate (euros, pourcentage signé, libellés Géorisques). Le moteur ne compose jamais un montant.
- **ADR-V2 : les neuf points « sur place » quittent le verdict.** `verdict.vigilance` ne garde que ce qui se règle avant l'offre et ne se vérifie pas en visite ; la forme de `ResultatsSchema` ne change pas (codes en `[A-Z_]+`). Aucun autre module ne lisait ces codes.
- **ADR-V3 : réponses par identifiant, jamais interprétées.** `Record<id, réponse>` validé par Zod, orphelins ignorés ; aucun feu ne dépend d'une réponse (pas de score magique). Seules les questions à valeur écrivent une hypothèse, par les descripteurs existants.
- **ADR-V4 : onglet masqué, route ouverte.** Une visite marquée faite par erreur se rouvre depuis le Rapport ou l'adresse du volet ; aucun état n'est perdu.
- **ADR-V5 : types d'exploitation anticipés.** `typeExploitation(projet)` traduit le mode d'aujourd'hui (nue, meublée, courte durée) ; colocation et moyenne durée existent dans les conditions et les tests, injoignables jusqu'à la fiche 05, qui n'aura que cette fonction à changer.
- Seuils datés (amiante, plomb, installations, étage, chambre) dans `regles/2026-09.ts` avec leur source, comme les autres constantes datées ; pas de section Méthode dédiée en v1 (la source s'affiche sous chaque question).
- Radios natifs (`fieldset` + `input type="radio"`) plutôt que des boutons `aria-pressed` : sémantique « un choix parmi quatre », flèches du clavier, sélecteurs Playwright par rôle.

## Ordre d'implémentation

1. US-1 moteur : règles, types, contexte, base, `questionsPourProjet`, vigilance réduite ; tests moteur et textes web ajustés.
2. US-2 stockage : schémas, `reponses.ts`, `questions.ts` (web), contexte, création, partage ; tests.
3. US-3 écran : textes, composants, page ; tests d'écran.
4. US-4 autour : Rapport, Vérifier, onglets, impression, partage, Méthode ; tests.
5. US-5 preuve : Playwright, formats, navigateur ; docs communes (cleanup).

## Auto-revue

- La base tient sous 300 lignes par fichier grâce au découpage par catégorie ; `questions.ts` ne fait qu'assembler.
- Couverture : chaque condition et chaque fonction `parametres` est exécutée par les trois projets types (les conditions sont toutes évaluées à chaque appel) ; les branches « colocation » et « moyenne durée » le sont par un contexte forgé.
- Le fragment de partage au pire (toutes les questions du projet complet répondues, notes de 120 caractères) reste sous 20 Ko, loin des limites des navigateurs ; l'infobulle du bouton Partager dit déjà que le lien contient tout le projet.
- Aucun `dangerouslySetInnerHTML`, aucune phrase venue d'un modèle de langage : notes et textes affichés comme texte.
