# Specs : Achat, négociation et travaux (fiche 04)

Discovery : `../features/achat-negociation-discovery.md`. Périmètre : `packages/moteur`, `apps/web` (Hypothèses, Vérifier, Rapport, en-tête, Mes projets, Comparer, Revente, Adresse, document, Méthode), e2e.

Vocabulaire : **prix affiché** = `achat.prix` (honoraires inclus s'ils sont à la charge de l'acquéreur) ; **négociation** = `achat.negociationTaux`, proportion du prix affiché obtenue en moins (0,05 = −5 %) ; **prix retenu** = prix affiché × (1 − négociation), arrondi à l'euro, prix affiché tel quel à négociation nulle. Les honoraires d'agence restent en euros.

Cas de référence : T3 Marseille (`projetExemple`, 155 000 € dont 7 000 € d'honoraires, département 13) et le cas négocié « 92 K » : prix affiché 92 000 € dont 5 000 € d'honoraires à la charge de l'acquéreur, négociation 5 %, département 13.

---

## Épopée E1 : Le moteur retient un prix négocié

### US-1 : Prix retenu partout dans le moteur

En tant que Camille,
je veux fixer la remise que j'ai obtenue ou que je vise,
afin que tout le rapport (notaire, prêt, rendement, revente, feu prix) soit calculé sur le prix que je paierais vraiment.

Priorité : P0 (Must) · Effort : M

```gherkin
Scénario: champ nouveau, migration douce
  Étant donné un projet enregistré sans champ « negociationTaux »
  Quand ProjetSchema le lit
  Alors achat.negociationTaux vaut 0
  Et un taux de −0,01 ou de 0,31 est refusé en nommant « hypotheses.achat.negociationTaux »

Scénario: prix retenu
  Étant donné un prix affiché de 92 000 € et une négociation de 5 %
  Alors prixRetenu vaut 87 400 €
  Et negociationMontant vaut 4 600 €
  Étant donné un prix affiché de 155 000,50 € et une négociation nulle
  Alors prixRetenu vaut exactement 155 000,50 € (aucun arrondi à taux nul)
  Étant donné un prix affiché de 155 001 € et une négociation de 4,5 %
  Alors prixRetenu vaut 148 026 € (arrondi à l'euro)

Scénario: taux qui amène au prix visé
  Étant donné un prix affiché de 155 000 €
  Quand je demande le taux pour retenir 147 250 €
  Alors tauxPourPrixRetenu vaut 0,05
  Quand je demande le taux pour retenir 206 733 € (au-dessus du prix affiché)
  Alors il vaut 0
  Quand je demande le taux pour retenir 50 000 €
  Alors il est plafonné au maximum du schéma (0,3)

Scénario: référence inchangée à négociation nulle
  Étant donné le T3 Marseille
  Quand je le calcule avec negociationTaux = 0 explicite
  Alors les résultats sont strictement égaux (toEqual) à ceux du projet sans le champ
  Et Resultats.achat vaut { prixAffiche: 155 000, prixRetenu: 155 000, negociationTaux: 0, negociationMontant: 0 }

Scénario: frais d'acquisition sur le prix négocié, honoraires inchangés (cas 92 K, vérifié à la main)
  Étant donné 92 000 € affichés, 5 000 € d'honoraires acquéreur, négociation 5 %, département 13
  Alors la base des frais vaut 82 400 € (87 400 − 5 000)
  Et les droits valent 82 400 × (5 % × 1,0237 + 1,2 %) = 5 206,44 €
  Et les émoluments HT valent 6 500 × 3,87 % + 10 500 × 1,596 % + 43 000 × 1,064 % + 22 400 × 0,799 % = 1 055,63 €
  Et le total des frais vaut 5 206,44 + 1 055,63 × 1,2 + 82,40 + 329,60 = 6 885,19 € (± 1 €)

Scénario: le T3 Marseille négocié à 5 % (vérifié module par module)
  Étant donné le T3 Marseille avec negociationTaux = 0,05
  Alors Resultats.achat vaut { prixAffiche: 155 000, prixRetenu: 147 250, negociationTaux: 0,05, negociationMontant: 7 750 }
  Et la base des frais d'acquisition vaut 140 250 €
  Et le montant emprunté vaut 147 250 + 6 000 + frais + 850 + 1 500 − 14 337
  Et la provision d'entretien vaut 0,5 % × 147 250 = 736,25 € par an
  Et le coût total des rendements vaut 147 250 + 6 000 + frais
  Et la valeur de revente vaut 147 250 × 1,015^10 et le prix d'acquisition de la plus-value 147 250 €
  Et la base amortissable du bâti vaut 140 250 × 85 %
  Et l'écart de prix de l'estimation vaut 147 250 ÷ 206 733 − 1
  Et le feu prix vaut 147 250 ÷ 65 ÷ 3 181 − 1
  Et ResultatsSchema accepte le rapport ; six scénarios et trois prix cibles sont présents

Scénario: scénarios et prix cibles
  Étant donné un projet négocié à 5 %
  Quand une variante est construite par avecPrix(projet, 80 000)
  Alors sa négociation vaut 0 et son prix affiché 80 000 (prix retenu exact)
  Et l'écart d'un prix cible reste calculé par rapport au prix affiché
  Étant donné un projet sans loyer (aucun prix cible)
  Alors le levier « Négocier » retient 90 % du prix retenu, arrondi à l'euro
```

---

## Épopée E2 : L'onglet Hypothèses

### US-2 : Carte « L'achat » : curseur, prix retenu, travaux repliés

En tant que Camille,
je veux régler ma négociation d'un geste et voir le prix retenu,
afin de lire aussitôt l'effet sur le cash-flow et le verdict.

Priorité : P0 (Must) · Effort : L

```gherkin
Scénario: curseur et champ
  Étant donné l'onglet Hypothèses du T3 Marseille
  Alors la carte « L'achat » montre « Prix affiché », « Honoraires d'agence », « Honoraires à la charge de l'acquéreur »
  Et un curseur « Négociation » de 0 à 15 par pas de 0,5, valeur 0, lu « 0 % »
  Et un champ « Négociation » en % à côté, valeur « 0 »
  Et la ligne « Prix retenu 155 000 € »
  Quand je règle le curseur sur 5
  Alors le projet enregistré porte negociationTaux = 0,05 et la provenance « utilisateur » sur achat.negociationTaux
  Et la ligne dit « Prix retenu 147 250 € · −7 750 € (−5 %) »
  Et le champ « Négociation » affiche « 5 »
  Et la synthèse (cash-flow) est recalculée
  Quand je tape « 20 » dans le champ
  Alors le taux vaut 0,2 et le curseur est à son maximum (15)
  Quand je tape « 40 »
  Alors la valeur est refusée avec un message et la dernière valeur valide reste

Scénario: viser le prix estimé
  Étant donné un projet dont l'estimation existe et dont le centre est sous le prix affiché
    (T3 Marseille avec une médiane de marché à 2 000 €/m² : estimation ≈ 137 000 €)
  Alors la carte montre « Viser le prix estimé »
  Quand je clique
  Alors le taux devient le taux arrondi au pas de 0,5 % qui amène le prix retenu au plus près du centre, plafonné à 15 %
  Étant donné le T3 Marseille tel quel (estimation 206 733 € au-dessus du prix affiché)
  Alors le bouton n'est pas affiché et une phrase dit que le prix affiché est déjà sous l'estimation
  Étant donné un projet sans estimation
  Alors ni bouton ni phrase

Scénario: travaux repliés
  Étant donné un projet à 0 € de travaux et 4 875 € de mobilier estimé
  Alors la carte montre le dépliant fermé « + Ajouter des travaux · mobilier 4 875 € »
  Et les champs Travaux, Rénovation énergétique, Mobilier ne sont pas visibles
  Quand j'ouvre le dépliant
  Alors « Travaux » et « Mobilier » sont visibles (badge « estimé » sur le mobilier)
  Étant donné un projet à 6 000 € de travaux
  Alors le dépliant est ouvert et son résumé dit « Travaux 6 000 € · mobilier 5 000 € »

Scénario: rénovation énergétique seulement quand elle joue
  Étant donné un projet meublé avec 6 000 € de travaux
  Alors la case « Ces travaux font sortir le logement des classes E, F ou G » n'est pas visible
  Étant donné un projet en location nue avec 6 000 € de travaux
  Alors la case est visible avec l'aide « Déficit foncier imputable sur le revenu global porté de 10 700 € à 21 400 € (nu au réel, jusqu'au 31/12/2027). »
  Étant donné un projet en location nue avec 0 € de travaux
  Alors la case n'est pas visible

Scénario: accessibilité et formats
  Alors le curseur porte un libellé, aria-valuetext « −5 % », une hauteur de cible de 44 px au doigt
  Et en mode document (impression, partage) le curseur devient le texte « Négociation −5 % »
  Et la carte tient sur 320 px sans défilement horizontal
```

---

## Épopée E3 : Le prix retenu partout où le prix est lu

### US-3 : Rapport, en-tête, listes, Comparer, Revente, Adresse, document

En tant que Camille,
je veux voir le même prix partout,
afin de ne jamais douter du chiffre sur lequel le rapport est calculé.

Priorité : P0 (Must) · Effort : M

```gherkin
Scénario: rapport
  Étant donné le T3 Marseille négocié à 5 %
  Alors la carte « Est-ce que c'est cher ? » dit « Prix affiché 155 000 € · retenu 147 250 € (−5 %) »
  Et la jauge place le prix au m² retenu (2 265 €/m²)
  Étant donné une négociation nulle
  Alors la carte dit « Prix affiché 155 000 € » sans suite

Scénario: en-tête, Mes projets, sélection de Comparer, document imprimé
  Étant donné un projet négocié à 5 %
  Alors l'en-tête du projet dit « 147 250 € · négocié −5 % · meublé longue durée »
  Et la carte de Mes projets, la case à cocher de Comparer et l'en-tête du document montrent 147 250 €
  Étant donné une négociation nulle
  Alors ils montrent le prix affiché sans mention

Scénario: Comparer
  Alors le tableau compte 15 indicateurs : « Prix affiché », « Négociation » (« −5 % », ou « aucune » à 0), puis « Prix au m² » sur le prix retenu, etc.
  Et « Négociation » n'a pas de meilleure valeur mise en avant ; le tri « plus haut d'abord » range la plus forte négociation en tête

Scénario: Revente et Adresse
  Alors la ligne « Prix d'achat » de la plus-value vaut le prix retenu
  Et le prix au m² du bien de l'onglet Adresse est calculé sur le prix retenu
```

---

## Épopée E4 : Vérifier, Méthode, preuve de bout en bout

### US-4 : Travaux repliés à la création, Méthode et e2e

Priorité : P1 (Should) · Effort : S

```gherkin
Scénario: Vérifier
  Étant donné le formulaire Vérifier
  Alors « Travaux prévus » n'est pas visible ; un dépliant « + Ajouter des travaux » est proposé
  Quand je l'ouvre et saisis 6 000
  Alors le projet créé porte 6 000 € de travaux
  Étant donné une annonce (ou une capture) qui donne des travaux
  Alors le dépliant est ouvert d'office

Scénario: Méthode
  Alors « Les frais d'acquisition » dit « Prix retenu = prix affiché × (1 − négociation), arrondi à l'euro ; les honoraires d'agence restent en euros. Base = prix retenu − honoraires… »
  Et « Le crédit » dit « Emprunt = prix retenu + travaux… »
  Et « Nu au réel » nomme la case « Ces travaux font sortir le logement des classes E, F ou G »
  Et « Les scénarios » dit « à défaut, −10 % du prix retenu »
  Et « Les valeurs par défaut » liste « Négociation : 0 % (prix affiché retenu tel quel) »

Scénario: bout en bout (Playwright, ordinateur)
  Étant donné le projet d'exemple ouvert sur Hypothèses
  Quand je règle « Négociation » sur 5
  Alors l'en-tête dit « 147 250 € · négocié −5 % »
  Et le Rapport dit « Prix affiché 155 000 € · retenu 147 250 € (−5 %) »
```

## MoSCoW

- **Must** : US-1, US-2, US-3.
- **Should** : US-4.
- **Won't (cette feature)** : saisie de la négociation en euros, surenchère, lecture d'un prix négocié dans une annonce, curseur d'horizon (fiche 06), hypothèses optionnelles (fiche 02).

## Contrats

- `AchatSchema.negociationTaux : number` (0 ≤ x ≤ 0,3, défaut 0).
- `prixRetenu(achat): number` ; `negociationMontant(achat): number` ; `resumerAchat(achat): ResumeAchat` ; `tauxPourPrixRetenu(achat, prixVise): number` (borné à [0, 0,3]).
- `Resultats.achat : { prixAffiche, prixRetenu, negociationTaux, negociationMontant }` (`ResultatsSchema` strict).
- Web : `analyses/negociation.ts` : `CURSEUR_NEGOCIATION = { min: 0, max: 15, pas: 0.5 }`, `pourcentPourViser(achat, prixVise): number | null` (null si rien à négocier), `resumeNegociation(...)` pour les libellés.
