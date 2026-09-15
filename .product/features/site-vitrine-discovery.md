# Discovery — `site-vitrine`

Date : 15/09/2026 (session parallèle, auto-validée). Maquettes : artefact « Site vitrine Deklic » (trois directions, modèle d'article, plan de mots-clés), publié le 15/09/2026.

## Demande

Une page d'accueil publique avant l'application : expliquer Deklic (pour qui, dans quel but, ce que ça apporte), un bouton pour aller dans l'application et un pour se connecter, et un blog de guides sur l'investissement locatif en France, la recherche de biens rentables et la gestion des locataires, optimisés pour le référencement naturel.

## Décisions de Pierre (15/09/2026)

1. **Maquette A** « Coller le lien » : le champ du lien de l'annonce en tête, un rapport d'exemple à côté.
2. **Domaine `deklic.pro`** (acheté) : le site sur le domaine nu, l'application sur `app.deklic.pro` (ADR-009), les guides dans `deklic.pro/guides/`.
3. **Auteur des guides : Pierre Georgel.**
4. **Pages « Où investir » par ville : plus tard** (hors périmètre).
5. Même dépôt (`apps/site`), nouveau projet Cloudflare Pages : proposé dans les maquettes, non contesté.

## Résultats attendus (outcomes)

- Une personne qui cherche « calcul rentabilité locative », « comment trouver un bien rentable » ou « locataire qui ne paie pas son loyer » trouve un guide Deklic utile, puis analyse son annonce dans l'application.
- Une personne qui arrive sur `deklic.pro` comprend en une phrase ce que fait Deklic et colle son lien sans créer de compte.
- Une personne qui a un compte le retrouve en un clic (« Se connecter »).
- Google lit toutes les pages sans JavaScript : titres, descriptions, données structurées, plan du site.

## Livrables (outputs)

1. `apps/site` : site statique Astro, Tailwind v4, tokens de la marque Deklic, sans intégration React.
2. Page d'accueil selon la maquette A : navigation, titre, champ du lien (formulaire `GET` vers `/projets/nouveau` de l'application, lu par `annonces/partage-recu.ts`), rapport d'exemple, sources publiques, trois étapes, pour qui, contenu du rapport, Gérer, derniers guides, pied de page avec la mention « outil d'aide à la décision ».
3. Guides : collection de contenu validée par Zod (titre, description, mot-clé, catégorie, dates, sources, FAQ), page liste `/guides/`, page par catégorie, page d'article (fil d'Ariane, sommaire, L'essentiel, FAQ, auteur, dates, sources, articles liés, appel vers l'application).
4. Six guides de la vague 1 : premier investissement locatif ; calcul de la rentabilité locative ; trouver un bien rentable ; LMNP ou location nue ; locataire qui ne paie pas son loyer ; quittance de loyer.
5. Simulateur de rentabilité dans le guide « rentabilité », calculé par `@loupe/moteur` (frais d'acquisition par département, rendements brut et net).
6. SEO technique : balises title et description, canonique, Open Graph, données structurées (Organization, WebSite, SoftwareApplication, Article, FAQPage, BreadcrumbList), `sitemap.xml`, `robots.txt`, flux RSS, 404, page auteur, mentions légales.
7. Adresses : `ORIGINE_VITRINE` dans `@loupe/capture/origines` ; l'adresse de l'application vient de `DEKLIC_ORIGINE` (même règle que le web).
8. Contrôles : lint, typecheck (`astro check`), tests Vitest des fonctions pures et d'une vérification du HTML construit, build dans la CI existante.
9. Documentation : ADR-010, README (mise en service du projet Pages), CLAUDE.md, `.product/`.

## Recherche (discovery)

- **Sites de référence** (15/09/2026) : Horiz.io (trois piliers trouver / simuler / optimiser, tableau « Où investir », double appel accompagné / autonome), Monsieur Hugo (promesse chiffrée, comparatif avec l'agence, guides en cinq catégories), Rentila (« gratuit » dans le titre, trois étapes), Lybox (extension et simulateurs gratuits).
- **Mots-clés** : suggestions Google relevées le 15/09/2026 (voir l'artefact) ; aucun volume mesuré : Keyword Planner et Search Console après la mise en ligne.
- **Technique** : Astro 7.3.2 (Vite 8, compilateur Rust strict sur le HTML, Markdown natif Sätteri, Node ≥ 22.12), propriété de Cloudflare depuis janvier 2026 ; Tailwind v4 par `@tailwindcss/vite` ; collections par `glob` et `astro/zod`. Cloudflare Pages accepte plusieurs projets par dépôt avec des chemins surveillés.
- **Service-public** a changé d'adresse (`service-public.gouv.fr`) : les liens des sources se vérifient au moment d'écrire.

## Contraintes

- Principes Deklic : gratuit et sans compte, aucun traceur tiers, sources affichées, « outil d'aide à la décision, pas un conseil ».
- Aucun avis client inventé, aucun chiffre de marché présenté comme réel sans source.
- Chiffres fiscaux des guides lus dans `obtenirRegles()` au build : un guide ne contredit jamais l'application.
- Mobile d'abord (320 à 1 920 px), recettes de survol de `design-guidelines.md`, focus visible, contrastes AA.
- Aucun texte d'annonce transmis au site : le champ envoie le lien directement à l'application (fragment ou requête, jamais un serveur Deklic).
- Session parallèle : docs communes touchées en fin de feature seulement.

## Hors périmètre

Pages par ville, guides de la vague 2 (cash-flow, révision IRL, loi Jeanbrun), lettre d'information, mesure d'audience, recherche dans les guides, anglais, mise en service du projet Pages et du DNS (Pierre).

## Risques

- **Astro 7 et Vite 8** dans un monorepo dont le web est sur Vite 7 : installation imbriquée, build et typecheck à prouver dès la première story.
- **Exactitude des guides** (sujets d'argent et de droit) : sources officielles vérifiées le jour de l'écriture, date de mise à jour visible, chiffres tirés des règles du moteur.
- **Référencement lent** : plusieurs mois avant du trafic ; rien à promettre à court terme.
- **Deux sites, deux adresses** : tant que `app.deklic.pro` n'est pas branché, les liens vont vers l'adresse historique (`DEKLIC_ORIGINE` absente).
- **Tokens de marque dupliqués** entre `apps/web` et `apps/site` : une dérive possible ; parade : couleurs lues dans `marque/couleurs.json` par un test.

## Auto-revue critique

- La maquette A met l'accent sur le produit ; le SEO repose donc sur les guides. Parade : bloc « Guides » sur l'accueil et maillage catégorie ↔ articles, sans alourdir l'accueil.
- Le rapport d'exemple de la maquette mélangeait « +46 € avant impôt » et « −12 € après impôt » sans l'expliquer : l'accueil calculera l'exemple avec le moteur (`projetExemple`) plutôt que d'afficher des chiffres écrits à la main, sinon il pourrait contredire l'application.
- Six guides sérieux sont le plus gros du travail : chaque guide garde un seul mot-clé et une taille raisonnable (1 200 à 2 000 mots) plutôt que de viser la longueur.
- Le champ du lien utilise `texte` plutôt que `lien` : un partage copié depuis un téléphone contient souvent du texte autour du lien, que `partage-recu.ts` sait déjà extraire.
