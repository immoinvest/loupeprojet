# 10 — Rapport : icônes d'information, liens vers les onglets, cash-flow au centre, rendement brut

Statut : `idée` · Notée le 14/09/2026 · Dépend de : rien (la fiche 01 touche aussi le feu « effort »)

## La demande de Pierre

> Sur le Rapport, chaque élément a souvent un bouton « Pourquoi ? ». Je veux une icône ; en cliquant, une infobulle donne plus d'informations sur ce qu'il y a derrière. Pour l'estimation, un lien direct vers Estimation. Pour l'autofinancement, une infobulle avec plus d'informations. Pour « Combien d'impôts », une redirection vers Fiscalité ; pour « Combien vous restera », un lien vers Revente. Soigner cet onglet : c'est le plus important, et l'autofinancement (avec le crédit, etc.) est le plus vrai ; il faut comprendre le cash-flow. Il est aussi important de comprendre le rendement brut, pas seulement le net déjà affiché.

## Ce qui existe aujourd'hui

- Le Rapport (`apps/web/src/ecrans/Rapport.tsx`) : titre-verdict, cinq feux, puis quatre cartes — **Prix** (`rapport/CartePrix.tsx`), **« Est-ce que ça s'autofinance ? »** (loyer, crédit et assurance, charges, vacance, reste chaque mois, loyer d'équilibre), le bandeau **Leviers** (négocier, colocation, « et si… »), **« Combien d'impôts ? »**, **« Qu'est-ce qu'il vous restera ? »**.
- Le composant `Pourquoi` (`apps/web/src/composants/ui.tsx`, ligne 152) est un `<details>` : un texte-lien (« Pourquoi ? », « Comparer les 4 régimes », « Détail ») qui **déplie** un paragraphe (`textes/explications.ts`). Les libellés « Comparer les 4 régimes » et « Détail » **ne mènent nulle part** : ils déplient un texte, ce qui trompe. En mode document, le texte est imprimé.
- Le rendement **net** apparaît dans la synthèse de l'onglet Hypothèses et dans le feu « rendement » ; le rendement **brut** est calculé par le moteur (`r.rendement.rendements.brut`) mais n'est affiché que dans Comparer. Le cash-flow **avant impôt** et le **taux de couverture** (mensualité ÷ loyer) sont calculés mais absents du Rapport ; le cash-flow affiché est après impôt du régime retenu.
- L'Excel de Pierre (feuille « NEW - Rendement », lue le 14/09/2026) affiche les **trois rendements** avec leur formule en clair dans le libellé — brut = loyers ÷ (bien + travaux + notaire) ; net = (loyers − charges) ÷ idem ; net-net = (loyers − charges − intérêts − impôt) ÷ idem — puis un bloc « Retour sur investissement » : **gain total**, **multiple sur apport** (gain ÷ apport), TRI approché avec et sans prêt. Le « multiple sur apport » est un indicateur parlant à envisager dans la carte Revente ou Rendements. Sa feuille « Calcul de l'autofinancement » compte le cash-flow **avant impôt**.

## Ce que ça changerait pour l'utilisateur

- Une petite icône ⓘ à côté de chaque titre ; au clic (ou au clavier), une **infobulle** : ce que mesure le chiffre, comment il est calculé, ce qui le fait bouger. Un lien « Voir → » quand un onglet détaille la question : Prix → Estimation, Impôts → Fiscalité, Revente → Revente. L'autofinancement n'a pas d'onglet : son infobulle est plus complète.
- La carte **autofinancement** devient la carte principale (première, pleine largeur ou plus grande) : loyer → après crédit → après charges → après impôt, en cascade lisible ; à côté, **taux de couverture** (« le loyer couvre 92 % de la mensualité »), **effort d'épargne** ou excédent, **point mort**.
- Une ligne **rendements** : brut · net · net-net, chacun avec son ⓘ (définitions du glossaire), pour que « 6,8 % brut » ne soit plus une surprise entre deux sites.

## Questions ouvertes

1. **Une icône, deux comportements ?** ⓘ = infobulle partout, et le lien vers l'onglet est un second élément (« Voir l'estimation → » en bas de carte ou dans le titre) — plutôt qu'une icône qui tantôt ouvre une bulle, tantôt change d'onglet. D'accord ?
2. **Contenu des infobulles** : quelques lignes (comme les explications actuelles) ou un mini-tableau avec les chiffres du projet (ex. pour le brut : « 10 200 € de loyers ÷ 150 400 € de coût total ») ? Recommandation : phrase + chiffres du projet, générés depuis `Resultats`, jamais recopiés.
3. **Disposition** : autofinancement en premier et pleine largeur, prix et rendements sur la même ligne en dessous, puis leviers, impôts et revente ? Ou garder la grille 2 × 2 et seulement grossir l'autofinancement ? À maquetter (une variante ou deux dans `.product/design/`).
4. Le **cash-flow affiché** reste-t-il après impôt (le plus vrai) avec l'avant-impôt en ligne intermédiaire ? Proposition : oui.
5. **Impression** (`ModeDocument`) : les infobulles s'impriment en texte sous chaque titre, comme aujourd'hui — ou pas du tout ? Proposition : oui, comme aujourd'hui.

## Pistes techniques et impact

- **Web seulement** : composant `Info` (bouton ⓘ 44 px, `aria-describedby`, ouverture au clic et au focus, fermeture Échap / clic dehors, `role="tooltip"` ou popover natif `popover="auto"` ; en mode document : texte affiché) et `LienOnglet` ; `Pourquoi` remplacé partout (Rapport, CartePrix) ; `textes/explications.ts` réécrit en fonctions `(r: Resultats) => string` pour inclure les chiffres ; nouvelle carte `rapport/CarteAutofinancement.tsx` et `rapport/Rendements.tsx` ; Comparer et Méthode inchangés ; tests `apps/web/tests` du Rapport (ouverture au clavier, lien vers l'onglet), parcours e2e « Rapport ».
- **Moteur** : rien ; tout est déjà dans `Resultats` (`cashflow.avantImpot`, `financement.couverture`, `rendement.rendements.{brut, net, netNet}` — noms à vérifier dans `packages/moteur/src/schema/resultats.ts`).
- **Design** : direction C « Le guide » (ADR-004) — l'icône et l'infobulle suivent les tokens `index.css` ; contraste et taille de cible 44 px.
- **Coût** : aucun appel réseau. Une session.
