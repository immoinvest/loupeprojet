# Specs : Socle web (`apps/web`)

Discovery : `../features/web-socle-discovery.md`. Design : ADR-004. Auto-validé (autorisation du 13/09).

## Stories

| Story | Titre                                                            | Priorité | Gherkin (résumé)                                                                                                                                                                                                                                                                                                         |
| ----- | ---------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| US-0  | Scaffold Vite/React/TS aligné monorepo, Tailwind v4, polices, CI | Must     | `npm run lint/typecheck/test/build` verts à la racine avec `apps/web` ; `_redirects` SPA ; `wrangler.toml`                                                                                                                                                                                                               |
| US-1  | Thème et composants de base                                      | Must     | Tokens ADR-004 en `@theme` ; Carte, Pastille (4 feux + neutre + accent), Point, Ligne, GrosChiffre, Pourquoi (dépliable), Bouton ; cibles ≥ 44 px                                                                                                                                                                        |
| US-2  | Stockage local des projets                                       | Must     | Lecture tolérante (contenu absent/cassé/invalide → liste vide) ; écriture ; création depuis l'exemple avec id et dates ; amorçage au premier lancement ; contexte React (créer, supprimer, changer le statut, trouver)                                                                                                   |
| US-3  | Formatage FR et textes                                           | Must     | euros / signés / par mois / pourcentages / dates ; libellés des feux, régimes, modes, scénarios, critères ; phrase pour chacun des 14 codes de vigilance ; titre et sous-titre du verdict composés par règles ; explications longues écrites une fois                                                                    |
| US-4  | Coque : Sidebar, layouts, onglets                                | Must     | Barre latérale (logo, Nouveau projet, liste avec feu cash-flow, Comparer, Méthode, Extension, profil « Sans compte ») ; en-tête projet (fil d'Ariane, prix · mode, 5 onglets, statut, PDF, Partager désactivé) ; projet introuvable                                                                                      |
| US-5  | Écran Mes projets                                                | Must     | Cartes (nom, prix · mode · date, statut, 4 métriques, 5 points, supprimer) ; filtres Tous / En cours / Écartés ; état vide ; Nouveau projet ouvre le rapport ; carte compte désactivée                                                                                                                                   |
| US-6  | Écran Rapport                                                    | Must     | Verdict (titre 2 phrases, sous-titre chiffré, 5 pastilles) ; cartes Prix (jauge DVF, réponse courte, repli sans DVF), Cash-flow (lignes, point mort), Leviers (négocier, colocation, et si), Fiscalité (retenu, 3 autres), Revente (en poche, remboursé, mis, enrichissement, TRI) ; pied de page règles + avertissement |
| US-7  | Pages « bientôt », docs, PR                                      | Should   | Onglets Hypothèses/Fiscalité/Revente/Visite, Comparer, Méthode, Extension, 404 ; README ; CLAUDE.md ; `.product/`                                                                                                                                                                                                        |

## Contrats

- `AppEnMemoire({ chemin, stockage })` : même arbre de routes en mémoire pour les tests.
- Routes : `/` → `/projets` ; `/projets` ; `/projets/:id` (index Rapport, `hypotheses`, `fiscalite`, `revente`, `visite`) ; `/comparer` ; `/methode` ; `/extension` ; `*`.
- Stockage : clé `loupe.projets.v1`, `ProjetEnregistre = { id, nom, statut, creeLe, modifieLe, projet: Projet }`.

## Auto-validation critique

- **Scope tenu** : aucune édition d'hypothèses (feature suivante), pas de Playwright (feature dédiée), shadcn/ui non installé par CLI (composants maison de même facture, migration possible).
- **Risque accepté** : `calculerProjet` est appelé par carte de projet et par entrée de barre latérale (sans scénarios, ~5 ms) ; à mémoïser au niveau du contexte si la liste dépasse quelques dizaines de projets.
- **Chiffres indicatifs retirés** : contrairement à la maquette, l'écran Mes projets n'affiche que des projets réellement calculés.
