# 12 — Menu Analyser : « Mes projets » et « + » sur une seule ligne

Statut : `livrée` pour Analyser (feature `coque-menus`, 15/09/2026, PR `feat/coque-menus` ; discovery `../features/coque-menus-discovery.md`, specs `../specs/coque-menus-specs.md`, architecture `../architecture/coque-menus.md`) · **Gérer à brancher** quand la page « Mes biens » (G1c) sera sur `master` · Notée le 14/09/2026 · Dépend de : rien

Livré : ligne « Mes projets · N [+] » en tête de la section Analyser (composant partagé `coque/LigneAvecAjout.tsx`), « · 0 » sans projet, états actifs séparés, « + » de 44 px nommé « Nouveau projet » avec son infobulle ; `mesProjets(n)` remplace `tousMesProjets(n)`. Décisions de la nuit : Accueil inchangé (Q4), compteur gardé (Q5). Section Gérer inchangée : la page liste des biens n'existait pas sur `master` le 15/09 ; il suffira de remplacer « + Ajouter un bien » de `SectionGerer.tsx` par `<LigneAvecAjout vers="<route de Mes biens>" libelle={mesBiens(n)} versAjout="/gerer/ajouter" libelleAjout={TEXTES_MENU.ajouterBien} />`.

## La demande de Pierre

> Dans Analyser, je veux un seul bouton qui combine tous mes projets et nouveaux projets. Il y aura un plus à la fin de mes projets, pas tous mes projets car c'est long, et ça permet de directement créer un nouveau projet et donc de fusionner deux boutons en un.

## Ce qui existait

- `apps/web/src/coque/SectionAnalyser.tsx` : étiquette « ANALYSER », puis « + Nouveau projet », les trois projets récents avec leur point de cash-flow, « ☰ Tous mes projets · N » (`/projets`, `end`).
- La même section sert à la barre latérale (≥ 1 024 px) et au tiroir du téléphone.
- La section « Gérer » (`SectionGerer.tsx`) a le même schéma : « + Ajouter un bien » puis « Loyers du mois ».

## Ce qui change pour l'utilisateur

```
ANALYSER
  Mes projets · 7              [+]     ← une ligne : le libellé ouvre la liste, le « + » crée un projet
  T5 · 108 m² · Toulon          ●
  T4 · 72 m² · Aix-en-Pr…       ●
  T3 · 66 m² · Marseille        ●
```

- Une ligne de moins dans le menu ; libellé plus court.
- Créer un projet reste à un clic (le « + »).

## Section Gérer : même principe (décidé, à brancher)

```
GÉRER
  Mes biens · 3                [+]     ← le libellé ouvre la liste des biens, le « + » ajoute un bien
  Loyers du mois                (2)
```

- N = nombre de biens gérés (`useGestion().donnees`) ; « Mes biens · 0 [+] » sans bien ; sans compte : inchangé.
- Tests à adapter alors : `tests/menu-sections.test.tsx` (« Ajouter un bien » devient le nom du « + »), `tests/coque-fixe.test.tsx`.

## Questions ouvertes (toutes tranchées)

1. Position : en tête (décidé le 14/09).
2. Zéro projet : « Mes projets · 0 [+] » (décidé le 14/09).
3. Section Gérer : même principe (décidé le 14/09), à brancher avec G1c.
4. Accueil : inchangé (proposition appliquée le 15/09).
5. Compteur : gardé (proposition appliquée le 15/09).
