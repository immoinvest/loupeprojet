# Architecture — `site-vitrine`

Date : 15/09/2026. Specs : `.product/specs/site-vitrine-specs.md`. ADR : `.product/adr/010-site-vitrine.md`.

## Vue d'ensemble

```
deklic.pro (projet Pages « deklic-site », apps/site/dist, HTML statique)
  ├─ /                      accueil (maquette A)
  ├─ /guides/               liste des guides
  ├─ /guides/<catégorie>/   guides d'une catégorie
  ├─ /guides/<guide>/       article (MDX)
  ├─ /auteur/pierre-georgel/, /mentions-legales/, /confidentialite/, /404.html
  └─ /sitemap-index.xml, /robots.txt, /rss.xml, /_headers
          │  liens et formulaire GET (?texte=…)
          ▼
<DEKLIC_ORIGINE> (app.deklic.pro, sinon loupeprojet.pages.dev) : /projets/nouveau, /connexion, /gerer, /extension
```

Tout se calcule au build : rapport d'exemple (`calculerProjet(projetExemple)`), chiffres des règles (`obtenirRegles`), temps de lecture, guides liés, données structurées. Le seul JavaScript envoyé au navigateur est celui du simulateur de rentabilité (moteur inclus) et l'ouverture du menu sur téléphone ; tout le reste marche sans.

## Paquets

| Paquet                                         | Version | Rôle                                                    |
| ---------------------------------------------- | ------- | ------------------------------------------------------- |
| `astro`                                        | ^7.3.2  | Génération statique (Vite 8, Node ≥ 22.12)              |
| `@astrojs/mdx`                                 | ^8.0.1  | Guides en MDX : composants `<Regle>` et `<Simulateur>`  |
| `@astrojs/sitemap`                             | ^3.7.4  | `sitemap-index.xml`                                     |
| `@astrojs/rss`                                 | ^4.0.19 | `rss.xml`                                               |
| `@astrojs/check`                               | ^0.9.10 | `astro check` = typecheck des `.astro`                  |
| `tailwindcss`, `@tailwindcss/vite`             | ^4.1.0  | Styles, tokens Deklic (même version majeure que le web) |
| `@fontsource-variable/outfit`, `…/nunito-sans` | ^5.3.0  | Polices servies par le site : aucune requête à Google   |
| `@loupe/moteur`, `@loupe/capture`              | `*`     | Calculs, règles, projet d'exemple ; adresses du site    |

Pas d'intégration React : le simulateur est un script TypeScript qui importe le moteur (évite de mêler React 19 du web et Vite 8).

## Fichiers à créer

```
apps/site/
├── package.json                  @loupe/site : dev, build, preview, typecheck (astro check), test
├── astro.config.ts               site = ORIGINE_VITRINE, trailingSlash 'always', mdx, sitemap (sans 404), intégration verification, tailwind
├── tsconfig.json                 étend tsconfig.base.json, lib DOM, include .astro/types.d.ts, src, tests, configs
├── vitest.config.ts              name 'site', node, tests/**/*.test.ts
├── public/                       favicon.svg, apple-touch-icon.png, og-image.png (copies de marque/)
├── contenu/guides/*.mdx          six guides de la vague 1
├── src/
│   ├── content.config.ts         collection « guides » : glob contenu/guides/*.mdx, SchemaGuide
│   ├── styles/global.css         @import tailwindcss, @theme tokens Deklic, recettes survol-plein/fond/texte, prose des guides
│   ├── lib/                      TypeScript pur, 100 % couvert
│   │   ├── site.ts               SITE (nom, origine, description, auteur), urlAbsolue(chemin)
│   │   ├── liens.ts              origineApplication(env), liensApplication(origine), PARAMETRE_TEXTE
│   │   ├── formatage.ts          euros, eurosParMois, pourcentage, pourcentageSigne, dateLongue (fr-FR, espace fine insécable)
│   │   ├── regles.ts             valeurRegle(chemin), texteRegle(chemin, format), estAConfirmer(chemin)
│   │   ├── exemple.ts            carteExemple() : bien, cash-flow, cinq feux avec libellé et état, lus dans calculerProjet(projetExemple)
│   │   ├── seo.ts                metaPage({ titre, description, chemin, type, image })
│   │   ├── donnees-structurees.ts organisation, siteWeb, application, article, faq, filAriane, serialiserJsonLd (échappe <)
│   │   ├── simulateur.ts         lireMontant(texte), calculerRentabilite(saisie) → frais, coût total, brut, net | erreurs
│   │   ├── guides/
│   │   │   ├── categories.ts     CATEGORIES (slug, nom, description), categorieParSlug
│   │   │   ├── schema.ts         SchemaGuide (astro/zod) : longueurs SEO, dates, FAQ, sources https
│   │   │   ├── lecture.ts        tempsDeLecture(texte) en minutes (230 mots/min, arrondi supérieur, 1 min au moins)
│   │   │   ├── lies.ts           guidesLies(courant, tous, 3) : même catégorie d'abord, puis les plus récents
│   │   │   ├── chemins.ts        cheminsGuides(categories, guides) : slugs uniques, sinon erreur nommée
│   │   │   ├── controles.ts      motsClesEnDouble(guides), publies(guides) (sans brouillons, triés par mise à jour)
│   │   │   └── sommaire.ts       sommaire(headings) : H2 et H3, niveaux relatifs
│   │   └── verification/
│   │       ├── pages.ts          verifierPage({ chemin, html }, cheminsExistants) → erreurs (title, description, canonique, un H1, JSON-LD, liens internes, pas d'AggregateRating, pas de script exécutable inline)
│   │       └── en-tetes.ts       texteEnTetes(origineApplication) → contenu de _headers (CSP, nosniff, referrer, permissions)
│   ├── integrations/verification.ts   astro:build:done : lit dist/**/*.html, verifierPage, écrit _headers, lève une erreur listée
│   ├── scripts/simulateur.ts     colle le DOM au calcul (input → calculerRentabilite → sorties)
│   ├── composants/
│   │   ├── Logo.astro            logotype en tracés (marque/logo/deklic-logotype.svg), variante blanche
│   │   ├── EnTete.astro, PiedDePage.astro, MenuTelephone.astro (<details>)
│   │   ├── LienBouton.astro      variantes plein / contour / blanc, recettes survol-*
│   │   ├── ChampAnnonce.astro    <form method="get" action="…/projets/nouveau"> + input name="texte" required
│   │   ├── CarteExemple.astro, Feu.astro
│   │   ├── CarteGuide.astro, GuidesLies.astro, Sommaire.astro, Essentiel.astro, Faq.astro, Sources.astro, AppelAnalyse.astro
│   │   ├── Regle.astro           <Regle chemin="fiscalite.microBic.plafond" format="euros" /> (+ « à confirmer »)
│   │   ├── Simulateur.astro      formulaire + <noscript> + <script> src/scripts/simulateur.ts
│   │   └── DonneesStructurees.astro  <script type="application/ld+json" set:html={serialiserJsonLd(...)}>
│   ├── mises-en-page/Base.astro  <html lang="fr">, meta, polices, en-tête, pied, JSON-LD
│   ├── mises-en-page/Guide.astro fil d'Ariane, en-tête d'article, sommaire, essentiel, contenu, FAQ, sources, liés
│   └── pages/
│       ├── index.astro, 404.astro
│       ├── guides/index.astro, guides/[slug].astro  (catégorie ou article selon cheminsGuides)
│       ├── auteur/pierre-georgel.astro, mentions-legales.astro, confidentialite.astro
│       ├── rss.xml.ts, robots.txt.ts
└── tests/                        un fichier par module de src/lib, + marque.test.ts (tokens = marque/couleurs.json), manifeste.test.ts (paramètre « texte » = share_target du web)
```

## Fichiers à modifier

| Fichier                                | Changement                                                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/capture/src/origines.ts`     | `ORIGINE_VITRINE = 'https://deklic.pro'` (+ test)                                                                                           |
| `vitest.config.ts`                     | seuil 100 % sur `apps/site/src/lib/**` ; exclure `**/*.astro`, `apps/site/src/{integrations,scripts}/**`, `apps/site/src/content.config.ts` |
| `eslint.config.js`                     | ignorer `apps/site/.astro/**`                                                                                                               |
| `.gitignore`                           | `.astro/`                                                                                                                                   |
| `README.md`, `CLAUDE.md`, `.product/*` | fin de feature (scope de commit `site` ajouté)                                                                                              |

## Flux

- **Accueil** : `index.astro` → `carteExemple()` (moteur au build) → `CarteExemple` ; `liensApplication(origineApplication(import.meta.env.DEKLIC_ORIGINE))` → `EnTete`, `ChampAnnonce`, blocs Gérer.
- **Guide** : `getCollection('guides')` → `publies` → `cheminsGuides` + `motsClesEnDouble` (lèvent au build) → `render(entry)` → `headings` → `sommaire` ; frontmatter → `Essentiel`, `Faq`, `Sources`, `metaPage`, JSON-LD `article` + `faq` + `filAriane` ; `guidesLies`.
- **Règle dans un guide** : `<Regle chemin format />` → `texteRegle` → lève si le chemin n'existe pas ou n'est pas un nombre → build en échec.
- **Simulateur** : `input` → `lireMontant` → `calculerRentabilite` (`fraisAcquisition(achat, departement, regles)` avec `AchatSchema.parse`, `rendements`) → texte des sorties ou « — ».
- **Fin du build** : intégration → `verifierPage` sur chaque HTML → erreurs listées (build en échec) → `dist/_headers`.

## Décisions

1. **ADR-010** : Astro statique dans le même dépôt, projet Pages séparé, pas d'intégration React (voir l'ADR).
2. **Guides en MDX** : seule façon d'appeler `<Regle>` et `<Simulateur>` dans le texte ; frontmatter validé par Zod ; FAQ, essentiel et sources dans le frontmatter pour que la page et le JSON-LD disent la même chose.
3. **Catégories et guides à la même profondeur** (`/guides/<slug>/`) : adresses courtes ; `cheminsGuides` refuse une collision.
4. **Liens de production seulement** : l'adresse de l'application vient de `DEKLIC_ORIGINE` (défaut : adresse historique), jamais d'un aperçu. La canonique vise toujours `https://deklic.pro` : un aperçu `*.pages.dev` n'est pas indexé en double.
5. **Polices servies par le site** (Fontsource) : aucune requête vers Google, CSP `font-src 'self'`.
6. **CSP stricte** (`script-src 'self'`) : la vérification refuse tout script exécutable inline ; `form-action` = origine de l'application.
7. **Mentions légales** : éditeur Pierre Georgel, hébergeur Cloudflare, contact `contact@deklic.pro` (adresse à créer par Pierre, routage e-mail Cloudflare gratuit).

## Ordre d'implémentation (un commit par étape)

1. US-1 socle : paquet, config, tokens, polices, Base, EnTete, PiedDePage, Logo, 404, capture `ORIGINE_VITRINE`, vitest/eslint/gitignore racine.
2. US-2 liens : `liens.ts`, `LienBouton`, `ChampAnnonce`, test du manifeste.
3. US-4 + US-7 : `guides/{categories,schema,lecture,lies,chemins,controles,sommaire}`, `content.config.ts`, `regles.ts`, `formatage.ts`, `Regle`.
4. US-5 : `Guide.astro`, composants d'article, `guides/index.astro`, `guides/[slug].astro`, un guide de test en brouillon retiré à l'étape 9.
5. US-6 : `seo.ts`, `donnees-structurees.ts`, `verification/*`, intégration, sitemap, robots, RSS, auteur, mentions, confidentialité.
6. US-3 : `exemple.ts`, `CarteExemple`, `Feu`, `index.astro`.
7. US-8 : `simulateur.ts`, `scripts/simulateur.ts`, `Simulateur.astro`.
8. US-9 à US-11 : un commit par guide.
9. US-12 : ADR-010, README, CLAUDE.md, `.product/`.

## Cas limites

- Règle marquée « à confirmer » : `estAConfirmer` lit `regles.aConfirmer` (chemins exacts).
- Simulateur : texte avec espaces, espaces insécables, virgule décimale, « € » ; vide, zéro, négatif, non numérique → erreur nommée ; département inconnu → taux par défaut du moteur (comme l'application) ; département hors format (`2A`, `976` acceptés).
- Guide sans H2 : sommaire absent (pas de liste vide).
- `misAJourLe` avant `publieLe` : schéma refusé.
- Deux guides au même mot-clé, slug de guide = slug de catégorie : build en échec nommé.
- JSON-LD contenant `</script>` dans une FAQ : `<` échappé en `<`.
- Lien interne vers une ancre (`/guides/x/#faq`) : vérifié sur le chemin sans ancre.

## Risques

- **Astro 7 + Vite 8 à côté de Vite 7** : prouvé à l'étape 1 (build, `astro check`, lint, tests) avant d'aller plus loin.
- **`astro check` et `exactOptionalPropertyTypes`** : si les types d'Astro le refusent, désactivation limitée à `apps/site/tsconfig.json`, dite dans l'ADR.
- **Couverture v8 sur `.astro`** : exclus explicitement.

## Auto-revue critique

- Le simulateur embarque le moteur complet dans le navigateur (schémas Zod compris) : taille à mesurer à l'étape 7 ; si le script dépasse ~80 Ko gzip, n'importer que `fraisAcquisition`, `rendements` et les règles par leurs chemins de module.
- La vérification du HTML par expressions régulières est volontairement simple : elle porte sur du HTML produit par Astro (format connu), pas sur des pages quelconques.
- `apps/site/src/lib` n'importe jamais `astro:content` (module virtuel, non testable) : les types de guide y sont décrits par `SchemaGuide`.
