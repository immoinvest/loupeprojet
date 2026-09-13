# Feature Discovery + Specs : Garder (PDF, partage, Comparer, Méthode)

## Demande

Fiche `garder` (Pierre, 13/09/2026) : terminer le tour de l'application côté web. Les pages Comparer et « Comment c'est calculé » affichent un état « bientôt » ; le bouton PDF appelle `window.print()` sur l'onglet courant ; le bouton Partager est désactivé.

## Analyse

- **Imprimer** (`/projets/:id/imprimer`) : une page hors coque (pas de barre latérale, pas d'onglets) qui empile Rapport, Fiscalité, Revente et Visite, chacun sur une nouvelle page, avec un en-tête de document (nom du projet, prix, mode, date d'impression, version des règles) et un pied de page (« outil d'aide à la décision, pas un conseil », sources). Le bouton PDF de l'en-tête projet ouvre cette route et lance l'impression ; la page reste consultable à l'écran avec ses propres boutons « Imprimer » et « Retour au projet ». Les écrans sont rendus en **mode document** : boutons masqués, explications « Pourquoi ? » dépliées, grilles ramenées à deux colonnes. Les feux gardent leur libellé : lisible en noir et blanc.
- **Partager** (`/partage#p=…`) : le `ProjetEnregistre` entier, encodé en base64url dans le fragment de l'URL. Le fragment n'est jamais envoyé au serveur ; au décodage, le JSON est validé par `ProjetEnregistreSchema` (donc par `ProjetSchema`), sinon un message « lien illisible » sans fuite. La page montre le bandeau « Projet partagé » avec un bouton « Ajouter à mes projets » (nouvel identifiant, dates du jour) et le document complet en lecture seule. Le bouton Partager de l'en-tête copie le lien ; si le presse-papiers refuse, le lien s'affiche pour être copié à la main.
- **Comparer** (`/comparer`) : choix de 2 à 5 projets par cases à cocher (les cinq premiers non écartés cochés d'office), puis un tableau **projets en colonnes, indicateurs en lignes** : prix, prix au m², écart avec les ventes du quartier, loyer, cash-flow mensuel, rendement brut et net, effort bancaire, régime et impôt sur la durée, horizon de revente, cash net à la revente, TRI, enrichissement, risques. Les lignes qui correspondent à un feu portent la pastille du feu. Cliquer une ligne trie les colonnes (meilleur d'abord, second clic inverse) ; la meilleure valeur de chaque ligne est mise en avant. Chaque colonne mène au projet. Tout vient de `calculerProjet` ; le seul dérivé est prix ÷ surface, dans `analyses/comparaison.ts`.
- **Méthode** (`/methode`) : la page « comment c'est calculé », générée depuis `obtenirRegles(VERSION_REGLES_COURANTE)` : une section par module (frais d'acquisition, crédit, cash-flow, rendements, les quatre régimes, revente et plus-value, TRI et enrichissement, verdict, scénarios, valeurs par défaut). Chaque section : la formule en quelques lignes de français, un tableau des constantes avec leur valeur (formatée depuis les règles, jamais recopiée) et leur source, les simplifications assumées. Les valeurs « à confirmer » portent un drapeau. Les valeurs par défaut sont lues dans les schémas du moteur et dans `construireProjet` plutôt que recopiées.
- **Pourquoi** : c'est l'étape « Garder » du parcours v1 de la spec (sauvegarde locale, PDF « dossier banque », lien de partage) et le principe « chaque chiffre s'explique » poussé jusqu'à la page de méthode. La comparaison était prévue en v1.5 avec le compte ; sans compte, elle marche déjà sur les projets de l'appareil.

## Stories

| Story | Titre               | Gherkin (résumé)                                                                                                                                                                                       |
| ----- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| US-1  | Impression          | `/projets/:id/imprimer` empile les quatre volets avec sauts de page, en-tête et pied ; le bouton PDF y mène et imprime ; styles `@media print` (coque masquée, couleurs conservées, cartes insécables) |
| US-2  | Partage sans compte | `encoderPartage` / `decoderPartage` (base64url, Zod) ; `/partage#p=…` en lecture seule avec bandeau et « Ajouter à mes projets » ; Partager copie le lien ; lien corrompu refusé proprement            |
| US-3  | Comparer            | 2 à 5 projets cochés, tableau côte à côte avec les feux, tri par indicateur, meilleure valeur, lien vers chaque projet ; moins de deux projets = invitation à en créer                                 |
| US-4  | Méthode             | `sectionsMethode(regles)` : une section par module, constantes formatées depuis les règles avec source, drapeau « à confirmer », simplifications, valeurs par défaut lues dans le code                 |

## Périmètre

- **IN** : ce qui précède ; `MesProjets` : le bouton Comparer devient actif ; `ProjetLayout` : boutons PDF et Partager réels ; composant `ModeDocument` (contexte) partagé par Imprimer et Partage.
- **OUT** : `NouveauProjet`, `annonces/`, `apps/worker`, `packages/moteur`, tout backend (le partage v1 est dans l'URL ; les comptes et D1 viennent en v1.5) ; compression du lien (inutile à quelques Ko) ; comparaison persistée ou partageable ; en-tête répété sur chaque page imprimée (limite CSS connue, section = page).

## Contraintes

- Aucun calcul dans les écrans : `calculerProjet` uniquement ; prix ÷ surface et le tri vivent dans `analyses/`.
- Aucune phrase générée : codes → textes dans `textes/` ; la page Méthode ne recopie aucune constante, elle formate les règles.
- Couverture 100 % sur `stockage/partage.ts`, `analyses/comparaison.ts`, `analyses/defauts.ts`, `textes/methode*.ts` ; écrans couverts par rendu via `AppEnMemoire`.
- Le lien de partage ne quitte jamais le navigateur (fragment) et n'écrit rien dans le stockage du destinataire avant qu'il clique « Ajouter ».
- Français, pas de tiret cadratin, moins de texte que de chiffres.

## Risques

| Risque                                                             | Mitigation                                                                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Impression : fonds non imprimés, texte blanc de la carte Leviers   | `print-color-adjust: exact` ; carte Leviers en fond clair et encre sombre en mode document ; feux avec libellé                 |
| Impression : grilles à quatre colonnes trop étroites en A4         | Mode document : grilles à deux colonnes, largeur du document limitée à l'écran comme au papier                                 |
| Lien de partage long (≈ 2 à 3 Ko)                                  | Testé avec un projet complet (courte durée, marché, copro) ; limite navigateur très supérieure ; pas de compression en v1      |
| Lien de partage forgé ou corrompu                                  | Décodage tolérant (jamais d'exception), validation Zod stricte, message neutre, rien n'est enregistré                          |
| Un projet partagé avec une version de règles inconnue plus tard    | `VersionReglesSchema` refuse ; le message invite à demander un nouveau lien                                                    |
| Comparaison d'horizons différents (impôt, revente, enrichissement) | Ligne « Horizon de revente » et mention « sur N ans » dans les cellules concernées                                             |
| Sources juridiques de la page Méthode                              | Références au CGI / textes connus seulement ; ce qui vient de la spec est cité « spec Loupe » ; drapeau « à confirmer » repris |

## Auto-validation critique

- **Projets en colonnes** plutôt qu'en lignes : 2 à 5 colonnes de chiffres se lisent mieux que 14 colonnes d'indicateurs ; le « tri par colonne » de la fiche devient « trier les projets selon cette ligne ». Décision assumée, réversible sans toucher à `analyses/comparaison.ts`.
- **Réutiliser les écrans** dans le document imprimable plutôt qu'écrire des gabarits dédiés : mêmes chiffres, moins de code ; le prix à payer est un contexte `ModeDocument` lu par `Bouton`, `Pourquoi` et trois grilles.
- **Pas de pied de page répété** : la technique CSS (`position: fixed`) chevauche le contenu ; chaque volet commence une page et porte son titre, le pied vient une fois à la fin.
- **Défauts « lus dans le code »** : `construireProjet` est appelé avec une saisie minimale pour lire PNO, comptable, CFE, mobilier, copro estimée ; si ces défauts changent, la page suit.

## Definition of Done

- [ ] Gates verts : lint, format, typecheck, test:coverage (100 % sur les modules de logique), build
- [ ] PDF : la route imprime les quatre volets ; vérification à l'écran dans le navigateur
- [ ] Partage : lien copié, décodé, ajouté ; lien corrompu refusé
- [ ] Comparer : tableau, tri, sélection 2 à 5, lien vers chaque projet
- [ ] Méthode : toutes les sections, constantes formatées depuis les règles, sources, drapeaux
- [ ] Docs : `architecture/garder.md`, registre, README, CLAUDE.md ; PR ouverte et armée en auto-merge
