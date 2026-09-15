# Design guidelines Deklic

Règles d'interface communes à tous les écrans. Elles complètent la direction visuelle « Le guide » (ADR-004) et l'identité de marque (`marque/README.md`, ADR-005) : les couleurs et typographies viennent de là, ce document dit comment les éléments réagissent.

## Éléments cliquables : curseur et survol

Décidé le 14/09/2026. Tout ce qui se clique le montre : la main sous la souris, et un changement d'apparence discret et cohérent.

### Principes

1. **La main sur tout ce qui se clique.** Liens, boutons, onglets, puces de choix, cases à cocher et leur libellé, listes déroulantes, « Comment c'est calculé ? ». Désactivé : flèche barrée, opacité 50 %, aucun survol. Un élément qu'on glisse (le bouton-favori) montre la main ouverte (`grab`).
2. **Un effet de survol pour chaque élément cliquable**, qui dit « ceci réagit » avant le clic ([NN/g, états des boutons](https://www.nngroup.com/articles/button-states-communicate-interaction/)).
3. **Subtil et cohérent.** Un léger changement de fond ou de couleur, jamais un changement de taille, de place ou de graisse (rien ne bouge autour). Même famille d'élément, même recette : le tableau ci-dessous est la liste complète.
4. **Rapide.** Transition de 150 ms, `ease-out`, sur les couleurs seulement. Coupée quand le système demande de réduire les animations (`prefers-reduced-motion`).
5. **À la souris seulement.** Les recettes ne s'appliquent qu'aux appareils qui survolent (`@media (hover: hover)`, comportement de Tailwind v4) : au doigt, pas d'état qui reste collé après un appui.
6. **Le survol est un indice, jamais une information.** Rien n'apparaît seulement au survol : au doigt et au clavier, il n'existe pas. Les bulles ⓘ s'ouvrent au clic ou au focus, se ferment par Échap (WCAG 2.2, [1.4.13 Contenu au survol ou au focus](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html)).
7. **Survol et focus sont deux états distincts.** Le focus clavier garde son contour bleu de 2 px (`:focus-visible`) ; il se cumule avec le survol.
8. **Pas seulement la couleur.** Un lien ou un bouton texte se souligne au survol, pour les personnes qui distinguent mal le bleu foncé du bleu.
9. **Un élément déjà sélectionné ne change pas** (onglet actif, choix coché, filtre en cours) : il est déjà mis en avant, sa main suffit.

### Les recettes

Définies une fois dans `apps/web/src/index.css` (`@utility survol-*`). Elles ignorent d'elles-mêmes les éléments désactivés et les écrans tactiles.

| Classe                | Famille                                                                               | Au survol                                   | Exemples                                                                              |
| --------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------- |
| `survol-plein`        | Bouton plein bleu (action principale)                                                 | Le bleu fonce (`accent-fonce`)              | « Créer le projet », « Imprimer », `Bouton variante="primaire"`                       |
| `survol-danger-plein` | Bouton plein rouge (suppression confirmée)                                            | Le rouge fonce (`probleme-texte`)           | « Confirmer la suppression » du compte                                                |
| `survol-fond`         | Bouton à contour, puce de choix, tuile, entrée de menu, bouton icône, libellé de case | Fond `accent-fond`, bordure bleue           | `Bouton` secondaire, menu latéral, horizons de revente, états du bien, filtres, ⓘ, ☰ |
| `survol-fond-fort`    | Même famille, sur un fond déjà bleuté, ou petit bouton bordé                          | Fond `accent-doux`                          | « + » du menu, sur une ligne surlignée ou non                                         |
| `survol-danger`       | Action destructrice discrète                                                          | Fond `probleme-fond`, texte rouge           | Corbeille d'un projet, déconnexion                                                    |
| `survol-texte`        | Lien ou bouton texte, titre cliquable                                                 | Bleu foncé et souligné (2 px)               | « Voir la fiscalité → », « Ajouter une note », nom d'un projet, tri de Comparer       |
| `survol-discret`      | Texte gris cliquable                                                                  | Passe à l'encre ; un volet montre son trait | Volets inactifs du projet, « Changer d'adresse », type de location non choisi         |
| `survol-pastille`     | Pastille colorée cliquable                                                            | Halo de sa propre couleur (la teinte reste) | Statut du projet dans l'en-tête                                                       |

Sans classe, deux règles de base s'appliquent déjà partout :

- **Lien dans un texte** (`<a>`, `<Link>` sans style) : souligné, il passe au bleu foncé et son trait s'épaissit.
- **Champ de saisie et liste déroulante** : la bordure fonce (`encre-4`), sauf pendant la saisie, en erreur ou désactivé.

Exceptions assumées :

- le bouton « Annuler » du bandeau sombre de Gérer garde `hover:bg-white/25` (texte blanc sur fond sombre, aucune recette claire ne s'y lit) ;
- le **logo Deklic** (barre latérale, barre d'app, écran de connexion) garde la main mais n'a **aucun effet de survol** (décision de Pierre du 15/09/2026) : il porte `data-logo`, que `survol.spec.ts` écarte.

### Dans le code

- Un nouvel élément cliquable prend **une** recette du tableau, sur sa variante non sélectionnée. Pas de `hover:bg-…` ou `hover:text-…` inventé écran par écran : si aucune recette ne convient, en ajouter une ici et dans `index.css`.
- Préférer les composants qui la portent déjà : `Bouton`, `LienBouton`, `LienOnglet` (`composants/ui.tsx`), `classeLien` (`coque/liens.ts`), styles de `ecrans/connexion/styles.ts`.
- Un bouton icône peut ajouter sa couleur d'icône à `survol-fond` (`hover:text-accent` sur ⓘ).
- Le curseur n'a pas besoin de classe : `cursor-pointer` et `cursor-not-allowed` viennent de la couche de base d'`index.css`.
- **Test** : `apps/web/e2e/survol.spec.ts` passe sous la souris chaque élément cliquable de 15 écrans (un par apparence) et échoue en nommant ceux qui n'ont pas la main ou dont rien ne change.

### Sources

- Nielsen Norman Group, [Button States: Communicate Interaction](https://www.nngroup.com/articles/button-states-communicate-interaction/) : survol = léger assombrissement et curseur main, distinct du focus et de l'état pressé, invisible au doigt.
- W3C, [WCAG 2.2 – 1.4.13 Content on Hover or Focus](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html) : un contenu révélé au survol doit pouvoir être fermé, survolé et rester affiché.
- Tailwind CSS, [guide de migration v4](https://tailwindcss.com/docs/upgrade-guide) : les boutons reprennent le curseur par défaut du navigateur, `hover:` ne s'applique qu'aux appareils qui survolent.
- Material Design, [States](https://m2.material.io/design/interaction/states.html) : états survol, focus, pressé et désactivé cumulables, calque de survol léger et identique par famille.

## Menu latéral

Décidé le 15/09/2026 (feature `menu-lisible`, maquette `.product/design/menu-lisible-maquette.html`). Styles dans `apps/web/src/coque/liens.ts`.

1. **Une icône à chaque destination, bleue au repos** (`[&>svg]:text-accent`), libellé à l'encre. Au doigt, sans survol, c'est ce qui dit qu'une ligne se clique.
2. **Une icône par page**, jamais la même pour deux destinations (Accueil : maison ; Mes projets : dossier ; Mes biens : immeuble ; Loyers du mois : calendrier coché ; Tous les loyers : reçu ; Mes locataires : personnes ; Simulateur : calculette).
3. **Page ouverte** : fond `accent-doux`, libellé `accent-fonce`, icône bleue ; sans survol (principe 9).
4. **Ligne avec « + »** (`LigneAvecAjout`) : icône, libellé, nombre dans une pastille (`classeNombre`), « + » en petit bouton bordé de 30 px (44 px au doigt). Le nom accessible reste « Mes projets · 4 » (`aria-label`).
5. **Projets récents en retrait** (`classeSousLien`) : 13 px, gris, point de cash-flow de 8 px dans la colonne des icônes.
6. **Titres de section** (`CLASSE_ETIQUETTE`) : 11 px, capitales espacées, `encre-3` (4,8 pour 1 sur blanc), collés à ce qu'ils annoncent et éloignés de ce qui précède.
7. **Hauteur** : 38 px à la souris, 44 px au doigt (`pointer-coarse:min-h-11`).

Sources : NN/g, [Flat UI Elements Attract Less Attention](https://www.nngroup.com/articles/flat-ui-less-attention-cause-uncertainty/) ; NN/g, [Proximity Principle](https://www.nngroup.com/articles/gestalt-proximity/) ; W3C, [WCAG 2.2 – 1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) ; Material 3, [Navigation drawer](https://m3.material.io/components/navigation-drawer/guidelines).
