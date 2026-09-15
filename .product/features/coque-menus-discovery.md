# Discovery : coque-menus (fiches de backlog 12 et 18)

Session de nuit S2, 15/09/2026. Branche `feat/coque-menus` depuis `master` (e6f70f60).

## La demande

1. **Fiche 12** : dans la section « Analyser » du menu, fusionner « + Nouveau projet » et « Tous mes projets · N » en une seule ligne « Mes projets · N [+] », en tête de section, avant les trois projets récents. Même principe dans « Gérer » (« Mes biens · N [+] ») quand la page « Mes biens » existe.
2. **Fiche 18** : le statut du projet (en-tête d'un projet) est un `<select>` natif dont la liste ouverte est dessinée par le système. Le remplacer par une liste aux couleurs de Deklic, dans l'ordre du parcours, accessible au clavier, en feuille du bas sur téléphone.

## Ce qui existe (vérifié dans le code)

- `coque/SectionAnalyser.tsx` : « + Nouveau projet » (`classeLienCreation`), trois projets récents, « ☰ Tous mes projets · N » (`/projets`, `end`). Textes `TEXTES_MENU.nouveauProjet`, `tousMesProjets(n)` dans `textes/gerer.ts`.
- `coque/SectionGerer.tsx` : « + Ajouter un bien », « Loyers du mois » (retards), « Tous les loyers ». **Aucune page liste des biens** sur `master` (seulement `/gerer/biens/:id`) et aucune PR G1c ouverte à 23 h.
- `coque/SelecteurStatut.tsx` (PR #74) : pastille colorée par statut (`COULEURS`), point, chevron, `survol-pastille`, mais `<select>` natif. « Acheté » ouvre déjà la porte de Gérer et un lien « Gérer ce bien » s'affiche (`ProjetLayout.tsx`) : la question 3 de la fiche 18 est donc **déjà réglée**.
- Pas de shadcn/ui ni de Radix installés dans `apps/web` → **composant maison** `composants/MenuChoix.tsx` (règle de la fiche).
- Le test Playwright de survol (`e2e/survol.spec.ts`) exige pour chaque `a[href]` et `button` visible un curseur main et un changement de style à son propre survol : chaque lien de la nouvelle ligne porte donc sa recette.

## Résultats attendus pour l'utilisateur

- Menu Analyser : une ligne de moins, « Mes projets · 7 » ouvre la liste, le « + » (nom et infobulle « Nouveau projet ») crée un projet. Sans projet : « Mes projets · 0 [+] ».
- Statut : liste blanche arrondie, point de couleur, coche sur le statut actuel, En analyse → Visite prévue → Offre faite → Acheté, séparateur, Scénario « pour comparer », Écarté « on n'y va pas ». Au clavier : flèches, Début/Fin, lettre tapée, Entrée, Échap. Sur téléphone : feuille qui monte du bas, cibles de 48 px.

## Hors périmètre

Accueil (`BlocAnalyser`, garde ses deux boutons : proposition de la fiche), autres listes déroulantes (fiche 18, question 2 : dans leurs fiches), `ProjetLayout.tsx` au-delà du branchement, formulaires, `BoutonPartager`.

## Décisions prises à la place de Pierre (questions ouvertes)

| Fiche | Question            | Décision (proposition de la fiche)                                                                                 |
| ----- | ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 12    | Q4 Accueil          | Inchangé                                                                                                           |
| 12    | Q5 Compteur « · N » | Gardé                                                                                                              |
| 12    | Gérer               | Page « Mes biens » absente au départ ; G1c fusionnée pendant la nuit (PR #80) : ligne « Mes biens · N [+] » livrée |
| 18    | Q1 Ordre            | Parcours puis Scénario / Écarté séparés                                                                            |
| 18    | Q2 Généraliser      | Non ici ; `MenuChoix` réutilisable par les fiches concernées                                                       |
| 18    | Q3 Acheté → Gérer   | Déjà livré par la PR #74 (navigation + lien « Gérer ce bien ») : rien de plus                                      |
| 18    | Q4 Feuille du bas   | Oui, sous 640 px                                                                                                   |

## Contraintes et risques

- Perdre l'accessibilité gratuite du `<select>` : motif WAI-ARIA « listbox » complet, tests clavier.
- Tests existants qui font `selectOption` sur « Statut du projet » (Vitest `app.test.tsx`, `gerer-pret.test.tsx` ; Playwright `mes-projets.spec.ts`, `coque.spec.ts`) : à migrer, hors de la liste de périmètre mais indispensables (signalé dans la PR).
- Aucun appel réseau, aucune donnée nouvelle, aucun coût.

## Auto-revue

Le périmètre est net et petit (web seul). Point faible identifié : la section Gérer ne peut pas être livrée sans inventer une page ; je m'en tiens à la règle de la fiche de session. Le composant maison reste court (un fichier logique pur pour le clavier et le placement, testé à 100 %, un fichier d'affichage).
