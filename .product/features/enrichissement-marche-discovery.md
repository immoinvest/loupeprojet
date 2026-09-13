# Feature Discovery + Specs : Enrichissement marché

## Demande

« Ok, et ensuite enchaîne sur enrichissement-marche » (Pierre, 13/09/2026), après la mise en ligne de `POST /extract`.

## Analyse

- Le web n'utilisait encore ni le Worker ni les référentiels : le texte collé était lu par règles et chaque projet naissait sans repère de marché (feu « prix » inconnu, titre « Prix sans repère de marché »).
- Les référentiels publiés sur R2 (`deklic-data`, juridiction UE) couvrent déjà les Bouches-du-Rhône : index DVF 2025 par département (par arrondissement pour Marseille), loyers ANIL 2025, zonage ABC, communes. `dvf/courant.json` manque tant qu'aucune passe France entière n'a tourné.
- Le géocodage de « Marseille » + code postal renvoie la commune entière (13055), sans ligne DVF : les ventes sont indexées par arrondissement (13205). Le code postal permet de retrouver l'arrondissement grâce à `communes/<dep>.json` (`communeParente`). Le zonage n'est publié qu'au niveau de la commune.
- Le moteur n'exploite aujourd'hui que la médiane DVF (feu « prix ») ; `loyerReferenceM2` est stocké pour les écrans à venir (estimation du loyer, Méthode).
- La PR extension (#16), ouverte en parallèle, réécrit `NouveauProjet.tsx` : l'essentiel du code va dans de nouveaux modules, l'écran n'est touché qu'aux deux points d'appel.

## Stories

| Story | Titre                         | Gherkin (résumé)                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-1  | Worker `GET /marche`          | `codeInsee` (+ `codePostal`, `type`, `pieces`) → `{ codeInsee, commune, departement, dvf, loyer, zone, sources }` lus sur R2 ; arrondissement retrouvé par le code postal ; commune parente en repli ; millésime DVF par `courant.json` ou les trois dernières années ; fichier hors contrat ignoré et journalisé ; panne R2 → réponse partielle jamais mise en cache ; cache KV 24 h ; limite de débit générale |
| US-2  | Client web du Worker          | `extraire`, `geocoder`, `marche` : réponses revalidées par Zod, échecs traduits en codes (`RESEAU`, `REPONSE_INVALIDE`, code du Worker, `HTTP_<statut>`) ; client hors ligne pour les tests et en repli ; adresse par `VITE_WORKER_URL`                                                                                                                                                                          |
| US-3  | Lecture de l'annonce par l'IA | « Lire le texte » : l'IA d'abord (texte ≥ 40 caractères), les règles comblent ses trous ; sans Worker, lecture par règles comme avant ; message « lus dans l'annonce par l'IA »                                                                                                                                                                                                                                  |
| US-4  | Projet enrichi                | à la création : géocodage `code postal + ville` → `/marche` → `marche.dvf` (médiane, quartiles, nombre de ventes) et `marche.loyerReferenceM2` (ANIL − 8 % de charges), provenance `dvf` / `anil` (« donnée publique ») ; tout échec → projet sans marché, comme avant                                                                                                                                           |
| US-5  | Documentation                 | architecture, registre, README, CLAUDE.md, spécification technique                                                                                                                                                                                                                                                                                                                                               |

## Périmètre

- **IN** : ce qui précède, tests (Worker 100 %, modules `apps/web/src/enrichissement` 100 %, parcours avec un faux Worker), déploiement du Worker avec le binding R2.
- **OUT** : estimation automatique du loyer visé dans le formulaire (le loyer reste « à toi »), taux de taxe foncière (il faut la valeur locative), Géorisques et ADEME, carte et rayon DVF autour de l'adresse (CSV des ventes), affichage des sources dans le rapport, publication DVF France entière (Action « Référentiels »).

## Auto-validation critique

- Les données de marché ne sont récupérées qu'à la création du projet : un projet créé hors ligne reste sans marché (pas de rattrapage automatique à l'ouverture). Acceptable en v1 ; un bouton « actualiser le marché » viendra avec l'onglet Méthode.
- Médiane DVF à la maille commune ou arrondissement, pas dans un rayon de 300 à 800 m comme la spec le prévoit : le CSV des ventes géolocalisées est publié mais pas encore exploité. Le feu « prix » est donc indicatif ; c'est dit par la provenance « donnée publique » et le nombre de ventes.
- Le type de bien est toujours « appartement » (le formulaire ne demande pas encore le type) : une maison est comparée aux appartements de sa commune. À corriger quand le formulaire aura le champ.
- Les tests de création attendent désormais jusqu'à 10 s le rapport : la création passe par un appel réseau (simulé) et la machine de développement est lente sous charge.
