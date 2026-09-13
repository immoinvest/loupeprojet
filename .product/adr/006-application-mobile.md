# ADR-006 : L'application mobile est une application web installable (PWA)

**Date** : 2026-09-14 · **Statut** : accepté · **Décideur** : session `responsive`, sur la demande de Pierre (« facilement utilisable à travers une application mobile »), dans le cadre de la spec v1

## Contexte

Pierre veut que Deklic soit « cent pour cent responsive » et « facilement utilisable à travers une application mobile », sur téléphones, tablettes et ordinateurs. L'audit du 13/09/2026 montre une interface inutilisable sous 1 024 px (barre latérale fixe, en-têtes qui débordent de 183 à 832 px).

La spec v1 écarte l'application native : _« Pas en v1 : application mobile native (le site est responsive et installable, l'extension mobile vient en v1.5) »_. Elle inscrit en v1 le partage du lien depuis le téléphone par la Web Share Target API, et promet « tout fonctionne sur téléphone ».

Trois voies existent pour « une application mobile » :

1. **Application native** (React Native, Swift/Kotlin) : un second code à maintenir, contraire au principe « tout se calcule dans le navigateur, un seul moteur ».
2. **Emballage de boutique** d'un site web (Trusted Web Activity pour Google Play, emballage WebView pour l'App Store) : même code, mais comptes développeur payants (25 $ une fois chez Google, 99 $ par an chez Apple), revue des boutiques, et la règle 4.2 d'Apple qui refuse les simples sites emballés.
3. **Application web installable (PWA)** : le site lui-même, installé depuis le navigateur sur l'écran d'accueil, en plein écran, avec un service worker pour le hors-ligne et une cible de partage pour recevoir les annonces.

## Décision

**Voie 3 : Deklic est une PWA.**

| Élément            | Décision                                                                                                                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Installation       | Manifeste complet (`id`, `scope`, icônes `any` et `maskable`, raccourcis, `display: standalone`) ; entrée « Installer l'application » quand le navigateur émet `beforeinstallprompt` ; marche à suivre sur iPhone |
| Hors ligne         | Service worker écrit à la main, construit par Vite après l'application : pages en réseau d'abord, fichiers versionnés en cache d'abord, cache nommé par l'empreinte de `index.html`, purge des anciens caches |
| Recevoir un partage | `share_target` en GET vers `/projets/nouveau?titre=…&texte=…&lien=…` : le lien d'annonce est cherché dans les trois paramètres (Android le met souvent dans le texte)                                   |
| Partager un projet | `navigator.share` sur écran tactile, copie du lien sur ordinateur                                                                                                                                         |
| Mise en page       | Tailwind mobile-first ; sous 1 024 px, la barre latérale devient un tiroir ouvert depuis une barre d'app                                                                                                 |

## Conséquences

- Aucun code natif, aucun compte de boutique, aucun coût : les mêmes fichiers servis par Cloudflare Pages font le site et l'application.
- iPhone : installation par « Partager → Sur l'écran d'accueil » (pas d'invite programmable) et pas de cible de partage ; l'utilisateur copie le lien de l'annonce et le colle dans « Nouveau projet ».
- Le service worker est une pièce de plus à maintenir : sa stratégie est une fonction pure testée, et un test Playwright vérifie l'ouverture hors ligne. Pour le retirer en urgence, publier un `sw.js` qui se désenregistre (procédure dans `architecture/responsive.md`).
- La lecture automatique de la page d'annonce reste réservée à l'ordinateur (extension, bouton-favori) jusqu'à l'extension mobile de la v1.5.

## Écarté

- **Application native** : second code, second moteur, contraire à l'architecture « tout dans le navigateur ».
- **Emballage de boutique maintenant** : coût et comptes à la charge de Pierre, revue incertaine chez Apple. Reste possible plus tard au-dessus de la PWA (une Trusted Web Activity réutilise le manifeste et le service worker) : **décision de Pierre**.
- **`vite-plugin-pwa` (Workbox)** : dépendance lourde pour quatre règles de cache ; un service worker court, typé et testé suffit.
