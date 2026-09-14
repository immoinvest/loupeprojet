# Specs : Rapport, icônes d'information et cash-flow au centre

Discovery : `../features/rapport-cashflow-discovery.md`. Maquettes : `../design/rapport-cashflow-maquettes.html` (disposition **A** retenue). Périmètre : `apps/web` seulement ; le moteur ne change pas.

Chiffres de référence : le projet d'exemple (T3 · 65 m² · Marseille 5e, 155 000 €, loyer 980 €, meublé au réel, 10 ans), tels que `calculerProjet(projetExemple)` les donne le 14/09/2026.

---

## Épopée E1 : Comprendre chaque chiffre du Rapport

### US-1 : Icône d'information et lien vers l'onglet

En tant que Camille,
je veux une icône ⓘ à côté d'un titre ou d'un chiffre qui ouvre une courte explication, et un lien clair vers l'onglet qui détaille,
afin de comprendre ce qu'il y a derrière sans quitter le Rapport, et d'aller plus loin d'un clic quand je le veux.

Priorité : P0 (Must) · Effort : M

```gherkin
Scénario: ouvrir et fermer à la souris
  Étant donné une carte avec une icône ⓘ nommée « Explication : Est-ce que c'est cher ? »
  Quand je clique l'icône
  Alors une bulle (role="tooltip") s'affiche sous l'icône avec le texte de l'explication
  Et le bouton porte aria-expanded="true" et aria-controls vers la bulle
  Quand je clique l'icône à nouveau, ou n'importe où en dehors de la bulle
  Alors la bulle est masquée

Scénario: clavier
  Étant donné la même carte
  Quand je donne le focus à l'icône avec Tab
  Alors la bulle s'affiche
  Quand j'appuie sur Échap
  Alors la bulle est masquée et le focus reste sur l'icône
  Quand je passe au champ suivant avec Tab
  Alors la bulle est masquée

Scénario: une seule bulle à la fois
  Étant donné une bulle ouverte
  Quand je clique une autre icône ⓘ
  Alors la première bulle se ferme et la seconde s'ouvre

Scénario: accessibilité et taille
  Alors chaque icône est un bouton de 44 × 44 px au moins, nommé « Explication : <sujet> »
  Et le titre de la carte (h2) garde exactement son texte : l'icône est à côté du titre, pas dedans
  Et le bouton référence la bulle par aria-describedby

Scénario: la bulle reste dans l'écran
  Étant donné un format de 320 px et une icône en bord droit
  Quand j'ouvre la bulle
  Alors la bulle ne dépasse ni le bord gauche ni le bord droit de l'écran (marge de 16 px)

Scénario: lien vers un onglet
  Étant donné la carte « Combien d'impôts ? » du projet d'exemple
  Alors un lien « Voir la fiscalité » mène à /projets/<id>/fiscalite
  Quand je clique ce lien
  Alors le volet Fiscalité s'ouvre (« Combien d'impôts, selon le régime ? »)
  Et le lien est un élément distinct de l'icône : l'un ne fait jamais le travail de l'autre

Scénario: mode document
  Étant donné le document imprimable (/projets/<id>/imprimer) ou un projet partagé
  Alors aucune icône ⓘ ni bulle n'est rendue : chaque explication est un paragraphe sous son titre
  Et aucun lien « Voir … » n'est rendu (le document contient déjà tous les volets)
```

### US-2 : Explications chiffrées et dérivés du Rapport

En tant que Camille,
je veux que chaque explication cite les chiffres de mon projet,
afin de vérifier d'où sort chaque résultat.

Priorité : P0 · Effort : M

```gherkin
Scénario: cascade de l'autofinancement (analyses/rapport.ts)
  Étant donné les résultats du projet d'exemple
  Quand je calcule la cascade
  Alors loyer = 980 €, crédit = 827 €, après le crédit = 153 €
  Et charges = 307 €, vacance = 57 €, frais de courte durée = 0 €, après les charges = −210 € (= r.cashflow.mensuel, à 1 centime près)
  Et impôt mensuel moyen = 0 € (meublé au réel, 0 € sur 10 ans), après l'impôt = −210 €

Scénario: cascade en courte durée
  Étant donné un projet en courte durée
  Alors la cascade porte une ligne « ménage et conciergerie » et pas de vacance, et somme toujours à r.cashflow.mensuel

Scénario: impôt mensuel moyen d'un régime imposé
  Étant donné le projet d'exemple avec le régime micro-BIC retenu (26 928 € sur 10 ans)
  Alors impôt mensuel moyen = 224 € et après l'impôt = −435 €

Scénario: multiple sur apport
  Étant donné le projet d'exemple (gain total 13 647 €, mise de départ 19 337 €)
  Alors le multiple vaut 0,71 (× 0,7 affiché)
  Étant donné une mise de départ nulle ou négative
  Alors le multiple est null

Scénario: textes chiffrés (textes/explications.ts)
  Étant donné les résultats du projet d'exemple
  Alors explicationPrix contient « 2 385 €/m² », « 3 181 €/m² », « −25 % », « 31 ventes » et « ventes signées chez le notaire »
  Et explicationAutofinancement contient « 980 € », « 827 € », « 307 € », « 57 € » et « 210 € »
  Et explicationCouverture contient « 827 € », « 84 % » et « 980 € »
  Et explicationEffort contient « 210 € » et « 2 523 € » ; pour un cash-flow positif, elle parle d'excédent
  Et explicationPointMort contient « 1 203 € » et « 980 € » ; en courte durée, elle dit qu'il n'y a pas de loyer d'équilibre
  Et explicationRendement(r, 'brut') contient « 11 760 € », « 172 987 € » et « 6,8 % »
  Et explicationRendement(r, 'net') contient « 3 685 € », « 678 € » et « 4,3 % »
  Et explicationRendement(r, 'netNet') contient « 5 732 € », « 0 € » et « 1,0 % »
  Et explicationFiscalite contient « 0 € », « Meublé au réel » et « Nu au réel » avec « 4 235 € »
  Et explicationRevente contient « 179 884 € », « 7 695 € », « 112 094 € », « 1 878 € » et « 58 217 € »
  Et explicationMultiple contient « 13 647 € », « 19 337 € » et « 0,7 » ; sans mise de départ, elle l'explique
  Et sans ventes réelles, explicationPrix dit qu'aucun repère n'est disponible
  Et EXPLICATIONS (textes fixes) reste exporté pour la page Méthode

Scénario: couverture
  Alors textes/explications.ts et analyses/rapport.ts sont couverts à 100 % (lignes, branches, fonctions)
```

## Épopée E2 : L'autofinancement au centre

### US-3 : Carte Autofinancement et carte Rendements

En tant que Camille,
je veux voir d'abord ce que le loyer laisse après le crédit, après les charges et après l'impôt, avec les trois repères qui vont avec, puis les trois rendements,
afin de comprendre le cash-flow et de ne plus être surprise par un « 6,8 % brut » lu ailleurs.

Priorité : P0 · Effort : M

```gherkin
Scénario: la carte principale
  Étant donné le rapport du projet d'exemple
  Alors la première carte sous les feux est « Est-ce que ça s'autofinance ? », en pleine largeur
  Et elle répond « Non. »
  Et la cascade affiche, dans l'ordre : Loyer +980 € · Crédit et assurance −827 € · Après le crédit +153 € · Charges, impôts locaux, entretien −307 € · 3 semaines vides par an −57 € · Reste chaque mois −210 € · Impôt (Meublé au réel, moyenne sur 10 ans) −0 € · Après l'impôt −210 €
  Et « Reste chaque mois » est le chiffre du feu « Cash-flow »

Scénario: les trois repères
  Alors un repère « Part du loyer prise par le crédit » affiche 84 % (« 827 € de mensualité pour 980 € de loyer »)
  Et un repère « Effort d'épargne » affiche 210 €/mois (« à sortir de votre poche »)
  Et un repère « Loyer d'équilibre » affiche 1 203 € (« pour un cash-flow à zéro, 980 € visés »)
  Et chaque repère a son icône ⓘ, ainsi que le titre de la carte

Scénario: cash-flow positif
  Étant donné un projet dont le cash-flow est positif
  Alors le repère « Effort d'épargne » devient « Excédent » avec le montant par mois (« dans votre poche »)

Scénario: sans loyer ou en courte durée
  Étant donné un projet sans loyer
  Alors le repère de couverture n'est pas affiché
  Étant donné un projet en courte durée
  Alors le repère « Loyer d'équilibre » n'est pas affiché et la cascade montre « Ménage et conciergerie »

Scénario: la carte Rendements
  Alors une carte « Combien ça rapporte ? » affiche Brut 6,8 % · Net 4,3 % · Net-net 1,0 %, chacun avec un sous-titre (« loyers ÷ coût total », « charges et vacance déduites », « après intérêts, assurance et impôt ») et une icône ⓘ
  Et le net prend la couleur du feu « Rendement » (à surveiller)

Scénario: disposition
  Alors l'ordre des cartes est : Autofinancement (pleine largeur), puis Prix et Rendements côte à côte, puis Leviers, puis Impôts et Revente côte à côte
  Et sur téléphone, tout s'empile ; les trois repères passent sur deux colonnes
  Et à l'impression, la mise en page d'ordinateur est conservée (préfixes print:)
```

### US-4 : Cartes Prix, Impôts et Revente

En tant que Camille,
je veux que les autres cartes du Rapport suivent le même modèle,
afin que chaque question mène à sa réponse détaillée.

Priorité : P0 · Effort : S

```gherkin
Scénario: Prix
  Étant donné la carte « Est-ce que c'est cher ? »
  Alors le titre porte une icône ⓘ (explication chiffrée du prix) et la carte se termine par « Voir l'estimation » vers l'onglet Estimation (/adresse)

Scénario: Impôts
  Étant donné la carte « Combien d'impôts ? »
  Alors le titre porte une icône ⓘ et la carte se termine par « Voir la fiscalité » vers /fiscalite
  Et le faux lien « Comparer les 4 régimes » a disparu

Scénario: Revente
  Étant donné la carte « Qu'est-ce qu'il vous restera ? »
  Alors le titre porte une icône ⓘ et la carte se termine par « Voir la revente » vers /revente
  Et une ligne « Multiple sur apport » affiche « × 0,7 » avec son icône ⓘ ; elle est absente sans mise de départ
  Et le faux lien « Détail » a disparu

Scénario: plus de « Pourquoi ? »
  Alors le composant Pourquoi n'existe plus ; aucun texte « Pourquoi ? » sur le Rapport

Scénario: document imprimé
  Étant donné /projets/<id>/imprimer
  Alors les explications du prix, de l'autofinancement, des repères, des rendements, des impôts et de la revente sont imprimées sous leurs titres
  Et « ventes signées chez le notaire » apparaît dans l'explication du prix (test d'impression existant)
```

### US-5 : Preuve de bout en bout et documentation

Priorité : P0 · Effort : S

```gherkin
Scénario: parcours Playwright « Rapport »
  Étant donné le projet d'exemple ouvert
  Alors la cascade, les repères et les rendements affichent les chiffres attendus
  Quand je clique l'icône « Explication : Part du loyer prise par le crédit »
  Alors une bulle contenant « 827 € » est visible ; Échap la ferme
  Quand je clique « Voir la fiscalité »
  Alors le titre « Combien d'impôts, selon le régime ? » s'affiche

Scénario: formats
  Alors la spec des 16 écrans × 9 formats passe toujours sur le Rapport (aucune cible sous 44 px, aucun débordement)

Scénario: documentation
  Alors README, CLAUDE.md, features-registry, la fiche 10 et le tableau du backlog (statut « livrée ») sont à jour ; architecture dans `.product/architecture/rapport-cashflow.md`
```

---

## Hors périmètre (rappel)

Moteur, Comparer, Méthode, Hypothèses, bandeau Leviers, feux du verdict (fiche 01, autre session), infobulles hors du Rapport, `popover` natif.
