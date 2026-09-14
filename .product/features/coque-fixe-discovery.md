# Feature Discovery : Coque fixe (menu et en-tête fixes, seul le contenu défile)

Fiche de backlog : `../backlog/11-coque-menu-entete-fixes.md` (Pierre, 14/09/2026). Pipeline `/new-feature`, points de contrôle auto-validés (décision de Pierre du 13/09/2026).

## Demande d'origine

> Améliorer le scroll. Le menu à gauche doit respecter les bonnes pratiques UX : le logo, les projets, etc. sont fixes, ils ne bougent pas au scroll ; le scroll n'agit que sur la partie hors menu. Le menu peut être en surimpression ; il faudrait aussi le rétrécir un peu. Le compte doit être en bas, visible sans scroller. Ensuite, sur la partie projet, les onglets de l'en-tête doivent être fixes : le scroll n'impacte que le contenu et je navigue facilement.

## Constat (code du 14/09/2026, après la feature `responsive`)

| Élément                              | Aujourd'hui                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Coque (`AppLayout`)                  | Grille `min-h-dvh` à deux colonnes : menu de **248 px** + contenu. C'est **le document** qui défile : sur un volet long (Hypothèses, Estimation), tout défile ensemble.                                                                                                                                                                                                                    |
| Menu (`Sidebar`)                     | À partir de 1 024 px, `aside` aussi haut que la page : le profil (`Profil`), placé en bas, finit **hors écran** dès que le contenu dépasse la fenêtre ; le logo et la liste des projets **défilent** avec le contenu. Sous 1 024 px, la barre est déjà un **tiroir** (`useMenu`, bouton « Ouvrir le menu » de 44 px, Échap, voile, focus rendu) : ce point de la fiche est **déjà livré**. |
| En-tête d'un projet (`ProjetLayout`) | Fil d'Ariane, prix · mode, statut, PDF, Partager, bande des six volets : **≈ 116 px** sur ordinateur (une rangée à partir de 1 536 px), pas fixe. Pour changer de volet depuis le bas d'Hypothèses, il faut remonter.                                                                                                                                                                      |
| Synthèse d'Hypothèses                | Déjà collante (`sticky top-[var(--hauteur-barre-app)]`) : elle devra se placer **sous** l'en-tête fixe.                                                                                                                                                                                                                                                                                    |
| Changement de volet                  | Le document garde sa position : on arrive **au milieu** du volet suivant.                                                                                                                                                                                                                                                                                                                  |
| Impression, partage                  | `/projets/:id/imprimer` est hors coque ; `/partage` et le document (`ModeDocument`) sont dans la coque mais sans en-tête de projet. Les règles `print:` masquent déjà barre d'app, menu et en-tête.                                                                                                                                                                                        |
| Preuve                               | 8 parcours Playwright sur trois appareils, spec `responsive` (16 écrans × 9 formats : débordement mesuré **sur le document**), 961 tests Vitest.                                                                                                                                                                                                                                           |

## Analyse

- **Quoi** : une coque « application » : la fenêtre ne défile plus, seul le contenu défile ; le menu tient dans la hauteur de l'écran (logo et « Nouveau projet » en haut, liste des projets qui défile seule si elle est longue, aide et compte en bas) ; dans un projet, l'en-tête reste collé en haut du contenu, compacté ; la synthèse d'Hypothèses se colle dessous ; changer de page remet le contenu en haut.
- **Pourquoi** : sur les volets longs, Pierre perd le menu et les onglets et remonte sans cesse ; le compte est invisible. Ce sont les repères permanents d'une application (Linear, Notion, Gmail) : ils ne bougent pas.
- **Pour qui** : Pierre et Camille sur ordinateur d'abord (le menu est visible en permanence) ; sur téléphone et tablette, l'en-tête collé (onglets) apporte le même confort.
- **Où** : `apps/web` seulement : `coque/` (`AppLayout`, `Sidebar`, `BarreApp`, `ProjetLayout`), `ecrans/Hypotheses.tsx` (synthèse), `index.css` (tokens), tests Vitest et Playwright (`e2e/formats.ts` : mesure du débordement dans le conteneur qui défile), docs. Rien dans le moteur, le Worker, l'extension, les comptes.

## Décisions (questions ouvertes de la fiche)

1. **Largeur du menu : 224 px** (−10 %). Les libellés les plus longs (« Comment c'est calculé », « Extension navigateur ») gardent leur taille ; les marges intérieures se resserrent ; les noms de projets sont déjà tronqués. Vérification à l'écran avant de commettre.
2. **Surimpression : sous 1 024 px seulement**, déjà livrée par `responsive` (tiroir). Pas de mode « icônes seules » sur grand écran en v1.
3. **En-tête compacté et collé** : une rangée « Mes projets / Nom · prix · mode » avec les actions à partir de 768 px (48 px), la bande des volets dessous (44 px) ; à partir de 1 536 px, tout sur une rangée de 56 px. Sur téléphone, seule **la bande des volets** reste collée (le nom, le prix et les actions défilent avec le contenu) : l'écran est trop petit pour figer 150 px.
4. **Le titre-verdict du Rapport et les H1 restent dans le contenu** qui défile.
5. **Coque « application »** (`h-dvh` + `overflow-hidden`, `main` qui défile) plutôt que `sticky` sur le document : le retour en haut au changement de page, la synthèse collée et l'en-tête collé sont prévisibles dans un seul conteneur de défilement.

## Outcomes

1. Sur ordinateur, quelle que soit la position dans un volet long, le menu (logo, projets, aide, compte) et l'en-tête du projet (onglets, statut, actions) restent visibles ; seul le contenu bouge.
2. Sur téléphone et tablette, les onglets restent accessibles en défilant ; le tiroir existant n'est pas modifié.
3. Changer de page ou de volet montre le haut de la page.
4. L'impression et le partage sont inchangés ; la spec des formats mesure le débordement dans le nouveau conteneur, sans perdre sa sensibilité.

## Outputs

1. **Coque application** : `AppLayout` en `h-dvh overflow-hidden`, `main` en `overflow-y-auto`, retour en haut à chaque changement de chemin ; menu de 224 px.
2. **Menu en trois zones** : haut fixe (logo, « Nouveau projet »), milieu qui défile (« Mes projets », Comparer), bas fixe (aide, « Installer l'application », profil).
3. **En-tête de projet compacté et collé** (`sticky`), avec sa hauteur collée publiée dans `--hauteur-entete-projet` pour la synthèse d'Hypothèses ; sur téléphone, un décalage négatif mesuré ne laisse en vue que la bande des volets.
4. **Preuve** : tests de composants (coque, menu, en-tête, retour en haut), tests des fonctions de mesure, parcours Playwright `coque.spec.ts` sur les trois appareils (menu et onglets en vue après un long défilement, retour en haut, liste de 30 projets), `formats.ts` mesurant `main`.

## Périmètre

### IN

Tout ce qui précède.

### OUT

- Menu replié « icônes seules » sur grand écran ; réorganisation du menu en sections Analyser / Gérer (épic gestion locative).
- Restauration de la position de défilement au retour arrière (le navigateur ne la restaure pas dans un conteneur interne ; hors besoin exprimé).
- Modification des volets eux-mêmes, du moteur, du Worker.

## Contraintes

- Impression intacte : `print:` sur chaque changement (`print:h-auto print:overflow-visible print:static`), pages `/projets/:id/imprimer` et `/partage` vérifiées.
- Accessibilité : bouton ☰ de 44 px, Échap ferme le tiroir (déjà en place, conservé) ; focus visible dans la zone qui défile ; `main` garde son `tabIndex={-1}` et reçoit le focus après une navigation depuis le tiroir.
- Aucune largeur lue en JavaScript pour la mise en page : les points de rupture restent en CSS. La seule mesure (hauteur de l'en-tête, début de la bande) alimente des variables CSS.
- Conflits attendus avec les sessions parallèles : `Sidebar.tsx` (rubrique « Outils » du simulateur de prêt) et `ProjetLayout.tsx` (onglet Financement) : garder les deux côtés.

## Risques

| Risque                                                                                 | Parade                                                                                                                        |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| La spec des formats devient aveugle au débordement (le conteneur `main` coupe l'excès) | `mesurer` prend `main` pour la page : `scrollWidth − clientWidth` de `main`, et `main` n'est pas un défilement « qui excuse » |
| Le focus (contour à 2 px) est coupé par la zone qui défile du menu                     | Marge intérieure de 4 px dans la zone qui défile (`-mx-1 px-1`)                                                               |
| L'en-tête collé mange l'écran sur téléphone                                            | Seule la bande des volets reste en vue (décalage négatif mesuré, `md:top-0` au-delà)                                          |
| `ResizeObserver` absent (jsdom, vieux navigateurs)                                     | Sans observateur, aucune variable n'est publiée : la synthèse se colle en haut du contenu (`var(…, 0px)`)                     |
| Le libellé « Comment c'est calculé » ne tient plus dans 224 px                         | Mesure à l'écran ; sinon taille 14 px ou troncature                                                                           |
