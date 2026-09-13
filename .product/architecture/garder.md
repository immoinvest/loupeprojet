# Architecture : Garder (impression, partage, Comparer, Méthode)

Discovery : `../features/garder-discovery.md`. Socle : `web-socle.md`. État de la session : `../pipeline/garder.json`.

## Fichiers

```
apps/web/src/
├── App.tsx                          routes : /projets/:id/imprimer (hors coque), /partage, /comparer, /methode
├── index.css                        @media print : @page A4, couleurs conservées, .no-print, .document-volet (saut de page), cartes insécables
├── composants/
│   ├── document.tsx                 ModeDocument (contexte) + useModeDocument : rendu lecture seule pour le papier et le partage
│   └── ui.tsx                       Bouton (rien en mode document), Pourquoi (déplié), TitreCarte (action sous le titre), Carte (id pour les ancres)
├── coque/
│   ├── ProjetLayout.tsx             FournisseurProjet (projet + résultats), ProjetIntrouvable, EnTete : PDF → imprimer, BoutonPartager → presse-papiers
│   ├── AppLayout.tsx, Sidebar.tsx   masqués à l'impression (print:hidden)
├── ecrans/
│   ├── document/DocumentProjet.tsx  en-tête (logotype, nom, prix, mode, date, règles), quatre volets (Rapport, Fiscalité, Revente, Visite), pied
│   ├── Imprimer.tsx                 aperçu du document ; impression automatique si l'état de navigation le demande (validé par Zod)
│   ├── Partage.tsx                  bandeau « Projet partagé », « Ajouter à mes projets », document en lecture seule ; une phrase par raison de refus
│   ├── Comparer.tsx                 sélection de 2 à 5 projets, tableau projets en colonnes, tri par ligne (aria-sort), meilleure valeur
│   └── Methode.tsx                  sommaire, une carte par section, encart « à confirmer », simplifications du moteur
├── stockage/partage.ts              encoderPartage / decoderPartage (base64url, UTF-8 strict, Zod, jamais d'exception), lienPartage, lireFragment
├── analyses/
│   ├── comparaison.ts               INDICATEURS (14), comparerProjets, trierColonnes, triDecroissant, meilleureValeur, selectionInitiale
│   └── defauts.ts                   defautsDuMoteur() : défauts lus dans ProjetSchema et construireProjet
└── textes/
    ├── partage.ts                   RAISONS_PARTAGE (vide, illisible, invalide), AVERTISSEMENT_PARTAGE
    ├── feux.ts                      libelleRisques, partagé entre les pastilles de feu et Comparer
    ├── methode.ts                   sectionsMethode(regles, defauts) : assemblage des sections et drapeaux « à confirmer »
    ├── methode-commun.ts            types SectionMethode / ConstanteMethode, pct, pctSigne
    ├── methode-financement.ts       frais d'acquisition, crédit, cash-flow, rendements
    ├── methode-fiscalite.ts         micro-BIC, LMNP réel, micro-foncier, nu réel, revente et plus-value
    └── methode-verdict.ts           TRI et enrichissement, verdict, scénarios, valeurs par défaut
apps/web/tests/
├── impression.test.tsx              bouton PDF, quatre volets, mode document, page ouverte directement, id inconnu
├── partage.test.tsx                 aller-retour d'encodage (projet complet, accents), longueur du lien, liens abîmés, page, bouton Partager
├── comparaison.test.ts              extraction et format des indicateurs, tri (absents en dernier), meilleure valeur, sélection initiale
├── comparer.test.tsx                un seul projet, sélection, tri et aria-sort, limite à cinq
├── methode.test.ts                  pct, défauts lus dans le code, sections, constantes formatées, drapeaux
└── methode-page.test.tsx            rendu de la page, sommaire, sources, drapeaux, simplifications
```

## Flux

- **Impression** : bouton PDF → `naviguer('/projets/:id/imprimer', { state: { imprimer: true } })` → `Imprimer` valide l'état, rend `DocumentProjet` sous `FournisseurProjet`, appelle `window.print()` après 150 ms puis remplace l'entrée d'historique (un rechargement n'imprime pas une seconde fois).
- **Partage** : bouton Partager → `lienPartage(origin, enregistre)` → presse-papiers, ou champ à copier si le navigateur refuse ; `/partage#p=…` → `lireFragment` → `decoderPartage` → `FournisseurProjet` + `DocumentProjet` ; « Ajouter » → `creer({ nom, source: projet })` (nouvel identifiant, dates du jour, statut « En analyse ») → rapport.
- **Comparer** : `useProjets()` → sélection (état local) → `comparerProjets` (mémoïsé, `calculerProjet` sans scénarios, ≈ 5 ms par projet) → `trierColonnes` → tableau.
- **Méthode** : `obtenirRegles(VERSION_REGLES_COURANTE)` + `defautsDuMoteur()` → `sectionsMethode` → cartes.

## Décisions

- **ADR-G1 : mode document par contexte.** Les quatre écrans existants sont réutilisés sous `ModeDocument` plutôt que recopiés dans des gabarits d'impression : `Bouton` disparaît, `Pourquoi` se déplie, les grilles à quatre colonnes passent à deux, la carte Leviers devient claire, les horizons de revente sont figés. Un seul rendu à maintenir, les mêmes chiffres partout.
- **ADR-G2 : projets en colonnes.** Deux à cinq projets se lisent mieux en colonnes que quatorze indicateurs en colonnes ; « trier par colonne » devient « trier les projets selon cette ligne ». Réversible sans toucher à `analyses/comparaison.ts`.
- **ADR-G3 : partage par fragment, sans compression.** Le `ProjetEnregistre` complet tient en 1,5 à 4 Ko de base64url ; le fragment n'est jamais envoyé au serveur ; validation Zod stricte au décodage ; rien n'est écrit avant « Ajouter ». Le lien contient les revenus et l'apport : l'infobulle du bouton le dit. Les champs texte (`nom`, `source.url`) ne sont affichés que comme texte, jamais comme lien ni HTML.
- **ADR-G4 : Méthode générée, pas recopiée.** Les valeurs viennent des règles datées (`pct`, `euros`) et les défauts des schémas et de `construireProjet` ; seuls les textes (formules en français, sources) sont écrits à la main dans `textes/`. Une règle qui change change la page.
- Pas de pied de page répété à chaque page imprimée (`position: fixed` chevauche le contenu) : chaque volet commence une page et rappelle le nom du projet.

## Auto-revue

- Le mode document touche trois composants partagés (`Bouton`, `Pourquoi`, `TitreCarte`) : hors `ModeDocument`, leur rendu est identique à avant (les tests d'écran existants passent sans modification).
- Les sources de la page Méthode citent le CGI et les textes connus ; ce qui vient de la spec est cité « spec Deklic » et les valeurs sans source consolidée gardent le drapeau du moteur.
- Un lien forgé peut porter un nom très long : il n'est enregistré que si la personne clique « Ajouter », et reste validé par le schéma du moteur.
