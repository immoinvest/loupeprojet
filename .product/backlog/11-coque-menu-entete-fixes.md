# 11 — Coque : menu et en-tête fixes, seul le contenu défile

Statut : `livrée` (feature `coque-fixe`, 14/09/2026, PR `feat/coque-fixe` ; discovery `../features/coque-fixe-discovery.md`, specs `../specs/coque-fixe-specs.md`, architecture `../architecture/coque-fixe.md`) · Notée le 14/09/2026 · Dépend de : rien

Décisions prises : menu de 224 px ; surimpression sous 1 024 px seulement (tiroir de `responsive`, inchangé) ; en-tête compacté (48 + 44 px, une rangée de 56 px à partir de 1 536 px) et collé, seule la bande des volets sur téléphone ; titre-verdict et H1 dans le contenu qui défile ; coque « application » (`h-dvh`, `main` qui défile) avec retour en haut au changement de chemin.

## La demande de Pierre

> Améliorer le scroll. Le menu à gauche doit respecter les bonnes pratiques UX : le logo, les projets, etc. sont fixes, ils ne bougent pas au scroll ; le scroll n'agit que sur la partie hors menu. Le menu peut être en surimpression ; il faudrait aussi le rétrécir un peu. Le compte doit être en bas, visible sans scroller. Ensuite, sur la partie projet, les onglets de l'en-tête doivent être fixes : le scroll n'impacte que le contenu et je navigue facilement.

## Ce qui existe aujourd'hui

- `AppLayout` (`apps/web/src/coque/AppLayout.tsx`) : grille `min-h-screen` à deux colonnes, **248 px** de menu + contenu. Le menu (`Sidebar.tsx`, `<aside class="h-full …">`) est aussi haut que la page entière : sur un onglet long (Hypothèses, Estimation), le profil (`Profil`) placé en bas de `aside` se retrouve **en bas de la page**, hors écran ; le logo et la liste des projets **défilent** avec le contenu.
- L'en-tête d'un projet (`EnTete` dans `ProjetLayout.tsx` : fil d'Ariane, prix · mode, onglets Rapport / Estimation / Hypothèses / Fiscalité / Revente / Visite, statut, Partager, Imprimer…) n'est **pas fixe** : il disparaît dès qu'on descend.
- Exception déjà en place : la synthèse de l'onglet Hypothèses (`Synthese`, `sticky top-0`) reste collée en haut — elle devra se placer **sous** l'en-tête fixe.
- Impression (`print:hidden`, `print:block`) et `ModeDocument` ne doivent pas changer.
- Pas de version mobile ni de menu repliable aujourd'hui ; les tests e2e (`apps/web/e2e`) cliquent sur les onglets et les liens du menu.

## Ce que ça changerait pour l'utilisateur

- Le menu ne bouge plus : logo, « Nouveau projet », projets, Comparer, aide, et **le compte toujours visible en bas**. Si la liste des projets est longue, c'est elle qui défile à l'intérieur du menu.
- Le menu est un peu plus étroit (≈ 216-224 px) ; sur écran étroit (< 1024 px), il se replie et s'ouvre en surimpression par un bouton.
- Dans un projet, l'en-tête avec les onglets reste collé en haut : on change d'onglet depuis n'importe où dans la page. La synthèse d'Hypothèses se colle juste dessous.
- Seul le contenu défile.

## Questions ouvertes

1. **Largeur** : 224 px (−10 %) ou 208 px ? À voir avec les noms de projets longs (troncature déjà en place).
2. **Surimpression** : seulement sous 1024 px (menu replié, bouton ☰), ou aussi un mode « replié » au choix sur grand écran (icônes seules, 64 px) ? Proposition : v1 = replié sous 1024 px uniquement.
3. **En-tête fixe** : garder toute la hauteur actuelle (fil d'Ariane + prix + onglets + actions ≈ 90 px) ou la **compacter** en fixe (une seule ligne : nom du projet · onglets · actions) pour ne pas manger l'écran ? Proposition : compacter à une ligne d'environ 56 px.
4. Le titre-verdict du Rapport (40 px) et les H1 des onglets restent dans le contenu qui défile — d'accord ?

## Pistes techniques et impact

- **Coque « application »** plutôt que page qui défile : `AppLayout` en `h-screen` + `overflow-hidden`, `aside` en `h-screen overflow-y-auto` (liste des projets seule à défiler, profil en `sticky bottom-0` ou hors zone défilante), `main` en `overflow-y-auto min-h-0`. Alternative plus légère : `aside` en `sticky top-0 h-screen` et en-tête en `sticky top-0` dans `main` (le document défile, mais le résultat visuel est le même). Recommandation : la première (les ancres, le `scrollTo` en haut à chaque changement d'onglet et le sticky de la synthèse sont plus prévisibles).
- **En-tête** : `EnTete` en `sticky top-0 z-20` dans `ProjetLayout` ; `Synthese` d'Hypothèses en `top-[var(--hauteur-entete)]` ; remise en haut du contenu au changement d'onglet (`useEffect` sur `location.pathname` → `main.scrollTo(0, 0)`), sinon on arrive au milieu d'un onglet.
- **Menu replié** : état local (`useState`) + `<dialog>` ou panneau `fixed inset-y-0 left-0` avec fond assombri, fermeture Échap et clic dehors, bouton ☰ 44 px dans l'en-tête ; largeur `--largeur-menu` en token dans `index.css`.
- **Impression** : `print:overflow-visible print:h-auto` partout où l'on met `overflow` ; vérifier le dossier imprimé (`/projets/:id/imprimer` est hors coque, donc peu de risque) et la page `/partage`.
- **Tests** : e2e (menu visible après un long défilement, onglets cliquables en bas de page Hypothèses, menu replié à 800 px de large), tests de composants pour le repli.
- **Coût** : aucun appel réseau. Une session ; aucune touche au moteur.
