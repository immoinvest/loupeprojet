# Specs : Coque fixe

Discovery : `../features/coque-fixe-discovery.md`. Périmètre : `apps/web` (coque, synthèse d'Hypothèses, `index.css`), tests Vitest et Playwright, docs. Formats de référence : ceux de la feature `responsive` (320 à 1 920 px ; `md` = 768 px, `lg` = 1 024 px, `2xl` = 1 536 px).

Vocabulaire : **la coque** = barre d'app (sous 1 024 px), menu, contenu ; **le contenu** = l'élément `main`, seul à défiler ; **l'en-tête du projet** = fil d'Ariane, prix · mode, actions, bande des volets.

---

## Épopée E1 : Coque application

### US-1 : Seul le contenu défile

En tant que Pierre,
je veux que le menu reste à sa place quand je descends dans un volet long,
afin de garder mes repères et d'atteindre mes projets et mon compte sans remonter.

Priorité : P0 (Must) · Effort : M

```gherkin
Scénario: la fenêtre ne défile pas, le contenu oui
  Étant donné le volet Hypothèses du projet d'exemple sur un format de 1 280 px
  Quand je défile jusqu'en bas du contenu
  Alors la position de défilement de la fenêtre reste à 0
  Et le logo, « Nouveau projet », la liste « Mes projets », « Comment c'est calculé » et le profil sont toujours dans la fenêtre

Scénario: le menu mesure 224 px
  Étant donné un format de 1 280 px
  Alors la colonne du menu mesure 224 px et « Comment c'est calculé » tient sur une ligne

Scénario: le compte est en bas du menu, visible sans défiler
  Étant donné 30 projets enregistrés sur un format de 1 280 px
  Alors « Gratuit · 30 projets » est dans la fenêtre
  Et la liste des projets défile à l'intérieur du menu : le trentième projet devient visible en défilant la liste, le profil ne bouge pas

Scénario: changer de page remet le contenu en haut
  Étant donné le volet Hypothèses défilé jusqu'en bas
  Quand je clique le volet « Fiscalité »
  Alors le titre « Combien d'impôts, selon le régime ? » est visible et le contenu est en haut (défilement à 0)

Scénario: tiroir inchangé sous 1 024 px
  Étant donné un format de 375 px
  Quand je touche « Ouvrir le menu »
  Alors le tiroir s'ouvre par-dessus le contenu, le focus entre dedans, Échap le ferme et rend le focus au bouton
  Et le tiroir montre le profil en bas sans défiler ; sa liste de projets défile seule si elle est longue

Scénario: impression et partage inchangés
  Étant donné la page /projets/:id/imprimer
  Alors le document est imprimé sur plusieurs pages A4 comme avant (rien n'est coupé par un conteneur de hauteur fixe)
  Étant donné la page /partage#p=…
  Alors le document partagé se lit en défilant le contenu
```

Règles :

- `AppLayout` : `h-dvh overflow-hidden` ; `main` : `min-h-0 flex-1 overflow-y-auto` ; à l'impression : `print:h-auto print:overflow-visible`.
- `Sidebar` : trois zones ; seule la zone du milieu (« Mes projets » et Comparer) porte `overflow-y-auto` ; le tiroir sous 1 024 px garde son DOM, ses gestes et ses tests.
- Retour en haut : à chaque changement de `pathname` (pas au changement de fragment ou de paramètres), `main.scrollTop = 0` avant la peinture.

### US-2 : En-tête du projet collé et compact

En tant que Pierre,
je veux changer de volet depuis n'importe quel point du contenu,
afin de naviguer dans le rapport sans remonter.

Priorité : P0 · Effort : M

```gherkin
Scénario: ordinateur, l'en-tête reste en haut du contenu
  Étant donné le volet Hypothèses du projet d'exemple sur un format de 1 280 px
  Quand je défile jusqu'en bas du contenu
  Alors la bande des volets, « Mes projets / T3 · 65 m² · Marseille 5e », le prix et le mode, le statut, « PDF » et « Partager » sont dans la fenêtre
  Et l'en-tête occupe au plus 96 px de haut (une rangée nom · prix · mode et actions de 48 px, une rangée de volets de 44 px), plus son trait

Scénario: grand écran, une seule rangée
  Étant donné un format de 1 920 px
  Alors nom, volets et actions tiennent sur une rangée de 56 px

Scénario: téléphone, seuls les volets restent collés
  Étant donné le volet Hypothèses sur un format de 375 px (Pixel 7)
  Quand je défile jusqu'en bas du contenu
  Alors la bande des volets est dans la fenêtre, juste sous la barre d'app
  Et le lien « Mes projets » de l'en-tête n'est plus dans la fenêtre

Scénario: tablette portrait, tout l'en-tête reste collé
  Étant donné un format de 768 px
  Quand je défile jusqu'en bas du contenu
  Alors le nom, les actions et les volets sont dans la fenêtre

Scénario: la synthèse d'Hypothèses se colle sous l'en-tête
  Étant donné le volet Hypothèses défilé jusqu'en bas, sur tout format
  Alors « Cash-flow » et ses chiffres sont dans la fenêtre, sous la bande des volets, sans la recouvrir

Scénario: onglet actif ramené en vue, impression
  Étant donné le volet Visite ouvert directement sur un format de 320 px
  Alors l'onglet « Visite » est visible dans la bande (comportement de `responsive` conservé)
  Étant donné l'impression d'un projet
  Alors l'en-tête n'est pas imprimé
```

Règles :

- L'en-tête est `sticky top-0 z-20` dans le contenu ; sous 768 px, `top` vaut `−(début de la bande des volets)` : la bande seule reste en vue.
- La hauteur de la partie collée est publiée dans `--hauteur-entete-projet` (variable CSS sur le cadre du projet) ; la synthèse d'Hypothèses se colle à `top: var(--hauteur-entete-projet, 0px)`.
- Les mesures viennent d'un `ResizeObserver` sur l'en-tête (hauteur, `offsetTop` de la bande, `top` calculé) ; sans observateur, aucune variable n'est publiée.
- Le titre-verdict et les H1 restent dans le contenu.

### US-3 : Preuve

En tant que Pierre (qui ne relit pas le code),
je veux que les tests couvrent le repli, le défilement et l'en-tête collé,
afin qu'une régression soit vue en CI.

Priorité : P0 · Effort : S

```gherkin
Scénario: tests de composants (Vitest, jsdom)
  Alors la racine de la coque porte h-dvh et overflow-hidden, le contenu overflow-y-auto
  Et changer de volet remet main.scrollTop à 0
  Et la liste « Mes projets » est dans la zone qui défile du menu, le profil en dehors
  Et l'en-tête publie --decalage-entete et --hauteur-entete-projet quand ResizeObserver mesure
  Et les fonctions de mesure (lecture du top calculé, hauteur collée) couvrent : valeur vide, « auto », négative, hauteur nulle

Scénario: parcours Playwright (ordinateur, téléphone, tablette)
  Alors un fichier e2e/coque.spec.ts prouve US-1 et US-2 : menu et en-tête en vue après un long défilement, retour en haut, 30 projets et profil visible
  Et e2e/formats.ts mesure le débordement dans main (scrollWidth − clientWidth) et n'excuse plus un élément parce qu'il est dans main

Scénario: existants
  Alors les 8 parcours, la spec des formats (16 écrans × 9 formats), les tests du tiroir (menu.test.tsx) restent verts sans modification de leurs attentes
```

### US-4 : Documentation

Priorité : P1 · Effort : XS. README (structure), CLAUDE.md (statut du repo), `features-registry.md`, `functional-spec.md` ou `technical-spec.md` si la coque y est décrite, `architecture-overview.md`, fiche 11 et tableau du backlog → `livrée`.

---

## Modèle de données

Aucun changement de schéma. Deux variables CSS publiées par l'en-tête sur le cadre du projet :

| Variable                  | Valeur                                                            | Lue par                                  |
| ------------------------- | ----------------------------------------------------------------- | ---------------------------------------- |
| `--decalage-entete`       | `offsetTop` de la bande des volets dans l'en-tête, en px          | `top` de l'en-tête sous 768 px (négatif) |
| `--hauteur-entete-projet` | hauteur de l'en-tête + `top` calculé (≤ 0), en px : partie en vue | `top` de la synthèse d'Hypothèses        |

Token de largeur du menu : `--largeur-menu: 14rem` (224 px) dans `index.css`, utilisé par la grille de `AppLayout`.

## Priorisation MoSCoW

- Must : US-1, US-2, US-3.
- Should : US-4.
- Won't (v1) : menu « icônes seules », restauration du défilement au retour arrière, sections Analyser / Gérer.
