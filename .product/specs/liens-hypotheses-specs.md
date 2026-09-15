# Specs : liens vers les hypothèses (fiche 17)

Discovery : `../features/liens-hypotheses-discovery.md`. Architecture : `../architecture/liens-hypotheses.md`.

## Épic : changer une hypothèse depuis le chiffre qu'elle produit

Priorités MoSCoW : US-1 à US-6 **Must**, US-7 **Should**, US-8 **Must** (preuve).

### US-1 — L'adresse d'une hypothèse (pur)

En tant que Camille, je veux qu'un lien d'hypothèse ouvre l'onglet qui porte le champ.

```gherkin
Scénario: onglet porteur
  Étant donné le chemin "hypotheses.pret.tauxNominal"
  Quand je calcule son lien pour le projet "abc" depuis le Rapport
  Alors l'adresse est "/projets/abc/financement#hypotheses.pret.tauxNominal"
  Et l'état porte l'origine "/projets/abc" (Rapport) et le chemin

Scénario: fragment inconnu
  Étant donné le fragment "#n-importe-quoi"
  Alors aucun champ n'est ciblé

Scénario: tout chemin lié existe
  Alors chaque chemin des tables par onglet a un descripteur
```

### US-2 — Ouvrir un champ par le fragment

```gherkin
Scénario: lien direct
  Quand j'ouvre "/projets/abc/hypotheses#hypotheses.location.loyerHc"
  Alors le champ « Loyer visé, hors charges » a le focus et est mis en évidence 2 secondes
  Et il est centré sous l'en-tête collé

Scénario: champ replié
  Quand j'ouvre "#hypotheses.achat.travaux"
  Alors le dépliant des travaux est ouvert et le champ Travaux a le focus

Scénario: champ absent de l'onglet
  Quand j'ouvre "/projets/abc/revente#hypotheses.revente.annees" sans loyer
  Alors je suis redirigé vers Hypothèses au champ « Revente dans »
```

### US-3 — Le chiffre cliquable

```gherkin
Scénario: saut
  Étant donné le Rapport
  Quand je clique « 980 € » du loyer
  Alors Hypothèses s'ouvre au champ du loyer

Scénario: sur place
  Étant donné l'onglet Financement
  Quand je clique l'apport dans « D'où vient l'argent »
  Alors la page défile jusqu'au champ Apport, sans changer d'onglet

Scénario: document
  Étant donné le document imprimé
  Alors le chiffre est du texte, sans lien
```

### US-4 — Revenir et voir l'effet

```gherkin
Scénario: retour
  Étant donné que je suis arrivé dans Hypothèses depuis le Rapport
  Alors un bandeau « Revenir à Rapport » est affiché
  Quand je le clique
  Alors le Rapport s'ouvre à la position où je l'avais quitté

Scénario: effet
  Quand je passe le loyer de 980 € à 1 300 €
  Alors un message annonce « Loyer visé, hors charges : 980 € → 1 300 € » et « Cash-flow : −210 €/mois → +91 €/mois »

Scénario: sans saut
  Quand j'ouvre Hypothèses par la bande des volets
  Alors ni bandeau ni message
```

### US-5 — « Utilisé par »

```gherkin
Scénario: chemin inverse
  Étant donné le champ « Taux nominal » de Financement
  Alors il affiche « Utilisé par : Rapport » avec un lien vers le Rapport
  Et un champ qu'aucun onglet ne reprend n'affiche rien
```

### US-6 — Rapport et Fiscalité

Rapport : loyer, vacance, charges, crédit (taux), régime et tranche de l'impôt, horizon (fiscalité, revente), prix affiché. Fiscalité : horizon (remplace « Changer l'horizon »), tranche d'imposition, régime (sur place, grille des régimes).

### US-7 — Estimation, Financement, Revente, Visite, Comparer, bandeau du loyer, Prêt à gérer

Estimation : DPE, étage, balcon, vendu loué, copropriété dans les corrections ; état sur place. Financement : prix, travaux, mobilier, apport, assurance, frais, loyer. Revente : horizon (sur place), évolution du prix, frais d'agence, prix d'achat, travaux. Visite : « vos hypothèses » ; Comparer : prix, négociation, loyer, horizon, régime ; « Il manque le loyer » : « Voir toutes les hypothèses » ; Prêt à gérer : loyer.

### US-8 — Preuve

Vitest (liens, effet, défilement, composant, écrans) et Playwright : Rapport → loyer → Hypothèses (focus) → modifier → Revenir → Rapport à jour ; Fiscalité → tranche ; lien direct ; téléphone.

## Auto-revue

- Chaque critère est testable sans réseau ; les chiffres cités (−210 → +91 €/mois) sont ceux du projet d'exemple déjà utilisés par `e2e/hypotheses.spec.ts`.
- US-7 est « Should » mais reste dans la PR (consigne : sessions A et B ensemble).
- Pas de nouvel état persistant : la position de défilement vit en mémoire, le retour passe par l'historique.
