# Discovery — hypotheses-commandes (fiche de backlog 24)

## Demande

> Je veux que les hypothèses soient aussi simples à changer que lorsque je crée un nouveau projet, avec la même interface. (Pierre, 15/09/2026)

## Résultats attendus (outcomes)

- Dans Hypothèses et Financement, chaque champ se règle avec la commande du formulaire Vérifier : montant mis en forme, compteur − / +, tuiles Oui / Non, tuiles de choix, échelle DPE / GES, périodes de construction, durées et parts d'apport en tuiles, curseur des nuits louées.
- Une seule apparence de champ (libellé, ⓘ, badge, commande, aide ou erreur) partagée par Vérifier et Hypothèses.
- Aucun changement de calcul ni de données : chaque commande produit le texte qu'`appliquerSaisie` lit déjà.

## Livrables (outputs)

- `Descripteur.commande` facultatif et sa déduction pure (`hypotheses/commandes.ts`).
- Enveloppe commune `composants/saisie/EnveloppeChamp.tsx`.
- Commandes composées sans contexte du formulaire : `composants/saisie/{SaisieAnnee,SaisieApport,SaisieDuree}.tsx`, reprises par `ChoixAnnee`, `ChoixApport`, `ChoixDuree`.
- `ChampHypothese` rendu par commande ; simulateur de prêt, `AnalyseIncomplete`, bandeau de tranche de Fiscalité et questions de visite à valeur gardés fonctionnels.

## Périmètre

- Dans : `apps/web` (hypothèses, formulaire, composants de saisie, tests Vitest et Playwright).
- Hors : moteur, worker, données, commune et adresse (absentes d'Hypothèses), repli « strict minimum » (l'onglet reste la liste complète), curseur de négociation (inchangé).

## Contraintes

- Libellés inchangés (les tests et les liens de la fiche 17 visent les champs par libellé et `data-champ`).
- Taux : saisie texte (un taux peut être négatif, ex. évolution du prix ; précision au centième).
- Mode document : valeur lisible, aucune commande.
- 44 px au doigt, clavier natif (boutons radio), mobile d'abord.

## Risques

- Tests qui remplissent un `<select>` ou lisent une valeur non formatée (« 1300 » devient « 1 300 ») : à migrer.
- Ancres de la fiche 17 : le focus doit viser la commande (tuile cochée, saisie).
- Apport « 10 % » dans Hypothèses : pas de provenance « estimé » possible, la tuile écrit le montant arrondi.

## Auto-revue critique

Le plus gros risque est la régression silencieuse d'un parcours (simulateur, bandeau « Il manque le loyer ») : la déduction par défaut s'applique à tous les appelants de `ChampHypothese`, donc les tests d'écran existants de ces parcours sont la preuve. La taille reste une session : aucune logique métier, seulement de l'aiguillage d'interface. Validé.
