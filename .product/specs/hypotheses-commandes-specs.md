# Specs — hypotheses-commandes (fiche 24)

Épic : l'onglet Hypothèses parle la même langue que Vérifier.

## US-1 — Chaque descripteur a une commande (Must)

```gherkin
Soit un descripteur d'hypothèse
Quand sa commande n'est pas déclarée
Alors elle est déduite : euros → montant ; nombre → montant à décimales ; entier → compteur ;
  bool → oui/non ; enum DPE/GES → échelle ; autre choix → tuiles ; pourcent → taux ; texte → texte
Et une commande déclarée (année, durée, apport, curseur) l'emporte
Et un test parcourt tous les groupes : aucun descripteur sans commande connue
```

## US-2 — Une enveloppe commune (Must)

```gherkin
Soit un champ de Vérifier ou d'Hypothèses
Alors il affiche libellé, ⓘ du terme, badge, commande, puis l'erreur ou l'aide, avec la même mise en page
Et un champ « à toi » a le fond teinté
Et une commande de groupe (tuiles, échelle) est nommée par le libellé via aria-labelledby
```

## US-3 — Montants, compteurs, oui/non, tuiles, échelles dans Hypothèses (Must)

```gherkin
Soit l'onglet Hypothèses du projet d'exemple
Quand je tape « 1300 » dans « Loyer visé, hors charges »
Alors la saisie affiche « 1 300 » et le cash-flow se recalcule
Quand je clique « Une pièce de plus »
Alors les pièces augmentent de 1 et le projet est enregistré
Quand je clique la lettre « C » du DPE
Alors le DPE vaut C (les travaux estimés se recalent comme avant)
Quand je clique « Oui » pour Ascenseur puis de nouveau « Oui »
Alors l'ascenseur vaut oui puis redevient inconnu
Et un taux (« Taux nominal ») reste une saisie texte qui accepte « 3,35 » et « −1 »
```

## US-4 — Année, durée, apport, nuits louées (Must)

```gherkin
Quand je choisis la période « 1949 à 1996 » dans Année de construction
Alors l'année enregistrée est l'année représentative de la période
Quand j'ouvre « Je connais l'année » et tape 1972
Alors l'année vaut 1972
Dans Financement, quand je clique « 20 ans »
Alors la durée vaut 20 et la mensualité change ; « Autre » ouvre un compteur de 1 à 30 ans
Quand je clique « 20 % » dans Apport
Alors l'apport vaut 20 % du coût total arrondi à la centaine ; taper un montant coche « Autre »
En courte durée, le curseur « Nuits louées par mois » (0 à 31) dit le taux d'occupation et enregistre au relâchement
```

## US-5 — Parcours partagés gardés (Must)

```gherkin
Le simulateur de prêt, le bandeau « Il manque le loyer », la tranche supposée de Fiscalité et les questions de visite à valeur fonctionnent comme avant, avec les commandes déduites
Un lien « modifier … » (fiche 17) place le focus sur la commande : tuile cochée, saisie du montant ou du compteur
En mode document, chaque commande n'écrit que sa valeur
```

## US-6 — Preuve e2e (Should)

```gherkin
Playwright : changer le DPE et les pièces dans Hypothèses → le Rapport se met à jour ; hypotheses.spec, financement.spec, liens, survol et formats verts
```

## Priorités

Must : US-1 à US-5. Should : US-6. Won't : curseurs pour les taux, « Estimer le loyer » dans Hypothèses (le composant dépend du contexte du formulaire ; le loyer de marché reste dans l'onglet Estimation et le bandeau).

## Auto-revue

Les stories couvrent le tableau de la fiche ligne à ligne ; la décision « Estimer le loyer » applique la proposition de repli de la fiche (montant seul). Validé.
