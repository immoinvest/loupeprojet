# Architecture — Hypothèses et financement (fiches 01 et 03)

Specs : `.product/specs/hypotheses-financement-specs.md`.

## Existant réutilisé

- Moteur : `Resultats.financement` (mensualités, TAEG, échéancier, `parAnnee`, frais d'acquisition, effort), `Resultats.cashflow.tauxCouverture`, `feuCroissant` de `verdict/feux.ts`, `fraisAcquisition`.
- Web : `ChampHypothese`, `appliquerSaisie`, `descripteurParChemin`, `Carte` / `Ligne` / `GrosChiffre` / `Pastille` / `Pourquoi`, `useModeDocument`, `Page` / `TitrePage` / `Chapo`, `Bientot`, encodage base64url de `stockage/partage.ts`.

## Fichiers

```
packages/moteur/src
├── schema/hypotheses.ts            revenusMensuels facultatif
├── schema/resultats.ts             axe 'couverture'
├── financement/effort.ts           depasseHcsf = hcsf !== null && hcsf > seuil
├── financement/index.ts            revenusMensuels ?? 0
├── regles/types.ts, 2026-09.ts     verdict.couverture { bonJusqua 0,70 ; surveillerJusqua 1 } (remplace verdict.effort)
├── verdict/feux.ts, index.ts       feuCouverture(tauxCouverture, regles) ; AxeVerdict 'couverture'
└── exemples/t3-marseille.ts        sans revenusMensuels (les tests HCSF passent des revenus en variante)

apps/web/src
├── stockage/base64url.ts           versBase64Url, depuisBase64Url, encoderJson, decoderJson (extraits de partage.ts)
├── stockage/partage.ts             utilise base64url.ts
├── analyses/simulation-pret.ts     SimulationPretEntreeSchema (copie du contrat 08), simulationDepuisResultats(r),
│                                   encoderSimulation, decoderSimulation, lienSimulateurPret, CHEMIN_SIMULATEUR
├── hypotheses/groupes-bien.ts      GROUPE_MARCHE supprimé
├── hypotheses/groupes-finances.ts  GROUPE_FINANCEMENT sans revenus ; GROUPE_LOCATION + plafond d'encadrement
├── hypotheses/descripteurs.ts      GROUPES (onglet Hypothèses : bien, achat, location, charges, fiscalité),
│                                   TOUS_LES_GROUPES (+ financement) pour descripteurParChemin
├── hypotheses/appliquer.ts         preparerDvf supprimé
├── hypotheses/lisible.ts           texteLisible(descripteur, valeur) : « 14 337 € », « 3,35 % », « 25 ans », « oui »
├── ecrans/hypotheses/GrilleHypotheses.tsx   grille éditable d'un groupe (état textes/erreurs, badges, mettreAJour) ;
│                                   LignesHypotheses en mode document
├── ecrans/Hypotheses.tsx           GrilleHypotheses par groupe ; synthèse : Crédit ÷ loyer
├── ecrans/Financement.tsx          l'onglet : titre, carte Votre prêt (grille + Simuler un prêt), cartes de lecture
├── ecrans/financement/Cartes.tsx   CarteCout, CarteOrigine, CarteCouverture
├── ecrans/financement/TableauAnnuel.tsx     échéancier par phase + tableau par année
├── coque/ProjetLayout.tsx          onglet Financement après Estimation
├── App.tsx                         routes projets/:id/financement et simulateur-pret (Bientot)
├── ecrans/document/DocumentProjet.tsx       volet Financement après le Rapport
├── ecrans/FormulaireProjet.tsx, ecrans/formulaire/valeurs.ts   sans revenus
├── annonces/construire.ts, analyses/defauts.ts                  sans revenus
├── analyses/comparaison.ts         indicateur 'couverture' (Crédit ÷ loyer)
├── composants/ui.tsx               LienBouton (lien stylé comme Bouton, nul en mode document)
├── textes/feux.ts                  AXES.couverture, libelleFeu « Crédit 84 % du loyer »
├── textes/verdict.ts               « le crédit prend 84 % du loyer » / « le crédit dépasse le loyer (110 %) »
├── textes/partage.ts               avertissement sans « revenus »
├── textes/financement.ts           titres, phrases de la carte couverture, explication « Pourquoi ? »
├── textes/methode-financement.ts   étape couverture ; HCSF : durée maximale, revenus non demandés
├── textes/methode-verdict.ts       feu couverture et ses seuils
└── ecrans/MesProjets.tsx           légende « couverture »

apps/web/e2e
├── aides.ts                        creerProjetManuel sans revenus ; Volet + 'Financement'
├── rapport.spec.ts                 sous-titre et feux
├── financement.spec.ts             durée → mensualité ; Simuler un prêt → /simulateur-pret#s=
└── formats.ts                      écran Financement
```

## Interfaces

```ts
// moteur
export function feuCouverture(tauxCouverture: number | null, regles: Regles): FeuVerdict; // axe 'couverture'
// web
export function simulationDepuisResultats(r: Resultats): SimulationPretEntree;
export function lienSimulateurPret(simulation: SimulationPretEntree): string; // « /simulateur-pret#s=… »
export function decoderSimulation(texte: string): DecodageSimulation; // jamais d'exception
export function texteLisible(d: Descripteur, valeur: unknown): string;
export const GROUPES: readonly Groupe[]; // onglet Hypothèses
export const TOUS_LES_GROUPES: readonly Groupe[]; // registre complet (descripteurParChemin)
```

## Flux

```
Financement.tsx ── useProjetCourant() ──▶ enregistre.projet, resultats
   GrilleHypotheses(GROUPE_FINANCEMENT) ── appliquerSaisie ──▶ mettreAJour (Zod) ──▶ recalcul par FournisseurProjet
   LienBouton « Simuler un prêt » ── simulationDepuisResultats(r) ──▶ lienSimulateurPret ──▶ /simulateur-pret#s=…
   Cartes ── r.financement, r.cashflow.tauxCouverture, r.verdict.feux[couverture] ──▶ affichage
```

## Décisions

- **ADR-HF1 — L'axe s'appelle `couverture`.** Un axe nommé `effort` qui mesure autre chose tromperait la prochaine session. Rien n'est persisté : le renommage ne migre rien.
- **ADR-HF2 — Seuils 70 % / 100 %.** 70 % est la part des loyers que le HCSF compte comme revenu (le reste absorbe charges et vacance) : sous ce seuil, le loyer porte le crédit dans la lecture même de la banque ; à 100 % le loyer ne couvre plus que la mensualité. Source « Choix Deklic, aligné sur le HCSF », affichée dans Méthode.
- **ADR-HF3 — Registre complet séparé de l'affichage.** `GROUPES` reste la liste affichée par Hypothèses ; `TOUS_LES_GROUPES` sert aux recherches par chemin (Fiscalité, Revente, Financement). Aucun descripteur du prêt n'est dupliqué.
- **ADR-HF4 — Schéma local du lien.** Le simulateur (fiche 08) mettra son schéma dans le moteur ; en attendant, `analyses/simulation-pret.ts` copie le contrat et le teste. La fiche 08 remplacera l'import, sans changer le lien.
- **ADR-HF5 — Revenus anciens lisibles, jamais demandés.** Le moteur accepte encore `revenusMensuels` ; la carte couverture montre l'effort HCSF quand il existe, avec la mention « revenus indiqués à la création ». Aucun champ ne permet de le saisir.
- **ADR-HF6 — Les hypothèses du prêt en mode document** sont rendues en lignes (`LignesHypotheses`) : un document n'a pas de champs.

## Ordre d'implémentation

1. US-1 moteur + adaptations web minimales pour garder le typecheck vert (feux, verdict, comparaison, synthèse, méthode, légende) — commit.
2. US-2 revenus retirés du web (Vérifier, construction, défauts, textes, partage, tests) — commit.
3. US-3 fiche 03 (groupes, registre, preparerDvf, tests) — commit.
4. US-4 + US-5 onglet Financement, base64url, simulation-pret, page Bientôt, impression, e2e — un ou deux commits.
5. Vérification navigateur, suite complète, couverture, US-6 docs — commit, fusion de master, PR.

## Cas limites

- Capital nul (apport couvre tout) : tableau vide, mensualité 0, TAEG null → « — », couverture 0 % (bon), pas de tableau.
- Loyer 0 : `tauxCouverture` null → feu inconnu, gros chiffre « — ».
- Courte durée : `tauxCouverture` calculé sur le loyer de référence du régime retenu (déjà le cas dans le moteur).
- Différé total + partiel : échéancier à trois phases, mensualité de croisière après le différé.
- Lien `#s=` : différés omis quand nuls ; `fraisNotaire` = total des frais d'acquisition calculés ; honoraires émis seulement s'ils sont à la charge de l'acquéreur (inclus dans le prix, comme dans le contrat 08).
