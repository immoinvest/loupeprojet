# Specs — Hypothèses et financement (fiches 01 et 03)

Discovery : `.product/features/hypotheses-financement-discovery.md`. Branche : `feat/hypotheses-financement`.

## Épics

| Épic | Titre                                                    | Stories    |
| ---- | -------------------------------------------------------- | ---------- |
| E1   | Moteur : revenus facultatifs, feu couverture             | US-1       |
| E2   | Web : plus de revenus nulle part                         | US-2       |
| E3   | Web : Hypothèses sans Le marché (fiche 03)               | US-3       |
| E4   | Web : onglet Financement, lien du simulateur, impression | US-4, US-5 |
| E5   | Documentation                                            | US-6       |

## Modèle de données

```
HypothesesSchema.revenusMensuels : montant, facultatif (les projets enregistrés qui le portent restent lisibles)
TauxEffort.depasseHcsf : vrai seulement si hcsf existe et dépasse le seuil
Regles.verdict.couverture : { bonJusqua: 0,70 ; surveillerJusqua: 1,00 }   (remplace verdict.effort)
AxeVerdict : 'prix' | 'rendement' | 'cashflow' | 'couverture' | 'risques'
FeuVerdict.valeur (axe couverture) : cashflow.tauxCouverture du régime retenu, null sans loyer

SimulationPretEntree (schéma local, apps/web/src/analyses/simulation-pret.ts, copie du contrat de la fiche 08)
  versionRegles?: '2026-09'
  projet: { prix, honorairesAgence?, travaux?, fraisNotaire, departement? }
  offres: [ { apport?, fraisDossier?, fraisGarantie?, fraisBancairesFinances?, tauxNominal, tauxAssurance?, dureeAnnees, differeTotalMois?, differePartielMois? } ]
Lien : /simulateur-pret#s=<base64url(JSON)>
```

## Stories

### US-1 : Le feu couverture remplace le feu effort (moteur)

En tant que Camille, je veux que le verdict dise si le loyer porte le crédit sans me demander mes revenus.

Priorité **P0** · Effort **M**

```gherkin
Scénario : revenus facultatifs
  Étant donné projetExemple sans revenusMensuels
  Quand je valide par ProjetSchema puis calcule
  Alors financement.effort.hcsf et sansLoyers valent null, depasseHcsf est faux
  Et aucun point EFFORT_HCSF_DEPASSE n'est listé

Scénario : revenus présents (projets déjà enregistrés)
  Étant donné projetExemple avec revenusMensuels 2 600
  Alors effort.hcsf ≈ 25,2 % et depasseHcsf faux ; avec 1 200 €, depasseHcsf vrai et EFFORT_HCSF_DEPASSE listé

Scénario : feu couverture
  Étant donné les seuils 0,70 et 1,00
  Alors 0,65 → bon, 0,84 → à surveiller, 1,10 → problème, null → inconnu
  Et l'axe s'appelle « couverture », en quatrième position ; valeur = tauxCouverture du régime retenu

Scénario : T3 Marseille
  Alors les feux sont bon, à surveiller, problème, à surveiller (827 ÷ 980 = 84 %), bon ; synthèse 2 · 2 · 1 · 0

Scénario : pas de loyer
  Étant donné loyerHc 0 en nu
  Alors le feu couverture est inconnu, valeur null

Scénario : contrat des résultats
  Alors ResultatsSchema accepte les résultats (axe couverture), et refuse un axe « effort »
```

### US-2 : Plus de revenus nulle part (web)

En tant que Camille, je ne veux pas indiquer mes revenus pour analyser une annonce.

Priorité **P0** · Effort **M**

```gherkin
Scénario : formulaire Vérifier
  Quand j'ouvre « je saisis à la main »
  Alors aucun champ « Vos revenus nets » ; la carte « Vous » demande mode, loyer, apport, durée, tranche
  Et le projet créé ne porte pas revenusMensuels

Scénario : textes
  Alors libelleFeu(couverture 0,84) = « Crédit 84 % du loyer », AXES.couverture = « Crédit ÷ loyer »
  Et le sous-titre du verdict dit « le crédit prend 84 % du loyer » (problème : « le crédit dépasse le loyer (110 %) ») ; jamais « effort »
  Et l'infobulle du bouton Partager ne mentionne plus les revenus
  Et la Méthode décrit la couverture et ses seuils, et dit que Deklic ne demande pas les revenus

Scénario : Comparer
  Alors la ligne « Crédit ÷ loyer » (code couverture, sens bas, feu couverture) remplace « Effort bancaire »

Scénario : synthèse de Hypothèses
  Alors le quatrième chiffre collant est « Crédit ÷ loyer 84 % », coloré selon le feu
```

### US-3 : Hypothèses sans « Le marché » (fiche 03)

Priorité **P0** · Effort **S**

```gherkin
Scénario : cartes
  Quand j'ouvre Hypothèses
  Alors les cartes sont : Le bien, L'achat, La location, Les charges, La fiscalité et la revente (pas Le marché, pas Le financement)
  Et « Plafond d'encadrement » est dans La location, sous « Loyer visé, hors charges »

Scénario : registre complet
  Alors descripteurParChemin('hypotheses.pret.apport') fonctionne encore (registre TOUS_LES_GROUPES)
  Et descripteurParChemin('marche.dvf.medianM2') lève « Aucun descripteur »
  Et preparerDvf n'existe plus
```

### US-4 : Onglet Financement

En tant que Camille, je veux régler mon prêt et lire ce qu'il coûte au même endroit.

Priorité **P0** · Effort **L**

```gherkin
Scénario : onglet
  Quand j'ouvre un projet
  Alors la bande des volets est Rapport · Estimation · Financement · Hypothèses · Fiscalité · Revente · Visite
  Et /projets/:id/financement titre « Comment se finance l'achat ? »

Scénario : hypothèses du prêt
  Alors la carte « Votre prêt » montre apport, durée, taux nominal, assurance, frais de dossier, garantie, différé total, différé partiel avec leurs badges
  Quand je passe la durée à 20
  Alors la mensualité affichée change, le projet enregistré porte dureeAnnees 20 et la provenance « utilisateur »
  Quand je tape « abc » dans le taux
  Alors « Pourcentage attendu, par exemple 3,35. » s'affiche et rien n'est enregistré

Scénario : lecture du prêt (T3 Marseille)
  Alors « Ce que ça coûte » : mensualité totale 827 €/mois en gros chiffre, emprunté 161 000 €, hors assurance 794 €, assurance 34 €, TAEG assurance comprise 4,1 %, coût total du crédit (intérêts + assurance + frais)
  Et « D'où vient l'argent » : prix, travaux, frais d'acquisition, frais bancaires, mobilier, coût total ; mise de départ (apport + mobilier) et emprunt
  Et « Le loyer porte-t-il le crédit ? » : 84 % en gros chiffre à surveiller, loyer 980 €, mensualité 827 €
  Et « Année par année » : 25 lignes (mensualités, intérêts, capital, assurance, restant dû)

Scénario : différés
  Étant donné differeTotalMois 12
  Alors l'échéancier liste les phases (différé total mois 1 à 12, puis amortissement) avec leurs mensualités

Scénario : usure et durée
  Étant donné un TAEG au-dessus du taux d'usure ou une durée au-delà de 25 ans
  Alors une pastille « au-dessus du taux d'usure » / « plus long que le maximum bancaire de 25 ans » apparaît

Scénario : projets anciens avec revenus
  Étant donné un projet enregistré avec revenusMensuels
  Alors la carte couverture ajoute la ligne « Effort bancaire (revenus indiqués à la création) »

Scénario : document
  Quand j'imprime ou ouvre un projet partagé
  Alors le volet Financement vient après le Rapport, les hypothèses du prêt en lignes lisibles, sans champ ni bouton
```

### US-5 : Bouton « Simuler un prêt »

Priorité **P1** · Effort **S**

```gherkin
Scénario : lien
  Quand je clique « Simuler un prêt » dans Financement
  Alors j'arrive sur /simulateur-pret#s=… dont le fragment décode en SimulationPretEntree :
    projet { prix 155 000, honorairesAgence 7 000, travaux 6 000, fraisNotaire = fraisAcquisition.total, departement '13' }
    offres [ { apport 14 337, fraisDossier 850, fraisGarantie 1 500, fraisBancairesFinances true, tauxNominal 0,0335, tauxAssurance 0,0025, dureeAnnees 25 } ]
  Et les différés ne sont émis que s'ils sont non nuls

Scénario : page Bientôt
  Alors /simulateur-pret affiche « Simulateur de prêt » et une phrase « Bientôt… votre prêt est déjà dans le lien »
  Et n'est pas « Page introuvable »

Scénario : encodage partagé
  Alors stockage/base64url.ts porte versBase64Url / depuisBase64Url, utilisés par partage.ts et simulation-pret.ts
```

### US-6 : Documentation

Registre, README, CLAUDE.md, architecture, fiches 01 et 03 → `livrée`, tableau du backlog.

## MoSCoW

- **Must** : US-1, US-2, US-3, US-4, US-6
- **Should** : US-5
- **Won't** : l'outil simulateur (fiche 08), saisie manuelle du repère DVF, revenus facultatifs (fiche 02)

## Tests e2e

- `aides.ts` : `creerProjetManuel` sans revenus ; `Volet` avec « Financement ».
- `rapport.spec.ts` : sous-titre et feux avec la couverture.
- `financement.spec.ts` (nouveau) : durée 20 ans → mensualité change ; « Simuler un prêt » mène à `/simulateur-pret#s=` et la page Bientôt.
- `formats.ts` : écran « Financement » ajouté aux références.
