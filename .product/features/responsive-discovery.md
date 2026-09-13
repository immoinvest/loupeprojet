# Feature Discovery : Responsive et application mobile

## Demande d'origine

Pierre, 13/09/2026 : « Assure-toi que l'application est cent pour cent responsive et qu'elle est facilement utilisable à travers une application mobile, et qu'elle fonctionne pour tous les formats mobiles, tablettes et web. » Pipeline `/new-feature`, points de contrôle auto-validés.

La spec de référence tranche la forme de « l'application mobile » : _« Pas en v1 : application mobile native (le site est responsive et installable, l'extension mobile vient en v1.5) »_. Elle promet aussi « tout fonctionne sur téléphone » et, en v1, le **partage du lien depuis le téléphone** (« Partager → Loupe » depuis l'app du portail, Web Share Target). La réponse est donc une application web installable (PWA), pas une app de boutique.

## Constat (audit du 13/09/2026)

Build de production servi par `vite preview`, Chromium, 13 écrans mesurés sur 9 formats (320, 375, 390, 412, 768, 1024, 1280, 1440, 1920 px de large) : débordement horizontal de la page, éléments fautifs, cibles tactiles sous 44 px, taille de police des champs.

| Format                        | Constat                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Téléphones (320 à 412 px)     | **Inutilisable.** La barre latérale fixe de 248 px ne laisse que 72 à 164 px au contenu : titres à un mot par ligne, cartes et textes superposés, grille de « Mes projets » (7 colonnes) illisible. Sur « Nouveau projet », une carte recouvre le bouton « je saisis à la main » : le clic est impossible.                                                   |
| Tablette portrait (768 px)    | Débordement de **439 px** sur les cinq volets d'un projet (onglets, statut, PDF et Partager sur une seule ligne de 1 207 px), 90 px sur « Mes projets » (boutons de l'en-tête), 121 px sur « Partage » (carte Leviers à trois colonnes).                                                                                                                     |
| Tablette paysage (1 024 px)   | Débordement de **183 px** sur les cinq volets (actions de l'en-tête jusqu'à 1 207 px).                                                                                                                                                                                                                                                                       |
| Ordinateur (1 280 à 1 920 px) | Aucun débordement.                                                                                                                                                                                                                                                                                                                                           |
| Tous formats                  | Champs en 15 px (49 dans Hypothèses, 20 dans Vérifier) : Safari sur iPhone zoome à chaque saisie. Cibles tactiles trop petites : cases de la Visite 20 × 20, boutons de tri de Comparer 23 px de haut, sommaire de la Méthode 36 px, « Pourquoi ? » 20 px, fil d'Ariane 18 px, liste de statut 21 px, « je saisis à la main » et « Retour au projet » 20 px. |
| Application                   | Le manifeste suffit déjà à Chrome pour proposer l'installation (nom, icônes 192 et 512, `start_url`, `display: standalone`), mais : aucune entrée « Installer », pas d'icône adaptative (maskable), pas de raccourcis, pas de cible de partage, et l'app installée affiche la page d'erreur du navigateur sans réseau.                                       |
| Partage et page Extension     | « Partager » copie un lien ; l'avertissement (le lien contient revenus et apport) n'existe qu'en infobulle, invisible au doigt. La page Extension ne parle que d'ordinateur : ni favori ni extension ne fonctionnent dans un navigateur de téléphone.                                                                                                        |

Au format 375 px, le débordement atteint 832 px sur les volets d'un projet, 514 px sur « Partage », 482 px sur « Mes projets », 262 px sur « Méthode ».

Base de tests : 8 parcours Playwright verts (bureau), 636 tests unitaires verts (89 fichiers).

## Analyse

- **Quoi** : une interface pensée d'abord pour le téléphone qui s'élargit jusqu'à l'ordinateur sans changer le rendu validé au-delà de 1 280 px ; une application installable, qui s'ouvre sans réseau, reçoit une annonce partagée depuis l'app d'un portail et partage un projet par la feuille de partage du téléphone.
- **Pourquoi** : Camille cherche ses annonces sur son téléphone, dans l'app LeBonCoin ou SeLoger, et prépare ses visites debout dans la rue. Aujourd'hui Deklic est inutilisable sous 1 024 px : le premier geste du parcours (« coller le lien ») est impossible sur le format où l'annonce est trouvée.
- **Pour qui** : Camille sur téléphone (repérage, visite, transports), sur tablette (analyse du soir), sur ordinateur (inchangé).
- **Où** : `apps/web` seulement (coque, écrans, composants, `index.css`, `index.html`, manifeste, icônes, service worker construit comme le bouton-favori), `marque/` (source de l'icône adaptative), tests unitaires et Playwright, job CI `e2e`, docs. Rien dans `packages/moteur`, `packages/capture`, `apps/worker`, `apps/extension`, `data/`.

## Outcomes

1. Chaque écran se lit et s'utilise de 320 à 1 920 px : aucune barre de défilement horizontale de page, chiffres et titres lisibles, toutes les actions atteignables au pouce.
2. Deklic s'installe comme une application sur Android, iPhone et ordinateur, s'ouvre en plein écran depuis l'écran d'accueil, et fonctionne sans réseau (projets, calculs, rapport, impression).
3. Depuis un téléphone, une annonce partagée depuis l'app d'un portail ouvre « Nouveau projet » avec le lien reconnu ; un projet se partage par la feuille de partage du téléphone.
4. La preuve est automatique : 13 écrans × 9 formats contrôlés, et les parcours existants rejoués sur téléphone, tablette et ordinateur, en CI.

## Outputs

1. **Coque adaptative** : sous 1 024 px, une barre d'app en haut (logo, menu) et la barre latérale actuelle en tiroir (même contenu, même DOM) ; au-delà, la barre latérale fixe d'aujourd'hui.
2. **En-tête de projet adaptatif** : nom et prix, actions (statut, PDF, Partager) qui passent à la ligne, onglets en bande défilante au doigt.
3. **Écrans mobile-first** : marges 16 / 24 / 40 px, titres à l'échelle, grilles 1 → 2 → 4 colonnes, carte Leviers empilée, cartes de « Mes projets » recomposées, tableaux défilants dans leur carte (Fiscalité, Comparer) avec première colonne fixe, constantes de la Méthode empilées sur téléphone, formulaires 1 → 2 → 3 colonnes, synthèse d'Hypothèses en 2 × 2, jauge de prix lisible à 320 px, barres d'Imprimer et de Partage empilées.
4. **Confort tactile** : cibles ≥ 44 px (cases, tris, « Pourquoi ? », sommaire, fil d'Ariane, liste de statut, liens isolés), champs en 16 px sur écran tactile, aucune information réservée au survol.
5. **Application installable** : manifeste complété (`id`, `scope`, icônes `any` et `maskable`, raccourcis Nouveau projet et Mes projets, `share_target`), `viewport-fit=cover` et marges de sécurité (encoche, barre d'accueil), entrée « Installer l'application » (invite du navigateur sur Android et ordinateur, marche à suivre sur iPhone).
6. **Partager une annonce vers Deklic** : `/projets/nouveau?titre=…&texte=…&lien=…` lit le lien où qu'Android l'ait mis (lien, texte ou titre) et pré-remplit « Nouveau projet ».
7. **Partager un projet depuis le téléphone** : sur écran tactile, « Partager » ouvre la feuille de partage native ; sur ordinateur, la copie du lien reste ; l'avertissement est écrit en clair.
8. **Hors ligne** : un service worker garde l'application (page, script, styles, icônes) ; l'app installée s'ouvre sans réseau ; la lecture par l'IA et l'enrichissement retombent sur les règles locales, comme aujourd'hui en cas de panne du Worker.
9. **Page Extension** élargie aux téléphones : installer l'app, partager une annonce vers Deklic.
10. **Tests** : spec Playwright `responsive` (débordement, cibles tactiles, navigation au menu sur 9 formats), parcours existants sur trois projets (téléphone, tablette, ordinateur), tests du hors-ligne, du partage reçu et du manifeste ; tests unitaires des modules de logique à 100 %.

## Périmètre

### IN

Tout ce qui précède.

### OUT

- **Applications de boutique** (Play Store par une Trusted Web Activity, App Store par un emballage natif) : comptes développeur payants (25 $ Google, 99 $/an Apple) et revue des boutiques, décision de Pierre ; la PWA est la réponse v1 de la spec.
- **Extension mobile** (Safari iOS, Firefox Android) et lecture automatique de la page d'annonce sur téléphone : v1.5 selon la spec ; sur téléphone, le lien partagé est reconnu et le texte se colle, comme sur ordinateur sans extension.
- Notifications, synchronisation en arrière-plan, lecture par l'IA et enrichissement sans réseau (ils demandent le Worker).
- Mode sombre, refonte de la direction visuelle (ADR-004 conservé), verrouillage de l'orientation.
- Tests sur appareils réels en laboratoire et moteur WebKit en CI ; une vérification à la main sur un iPhone est recommandée.
- Cible de partage en POST (captures d'écran d'annonces).

## Contraintes

- **Rendu ordinateur inchangé** au-delà de 1 280 px, sauf ce que le débordement impose ; impression et mode document intacts.
- **Tailwind v4 mobile-first** (points de rupture `sm` 640, `md` 768, `lg` 1 024, `xl` 1 280, `2xl` 1 536) ; la mise en page change par CSS, jamais par un calcul JavaScript de la largeur, pour garder des tests jsdom simples.
- **Une seule navigation dans le DOM** : pas de liens dupliqués entre barre d'app, tiroir et barre latérale (accessibilité et tests existants).
- **Service worker prudent** : pages en réseau d'abord, fichiers versionnés en cache d'abord, anciens caches purgés, jamais d'appel au Worker ni d'autre origine mis en cache, inactif en développement ; aucune version périmée ne doit rester bloquée après un déploiement.
- **Tout reste dans le navigateur** : cible de partage en GET, aucune donnée transmise, aucun suivi des installations.
- **Tests d'émulation Chromium** pour téléphones et tablettes (Playwright déconseille les profils iPhone avec Chromium ; WebKit n'est pas installé).
- **Machine chargée** : gates en 10 minutes environ ; le job CI `e2e` doit rester sous sa limite de 15 minutes.
- Fichiers ≤ 300 lignes, textes dans `textes/`, couverture 100 % des nouveaux modules de logique.

## Risques

| Risque                                                                      | Mitigation                                                                                                                   |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Navigation dupliquée (barre d'app + tiroir) : liens en double, tests cassés | La barre latérale existante devient le tiroir ; la barre d'app n'a que le logo et le bouton de menu                          |
| Tiroir peu accessible (focus, Échap, défilement)                            | Fermeture à Échap, au voile et à chaque navigation ; focus rendu au bouton ; page figée derrière ; tests                     |
| Service worker qui sert une vieille version                                 | Pages en réseau d'abord, cache versionné par build, purge à l'activation ; test hors ligne ; procédure de retrait documentée |
| Android place le lien partagé dans le texte ou le titre                     | Recherche du premier lien d'annonce dans lien, texte puis titre ; tests avec des textes de partage réalistes                 |
| iPhone : ni `beforeinstallprompt` ni cible de partage                       | Marche à suivre « Partager → Sur l'écran d'accueil » ; partage par lien copié                                                |
| Zoom de Safari à la saisie                                                  | Champs en 16 px sur écran tactile                                                                                            |
| Tableaux larges sur téléphone                                               | Défilement dans la carte et première colonne fixe ; constantes de la Méthode empilées                                        |
| Régressions de débordement plus tard                                        | Spec `responsive` en CI sur 9 formats                                                                                        |
| Icône adaptative sans outil de dessin                                       | Source SVG dans `marque/`, PNG rendus par Chromium (Playwright), contrôlés à l'œil                                           |
| Durée du job e2e multipliée par trois                                       | Parcours sur trois projets, contrôle des formats en un test par format ; durée mesurée                                       |

## Definition of Done

- [ ] 0 px de débordement horizontal sur les 13 écrans × 9 formats
- [ ] Cibles tactiles ≥ 44 px et champs ≥ 16 px sur les formats tactiles (écarts assumés listés)
- [ ] Les 8 parcours existants verts sur téléphone, tablette et ordinateur
- [ ] Manifeste complet (`id`, `scope`, icônes `any` et `maskable`, raccourcis, `share_target`) et entrée « Installer l'application »
- [ ] Application ouverte sans réseau après une première visite (test Playwright)
- [ ] Annonce partagée depuis un téléphone : portail reconnu dans « Nouveau projet » (tests unitaire et Playwright)
- [ ] « Partager » : feuille native sur écran tactile, copie sur ordinateur, avertissement écrit
- [ ] Impression inchangée (tests d'impression verts)
- [ ] Gates verts, docs à jour, PR ouverte en merge automatique, rapport à Pierre

## Auto-validation critique

- **« Application mobile » = PWA** : c'est la lecture de la spec (« responsive et installable », pas d'app native en v1). Une app de boutique coûte de l'argent et des comptes : hors périmètre, signalé à Pierre.
- **Le hors-ligne est inclus** : sans lui, l'app installée ouvre une page d'erreur en zone blanche, ce qui contredit « facilement utilisable » ; le risque de version périmée est traité par la stratégie réseau d'abord.
- **La cible de partage est incluse** : c'est le seul chemin rapide de l'app d'un portail vers Deklic sur téléphone, déjà inscrit en v1 dans la spec.
- **Point faible assumé** : pas de test sur un vrai iPhone ni sous WebKit ; la parade est le CSS standard (`dvh`, `env(safe-area-inset-*)`, champs 16 px) et une vérification manuelle recommandée.
