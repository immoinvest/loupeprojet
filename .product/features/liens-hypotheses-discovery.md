# Discovery : chaque chiffre supposé mène à l'endroit où le changer (fiche 17)

Fiche de backlog : `../backlog/17-liens-vers-hypotheses.md`. Session de nuit S9 du 15/09/2026, après les fiches 13 (formulaire rapide), 14 (estimation et ventes), 16 (impôt total à la revente) et 19 (travaux selon l'état), fusionnées sur `master`.

## Le besoin

Pierre : quand une hypothèse est reprise d'un onglet à l'autre, un lien doit mener au bon onglet, au bon endroit, pour la changer ; la navigation doit rester fluide, avec un retour.

Aujourd'hui toutes les hypothèses ont une adresse stable (le chemin pointé de leur descripteur : `hypotheses.location.loyerHc`), mais aucun lien ne mène à un champ : la page Hypothèses n'a ni ancre, ni défilement, ni mise en évidence. Les liens existants (Rapport → onglets, Visite → Hypothèses, Prêt à gérer → Hypothèses) ouvrent le haut d'une page.

## Résultats attendus (pour Camille)

1. Un chiffre qui repose directement sur une hypothèse (loyer, vacance, taux du prêt, tranche, régime, horizon, évolution du prix, frais de revente, prix, travaux, apport, DPE, étage…) est un lien discret : souligné pointillé, crayon au survol.
2. Au clic : si le champ est affiché dans l'onglet courant, on y défile, il est mis en évidence et reçoit le focus ; sinon on ouvre l'onglet qui le porte (Hypothèses, ou Financement pour le prêt, Revente pour l'horizon) au bon champ.
3. Un bandeau « ← Revenir à Rapport » ramène à l'onglet d'origine, à la même position ; le bouton précédent du navigateur fait pareil.
4. Après la modification, un message dit l'effet : « Loyer visé : 980 € → 1 300 €. Cash-flow : −210 €/mois → +91 €/mois. »
5. L'adresse est partageable : `/projets/abc/hypotheses#hypotheses.location.loyerHc` ouvre le champ.
6. Dans Hypothèses, un champ dit où il sert (« Utilisé par : Rapport · Fiscalité ») avec des liens.

## Périmètre

- Mécanique : table des chemins liés par onglet et de l'onglet qui porte chaque champ (pure), défilement et mise en évidence d'un champ par le fragment, mémoire du défilement par entrée d'historique, composant `ValeurHypothese`, bandeau de retour et message d'effet, « Utilisé par ».
- Onglets : Rapport, Estimation, Financement, Fiscalité, Revente, Visite (lien du bas), Comparer, bandeau « Il manque le loyer », Prêt à gérer (lien « ajouter le loyer »).
- Hors périmètre : moteur, Worker, données ; aucun calcul nouveau ; pas de fenêtre d'édition sur place.

## Contraintes

- Mode document (impression, partage) : la valeur sans lien.
- Mobile d'abord : cibles de 44 px au doigt (`pointer-coarse:`), en-tête collé qui ne cache pas le champ ciblé.
- Survol : recette `survol-texte` (test `survol.spec.ts`).
- `prefers-reduced-motion` : mise en évidence sans animation.
- Aucun appel réseau, aucune donnée nouvelle stockée (la position de défilement vit en mémoire).

## Risques

- Trop de soulignés : style discret, crayon au survol seulement, aucun lien sur un chiffre calculé (cash-flow, TRI, rendement).
- Un champ masqué selon le type de location ou un onglet sans le champ (Revente sans loyer) : repli vers Hypothèses ; si le champ n'y est pas visible non plus, la page s'ouvre en haut.
- Textes des tests existants : le nom accessible du lien est porté par `aria-label`, le texte visible ne change pas.

## Questions ouvertes de la fiche → décisions (propositions de la fiche)

1. Sur place quand le champ existe dans l'onglet, sinon saut vers l'onglet qui le porte (pas de fenêtre d'édition).
2. Message d'effet : oui, discret, `aria-live="polite"`, seulement après un saut.
3. « Utilisé par » : oui.
4. Les deux sessions A et B de la fiche en une seule PR (consigne de la session de nuit).

## Auto-revue

- Le besoin « bon onglet, bon endroit » est couvert par la table de l'onglet porteur plus le repli vers Hypothèses ; « retour » par l'historique (pas de nouvel état persistant).
- Risque principal = régressions des tests d'écran qui lisent `textContent` : on garde le texte visible identique.
- Comparer n'appartient à aucun projet : le lien porte l'identifiant du projet de la colonne.
