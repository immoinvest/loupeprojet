# Specs : Revente, un curseur d'horizon de 1 à 30 ans

Discovery : `../features/revente-curseur-discovery.md`. Périmètre : `apps/web` (front seul), aucun changement du moteur.

Projet d'exemple (T3 · 65 m² · Marseille 5e, règles 2026-09) : horizon 10 ans, 58 217 € en poche à 10 ans, 147 662 € à 20 ans, pas de plus-value imposable à 10 ans avec 1,5 % par an.

Taux global d'imposition de la plus-value (impôt sur le revenu 19 % et prélèvements sociaux 17,2 % après abattements pour durée de détention, hors surtaxe) : 36,2 % de 1 à 5 ans, 34,8 % à 6 ans, 12,4 % à 22 ans (plus d'impôt sur le revenu), 0 % à 30 ans (plus de prélèvements sociaux). Ces valeurs sont attendues des règles, pas recopiées dans le code.

---

## Épopée E1 : Le composant `Curseur`

### US-1 : Curseur générique et accessible

En tant que Camille,
je veux régler une valeur d'un geste, au doigt, à la souris ou au clavier,
afin de voir les chiffres suivre sans taper de nombre.

Priorité : P0 (Must) · Effort : M

```gherkin
Scénario: rendu et rôle
  Étant donné un Curseur « Revente dans » de 1 à 30, pas 1, valeur 12, formatée « 12 ans »
  Alors un élément de rôle slider nommé « Revente dans » porte aria-valuemin 1, aria-valuemax 30, valeur 12
  Et aria-valuetext vaut « Dans 12 ans »
  Et la valeur « 12 ans » est affichée à côté du libellé

Scénario: repères gradués
  Étant donné des repères 5, 10, 15, 20, 25, 30
  Alors six graduations « 5 » à « 30 » sont affichées sous la piste, placées proportionnellement

Scénario: seuils signalés
  Étant donné des seuils 22 « plus d'impôt sur le revenu » et 30 « plus de prélèvements sociaux »
  Alors une marque est dessinée sur la piste à 22 et à 30
  Et une légende dit « 22 ans : plus d'impôt sur le revenu · 30 ans : plus de prélèvements sociaux »

Scénario: glissement
  Quand la valeur du curseur passe à 15 (événement input)
  Alors onChangement reçoit 15 et onValidation n'est pas appelé
  Quand le curseur est relâché (événement change)
  Alors onValidation reçoit 15

Scénario: clavier
  Étant donné le curseur focalisé à 12
  Quand j'appuie sur Flèche droite, puis Flèche haut
  Alors onChangement reçoit 13 puis 14
  Quand j'appuie sur Flèche gauche, puis Flèche bas
  Alors onChangement reçoit 13 puis 12
  Quand j'appuie sur Fin, puis Début
  Alors onChangement reçoit 30 puis 1
  Quand j'appuie sur Page suivante depuis 1
  Alors onChangement reçoit 4 (un dixième de l'étendue, au moins un pas)
  Quand je relâche la touche
  Alors onValidation reçoit la valeur courante

Scénario: bornes et pas
  Étant donné un curseur à 30
  Quand j'appuie sur Flèche droite
  Alors onChangement n'est pas appelé
  Étant donné un curseur de −15 à 0 par pas de 0,5, valeur −5
  Quand j'appuie sur Flèche gauche
  Alors onChangement reçoit −5,5

Scénario: mode document
  Étant donné le Curseur rendu sous ModeDocument
  Alors aucun slider n'est rendu
  Et le texte « Revente dans 12 ans » est affiché

Scénario: au doigt
  Étant donné un format tactile
  Alors la zone du curseur mesure au moins 44 px de haut et sa police 16 px (mesure des formats de référence)
```

---

## Épopée E2 : Les analyses de l'horizon

### US-2 : Bornes, variante et imposition de l'année choisie

En tant que Camille,
je veux que le taux d'impôt sur ma plus-value soit celui des règles en vigueur pour l'année choisie,
afin de comprendre pourquoi vendre à 22 ans ou à 30 ans change tout.

Priorité : P0 · Effort : S

```gherkin
Scénario: bornes alignées sur le moteur
  Alors HORIZON_MIN vaut 1 et HORIZON_MAX vaut 30
  Et ReventeSchema accepte 1 et 30, refuse 0 et 31

Scénario: variante à un horizon
  Quand je demande projetAHorizon(projetExemple, 17)
  Alors le projet rendu a revente.annees = 17 et tout le reste identique
  Et projetExemple n'est pas modifié

Scénario: imposition de l'année choisie
  Étant donné les règles 2026-09
  Quand je demande impositionPlusValue(5)
  Alors l'abattement IR vaut 0 %, l'abattement PS 0 %, le taux global 36,2 %
  Quand je demande impositionPlusValue(6)
  Alors l'abattement IR vaut 6 %, l'abattement PS 1,65 %, le taux global 34,78 %
  Quand je demande impositionPlusValue(22)
  Alors l'abattement IR vaut 100 %, le taux global 12,384 %
  Quand je demande impositionPlusValue(30)
  Alors les deux abattements valent 100 % et le taux global 0 %

Scénario: seuils lus dans les règles
  Quand je demande seuilsExoneration(regles, 30)
  Alors l'exonération d'impôt sur le revenu tombe à 22 ans et celle des prélèvements sociaux à 30 ans
  Étant donné des règles sans abattement
  Alors les deux seuils sont absents (null)
```

---

## Épopée E3 : L'onglet Revente

### US-3 : Le curseur pilote l'onglet

En tant que Camille,
je veux déplacer l'horizon de revente et voir tous les chiffres suivre,
afin de choisir le moment de vendre en connaissance de cause.

Priorité : P0 · Effort : M

```gherkin
Scénario: en tête d'onglet
  Étant donné le projet d'exemple ouvert sur le volet Revente
  Alors un slider « Revente dans » vaut 10, de 1 à 30
  Et « 10 ans » est affiché à côté
  Et le taux d'imposition de la plus-value affiché sous le curseur est « 29,1 % » à 10 ans (abattements de 30 % et 8,25 %)
  Et la légende signale 22 ans et 30 ans
  Et le bandeau montre quatre cartes « Dans 5 ans », « Dans 10 ans », « Dans 15 ans », « Dans 20 ans », la seconde marquée courante

Scénario: chiffres en direct pendant le glissement
  Quand le curseur passe à 20 sans être relâché
  Alors le titre « Revente dans 20 ans », « Cash-flows cumulés sur 20 ans » et « 147 662 € » en poche s'affichent
  Et le projet enregistré porte encore 10 ans

Scénario: écriture au relâchement
  Quand le curseur est relâché à 20
  Alors le projet enregistré porte revente.annees = 20 avec la provenance « utilisateur »
  Et la carte « Dans 20 ans » est marquée courante

Scénario: écriture 150 ms après le dernier mouvement
  Quand le curseur passe à 15 sans être relâché
  Et que 150 ms s'écoulent
  Alors le projet enregistré porte 15 ans

Scénario: clavier
  Étant donné le curseur focalisé à 10
  Quand j'appuie sur Flèche droite deux fois puis relâche
  Alors le projet enregistré porte 12 ans et « Revente dans 12 ans » s'affiche

Scénario: carte du bandeau
  Quand je clique « Dans 20 ans »
  Alors le curseur vaut 20, le projet enregistré porte 20 ans et le détail est à 20 ans

Scénario: Rapport et impression
  Étant donné le projet à 20 ans
  Alors le Rapport dit « 147 662 € dans 20 ans »
  Et le document imprimable affiche « Revente dans 20 ans » en texte, sans slider, et les quatre cartes désactivées

Scénario: horizon hors des cartes
  Étant donné le projet à 12 ans
  Alors aucune carte du bandeau n'est marquée courante et le détail est à 12 ans
```

---

## Épopée E4 : Documentation

### US-4 : Docs communes

```gherkin
Scénario: livraison
  Alors README (tests, commandes), CLAUDE.md (statut du repo), features-registry.md, la fiche 06 et le tableau du backlog disent « livrée »
  Et .product/architecture/revente-curseur.md décrit les fichiers, le flux et les décisions
```

---

## Contrats

### `Curseur` (`apps/web/src/composants/Curseur.tsx`)

| Prop             | Type                                             | Rôle                                                         |
| ---------------- | ------------------------------------------------ | ------------------------------------------------------------ |
| `libelle`        | `string`                                         | Libellé visible (« Revente dans »)                           |
| `valeur`         | `number`                                         | Valeur courante (composant contrôlé)                         |
| `min`, `max`     | `number`                                         | Bornes incluses                                              |
| `pas`            | `number` (défaut 1)                              | Pas du curseur et des flèches                                |
| `formater`       | `(valeur) => string`                             | Valeur affichée et légende des seuils (« 12 ans », « −5 % ») |
| `texteValeur`    | `(valeur) => string` (défaut `formater`)         | `aria-valuetext` (« Dans 12 ans »)                           |
| `reperes`        | `readonly number[]` (défaut vide)                | Graduations sous la piste                                    |
| `formaterRepere` | `(valeur) => string` (défaut `String`)           | Libellé d'une graduation                                     |
| `seuils`         | `readonly { valeur: number; libelle: string }[]` | Marques sur la piste et légende                              |
| `onChangement`   | `(valeur) => void`                               | À chaque mouvement (pointeur ou clavier)                     |
| `onValidation`   | `(valeur) => void` (optionnel)                   | Au relâchement du pointeur ou de la touche                   |

Mode document : `<p>` « {libelle} {formater(valeur)} », rien d'autre.

### `analyses/revente.ts`

- `HORIZON_MIN = 1`, `HORIZON_MAX = 30` (alignés sur `ReventeSchema`, vérifiés par test).
- `projetAHorizon(projet, annees): ProjetEntree` : copie immuable avec `hypotheses.revente.annees`.
- `variantesRevente` inchangée, réécrite sur `projetAHorizon`.

### `analyses/plus-value.ts`

- `impositionPlusValue(annees, regles): { annees, abattementIr, abattementPs, tauxGlobal }`.
- `seuilsExoneration(regles, maxAnnees): { ir: number | null; ps: number | null }` : première année où l'abattement atteint 1.

## MoSCoW

- **Must** : US-1, US-2, US-3, US-4.
- **Won't (v1)** : graphique « en poche selon l'horizon » ; curseur dans l'onglet Hypothèses ; changement du moteur.
