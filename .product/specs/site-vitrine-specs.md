# Specs — `site-vitrine`

Date : 15/09/2026. Discovery : `.product/features/site-vitrine-discovery.md`. Maquette retenue : A « Coller le lien ».

Personas : **Camille** (31 ans, premier investissement, arrive par Google), **Karim** (investisseur qui compare, vient de l'extension ou d'un lien), **Sophie** (propriétaire bailleuse, a déjà un compte Gérer), **Google** (robot : lit le HTML sans JavaScript), **Pierre** (écrit et met à jour les guides sans relire le code).

## Épic 1 — Socle du site

**US-1 : Site statique `apps/site`**
En tant que Pierre, je veux un site `deklic.pro` construit dans le même dépôt et contrôlé par la même CI, afin que le filet de sécurité reste unique.
Priorité P0 · Effort M

```gherkin
Scenario: Build de production
  Given le dépôt installé par npm ci
  When je lance npm run build -w apps/site
  Then apps/site/dist contient index.html, 404.html, sitemap, robots.txt, rss.xml et favicon
  And aucune page ne charge de script tiers ni de police hors fonts.googleapis.com / fonts.gstatic.com

Scenario: Contrôles de la CI
  Given une erreur de type dans un fichier .ts ou .astro de apps/site
  When la CI lance npm run typecheck
  Then le job verify échoue en nommant le fichier

Scenario: Page inconnue
  Given un visiteur sur deklic.pro/nimporte-quoi
  When la page s'affiche
  Then il voit la page 404 avec des liens vers l'accueil, les guides et l'application
```

**US-2 : Liens vers l'application**
En tant que Camille, je veux coller le lien de mon annonce sur l'accueil et arriver directement sur l'analyse, sans compte.
Priorité P0 · Effort S

```gherkin
Scenario: Coller un lien
  Given l'accueil de deklic.pro, JavaScript désactivé
  When je colle "https://www.leboncoin.fr/ad/ventes_immobilieres/123" et valide
  Then le navigateur ouvre <application>/projets/nouveau?texte=<lien encodé>

Scenario: Champ vide
  Given l'accueil
  When je valide sans rien saisir
  Then le formulaire n'est pas envoyé et le champ dit qu'il attend le lien d'une annonce

Scenario: Adresse de l'application
  Given DEKLIC_ORIGINE absente au build
  When je lis les liens « Se connecter », « Analyser une annonce » et « Gérer mes locations »
  Then ils pointent vers l'adresse historique /connexion, /projets/nouveau et /gerer
  And avec DEKLIC_ORIGINE=https://app.deklic.pro ils pointent vers app.deklic.pro
```

## Épic 2 — Accueil (maquette A)

**US-3 : Page d'accueil**
En tant que Camille, je veux comprendre en quelques secondes ce que fait Deklic, pour qui, et ce que contient le rapport.
Priorité P0 · Effort L

```gherkin
Scenario: Première vue
  Given un écran de 1 280 px
  When l'accueil s'affiche
  Then je vois le titre, le champ du lien, les cinq portails lus et un rapport d'exemple marqué « Exemple »

Scenario: Rapport d'exemple calculé
  Given le projet d'exemple du moteur
  When le site est construit
  Then les cinq feux, le cash-flow et le rendement de la carte d'exemple sont ceux de calculerProjet(projetExemple)
  And aucun chiffre du rapport d'exemple n'est écrit à la main

Scenario: Téléphone
  Given un écran de 360 px
  When je fais défiler l'accueil
  Then rien ne déborde horizontalement, le champ et son bouton s'empilent, les cibles font au moins 44 px

Scenario: Aucun avis inventé
  Given l'accueil
  When je le lis en entier
  Then il ne contient ni note, ni témoignage, ni nombre d'utilisateurs
```

## Épic 3 — Guides

**US-4 : Collection des guides validée**
En tant que Pierre, je veux qu'un guide mal renseigné bloque le build, afin de ne jamais publier une page incomplète pour Google.
Priorité P0 · Effort M

```gherkin
Scenario: Guide complet
  Given un guide avec titre, description, mot-clé, catégorie, dates, auteur, sources et FAQ
  When le site est construit
  Then la page /guides/<slug>/ existe

Scenario: Description trop longue
  Given un guide dont la description dépasse 160 caractères
  When le site est construit
  Then le build échoue en nommant le guide et le champ

Scenario: Mot-clé en double
  Given deux guides qui visent le même mot-clé principal
  When les tests tournent
  Then le test de la collection échoue en nommant les deux guides
```

**US-5 : Pages des guides**
En tant que Camille, je veux lire un guide clair, sommaire et réponses d'abord, puis passer à mon annonce.
Priorité P0 · Effort L

```gherkin
Scenario: Article
  Given le guide « Calcul de la rentabilité locative »
  When je l'ouvre
  Then je vois le fil d'Ariane, le titre, l'auteur Pierre Georgel, la date de mise à jour, le temps de lecture, le sommaire, L'essentiel, la FAQ, les sources et trois guides liés
  And un seul appel « Analyser mon annonce » dans le corps

Scenario: Liste et catégories
  Given /guides/
  When je choisis la catégorie « Gérer ses locataires »
  Then /guides/gerer-ses-locataires/ liste seulement les guides de cette catégorie

Scenario: Sommaire sur téléphone
  Given un écran de 360 px
  When j'ouvre un guide
  Then le sommaire est replié au-dessus du texte et s'ouvre au clic ou au clavier
```

**US-6 : SEO technique**
En tant que Google, je veux des métadonnées, des données structurées et un plan du site valides.
Priorité P0 · Effort M

```gherkin
Scenario: Métadonnées d'un guide
  Given un guide construit
  When je lis son HTML
  Then il a un title, une meta description, une URL canonique https://deklic.pro/guides/<slug>/, les balises Open Graph et lang="fr"
  And un JSON-LD Article (auteur, datePublished, dateModified), FAQPage et BreadcrumbList qui se lisent comme du JSON

Scenario: Plan du site
  Given le build
  When je lis sitemap-index.xml et robots.txt
  Then toutes les pages publiques y sont, sauf la 404, et robots.txt indique le plan du site

Scenario: Liens internes cassés
  Given un guide qui lie /guides/page-absente/
  When la vérification du build tourne
  Then elle échoue en nommant la page et le lien
```

**US-7 : Chiffres fiscaux lus dans les règles**
En tant que Pierre, je veux que les taux et plafonds des guides viennent des règles du moteur, afin qu'un guide ne contredise jamais l'application.
Priorité P0 · Effort S

```gherkin
Scenario: Chiffre lu
  Given le guide LMNP qui affiche le plafond du micro-BIC
  When le site est construit avec les règles 2026-09
  Then la page affiche « 83 600 € », formaté comme dans l'application

Scenario: Chemin inconnu
  Given un guide qui demande une règle qui n'existe pas
  When le site est construit
  Then le build échoue en nommant le chemin

Scenario: Valeur à confirmer
  Given une règle marquée « à confirmer » (prélèvements sociaux BIC)
  When elle est citée dans un guide
  Then la mention « à confirmer » l'accompagne
```

**US-8 : Simulateur de rentabilité**
En tant que Camille, je veux calculer la rentabilité brute et nette d'un bien dans le guide, avec de vrais frais de notaire.
Priorité P1 · Effort M

```gherkin
Scenario: Calcul
  Given prix 150 000 €, département 13, travaux 0 €, loyer 650 €, charges 1 900 € par an
  When j'ai rempli les champs
  Then les frais d'acquisition, le coût total, la rentabilité brute et la nette s'affichent, calculés par le moteur

Scenario: Saisie invalide
  Given un prix vide ou négatif
  When je modifie le champ
  Then les résultats affichent « — » et le champ dit ce qui manque, sans erreur dans la console

Scenario: Sans JavaScript
  Given JavaScript désactivé
  When j'ouvre le guide
  Then la formule et l'exemple chiffré du texte restent lisibles, et le simulateur dit qu'il demande JavaScript
```

**US-9 : Guides « Investir »** — premier investissement locatif ; calcul de la rentabilité locative.
**US-10 : Guides « Choisir »** — comment trouver un bien rentable ; LMNP ou location nue.
**US-11 : Guides « Gérer »** — locataire qui ne paie pas son loyer ; quittance de loyer.
En tant que Camille ou Sophie, je veux un guide juste, sourcé et daté, qui répond d'abord à ma question.
Priorité P0 · Effort L chacune

```gherkin
Scenario: Un mot-clé, bien placé
  Given un guide de la vague 1
  When je lis son title, son H1, son URL et ses 100 premiers mots
  Then chacun contient son mot-clé principal

Scenario: Sources
  Given un guide qui cite un délai, un taux ou un texte de loi
  When je lis sa liste de sources
  Then chaque source est une page officielle (service-public.gouv.fr, impots.gouv.fr, legifrance.gouv.fr, ANIL, INSEE, data.gouv.fr) consultée le 15/09/2026

Scenario: Réponse d'abord
  Given chaque intertitre H2
  When je lis le paragraphe qui suit
  Then il répond à la question en moins de 60 mots avant de détailler
```

**US-12 : Mise en service documentée**
En tant que Pierre, je veux savoir exactement quoi cliquer chez Cloudflare pour mettre deklic.pro en ligne.
Priorité P0 · Effort S

```gherkin
Scenario: Procédure
  Given le README
  When je lis « Mettre en ligne deklic.pro »
  Then j'ai le nom du projet Pages, la commande de build, le dossier de sortie, les chemins surveillés des deux projets et les domaines à ajouter

Scenario: Décision consignée
  Given .product/adr/
  When je lis l'ADR-010
  Then il explique Astro, le même dépôt, le projet Pages séparé et les alternatives écartées

Scenario: Aperçus
  Given une branche poussée
  When Cloudflare construit le projet deklic-site
  Then les liens vers l'application pointent vers l'adresse de production (jamais vers un aperçu)
```

## Priorisation

| Story | Priorité | Effort | Dépendances      |
| ----- | -------- | ------ | ---------------- |
| US-1  | Must     | M      | —                |
| US-2  | Must     | S      | US-1             |
| US-3  | Must     | L      | US-1, US-2       |
| US-4  | Must     | M      | US-1             |
| US-5  | Must     | L      | US-4             |
| US-6  | Must     | M      | US-5             |
| US-7  | Must     | S      | US-4             |
| US-8  | Should   | M      | US-5             |
| US-9  | Must     | L      | US-5, US-7, US-8 |
| US-10 | Must     | L      | US-5, US-7       |
| US-11 | Must     | L      | US-5             |
| US-12 | Must     | S      | US-1             |

Total : 12 stories (11 Must, 1 Should), effort XL (3 à 5 jours).

## Auto-revue critique

- US-9 à US-11 regroupent deux guides chacune : un commit par guide dans l'implémentation, pour garder des commits lisibles.
- Le sommaire replié sur téléphone (US-5) doit fonctionner sans JavaScript : `<details>` natif.
- « Aucun avis inventé » (US-3) est vérifiable par un test sur le HTML construit (absence de schéma `AggregateRating`, de « avis » et d'étoiles).
- US-12 « Aperçus » : un aperçu du site qui pointerait vers un aperçu de l'application serait trompeur ; les liens restent ceux de production.
