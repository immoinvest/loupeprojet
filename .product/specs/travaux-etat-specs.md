# Specs — `travaux-etat` (fiche 19)

Auto-validées le 15/09/2026 (session de nuit). Priorité MoSCoW entre crochets.

## Épic : des travaux estimés selon l'état du bien

### US-1 [Must] Barème daté et estimation pure (moteur)

En tant que Camille, je veux un montant de travaux calculé d'après l'état, la surface et le DPE, pour ne pas oublier les travaux.

```gherkin
Scénario: bien à rafraîchir classé F
  Étant donné un bien de 65 m² « à rafraîchir » au DPE F
  Quand le moteur estime les travaux
  Alors l'estimation vaut 42 300 € (26 000 + 16 250, arrondi à la centaine)
  Et la fourchette va de 22 800 € à 78 000 €
  Et le détail compte deux lignes : état et rénovation énergétique

Scénario: bien à rénover classé G
  Étant donné 30 m² « à rénover » au DPE G
  Alors la rénovation énergétique compte pour moitié (125 €/m²) et l'estimation vaut 39 800 €

Scénario: état inconnu
  Alors il n'y a pas d'estimation (null)
```

### US-2 [Must] Choix des travaux et recalcul (moteur)

```gherkin
Scénario: projet existant
  Étant donné un projet enregistré avant la feature (sans travauxChoix) avec 6 000 € de travaux
  Quand l'état change
  Alors les travaux restent à 6 000 €

Scénario: suivre l'estimation
  Étant donné un projet dont travauxChoix vaut « estime », « bas » ou « haut »
  Quand l'état, la surface ou le DPE changent
  Alors le montant des travaux est recalculé et sa provenance vaut « estime »

Scénario: saisie
  Quand la personne saisit un montant
  Alors travauxChoix vaut « saisi » et le montant ne bouge plus
```

### US-3 [Must] Résultats, visite et Méthode

- `Resultats.travaux` = estimation (ou null), validée par `ResultatsSchema`.
- Question `TRAVAUX_ESTIMES_DEVIS` (montant, fourchette, « faire chiffrer sur devis ») à la place de `TRAVAUX_CHIFFRAGE` quand les travaux viennent de l'estimation.
- Section Méthode « Les travaux » générée depuis les règles, constantes marquées « à confirmer ».

### US-4 [Must] Projet créé avec les travaux estimés (web)

```gherkin
Scénario: création
  Étant donné une annonce « à rafraîchir » de 40 m² sans travaux indiqués
  Quand le projet est créé
  Alors les travaux valent 16 000 € avec le badge « estimé » et travauxChoix « estime »
  Et l'apport de 10 % tient compte de ces travaux

Scénario: travaux indiqués
  Étant donné des travaux saisis dans Vérifier
  Alors ils sont repris tels quels (« saisi »)
```

### US-5 [Must] Carte Achat de l'onglet Hypothèses (web)

```gherkin
Scénario: tuiles
  Étant donné un projet dont l'état est connu
  Alors la carte montre le détail du calcul, la mention « hors aides, à confirmer par devis »
  Et trois tuiles « Bas », « Estimé », « Haut » avec leur montant
  Quand je clique « Haut »
  Alors les travaux prennent le haut de la fourchette

Scénario: saisie puis retour
  Quand je saisis 5 000 €
  Alors le badge devient « à toi » et changer l'état ne change plus les travaux
  Quand je clique « Revenir à l'estimation »
  Alors les travaux reprennent la valeur estimée
```

### US-6 [Should] Vérifier, Estimation, coût total (web)

- Vérifier : quand l'état est choisi et aucun montant saisi, une ligne « Travaux estimés 16 000 € » s'affiche dans le résumé des valeurs estimées ; le champ reste modifiable.
- Onglet Estimation : sous le choix de l'état, « Travaux estimés pour cet état : 16 000 € (hors aides, à confirmer par devis) ». Choisir un état recalcule les travaux d'un projet qui suit l'estimation.
- Onglet Financement, carte du coût total : la ligne s'intitule « Travaux estimés » quand ils viennent de l'estimation.

## Hors périmètre

Mobilier estimé ; coefficients maison ou région ; onglet Estimation au-delà d'une phrase (S7) ; Fiscalité (S4).

## Auto-revue

Stories testables une à une, chiffres recalculés à la main dans les tests. US-6 dépend du formulaire livré par S3 : adapté à son code réel après fusion.
