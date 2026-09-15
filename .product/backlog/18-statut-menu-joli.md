# 18 — Statut du projet : un menu déroulant soigné

Statut : `livrée` (feature `coque-menus`, 15/09/2026, PR `feat/coque-menus` ; discovery `../features/coque-menus-discovery.md`, specs `../specs/coque-menus-specs.md`, architecture `../architecture/coque-menus.md`) · Notée le 14/09/2026 · Dépend de : rien

Livré : composant maison `composants/MenuChoix.tsx` (shadcn/ui n'est pas installé) et sa logique pure `composants/menu-choix.ts` ; `SelecteurStatut` s'en sert. Liste blanche arrondie, point de couleur, coche, ordre du parcours puis Scénario « pour comparer » et Écarté « on n'y va pas » (`textes/statut.ts`), clavier complet (motif WAI-ARIA listbox), clic dehors, feuille du bas sous 640 px (options de 48 px), apparition de 100 ms coupée si les animations sont réduites, chevron masqué à l'impression.

## La demande de Pierre

> Améliore l'interface de ce menu déroulant, très moche pour le moment, pour qu'il soit beaucoup plus joli.

(Capture : pastille « ● En analyse ⌄ » en haut du projet ; la liste ouverte était la liste système.)

## Ce qui existait

- `apps/web/src/coque/SelecteurStatut.tsx` (PR #74) : pastille jolie mais `<select>` natif, liste ouverte dessinée par le système.
- Six statuts (`STATUTS`, `StatutProjetSchema`) ; couleurs dans `COULEURS`.

## Ce qui change pour l'utilisateur

```
 ● En analyse  ⌄
┌──────────────────────────────────┐
│ ● En analyse                   ✓ │
│ ● Visite prévue                  │
│ ● Offre faite                    │
│ ● Acheté                         │
│ ──────────────────────────────── │
│ ● Scénario    pour comparer      │
│ ● Écarté      on n'y va pas      │
└──────────────────────────────────┘
```

## Questions ouvertes (tranchées la nuit du 15/09, propositions de la fiche)

1. Ordre : parcours puis Scénario / Écarté séparés.
2. Généraliser aux autres listes : non dans cette fiche ; `MenuChoix` est prêt pour les fiches concernées.
3. « Acheté » → proposer Gérer : déjà livré par la PR #74 (ouverture de la porte de Gérer et lien « Gérer ce bien ») ; rien ajouté.
4. Feuille du bas sur téléphone : oui, sous 640 px.
