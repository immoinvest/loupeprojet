# Specs : Responsive et application mobile

Discovery : `../features/responsive-discovery.md`. Périmètre : `apps/web` (front seul), `marque/` (icône adaptative), tests Playwright et job CI `e2e`.

Formats de référence (largeur × hauteur, en px) : téléphones 320 × 568, 375 × 667, 390 × 844, 412 × 915 ; tablettes 768 × 1 024 (portrait) et 1 024 × 768 (paysage) ; ordinateurs 1 280 × 800, 1 440 × 900, 1 920 × 1 080. Un format est « tactile » s'il est émulé avec écran tactile (téléphones et tablettes).

Écrans de référence (13) : Mes projets, Nouveau projet, Nouveau projet à la main (Vérifier), Rapport, Hypothèses, Fiscalité, Revente, Visite, Comparer, Méthode, Extension, Partage (`/partage#p=…`), Imprimer.

**Cible tactile effective** : l'élément lui-même, ou le `label` qui l'entoure (une case à cocher de 20 px dans une ligne cliquable de 44 px est conforme). Les liens au fil d'une phrase sont exemptés (exception « en ligne » des règles d'accessibilité).

---

## Épopée E1 : Mise en page responsive

### US-1 : Navigation par menu sous 1 024 px

En tant que Camille sur mon téléphone,
je veux ouvrir la navigation depuis un bouton de menu,
afin que le contenu occupe toute la largeur de l'écran.

Priorité : P0 (Must) · Effort : M

```gherkin
Scénario: barre d'app et contenu pleine largeur sur téléphone
  Étant donné l'écran « Mes projets » sur un format de 375 px
  Alors une barre d'app montre le logo Deklic et le bouton « Ouvrir le menu »
  Et la barre latérale n'est pas visible
  Et le titre « Mes projets » commence à 16 px du bord gauche
  Et la page ne défile pas horizontalement

Scénario: ouvrir le menu, naviguer, le menu se referme
  Étant donné un format de 390 px
  Quand je touche « Ouvrir le menu »
  Alors le tiroir affiche « Nouveau projet », mes projets, « Comparer », « Comment c'est calculé », « Extension navigateur » et le profil
  Et le bouton porte aria-expanded="true"
  Quand je touche « Comparer »
  Alors l'écran Comparer s'affiche et le tiroir est fermé

Scénario: fermer sans naviguer
  Étant donné le tiroir ouvert
  Quand j'appuie sur Échap, ou que je touche le voile, ou le bouton « Fermer le menu »
  Alors le tiroir se ferme et le focus revient sur « Ouvrir le menu »

Scénario: ordinateur inchangé
  Étant donné un format de 1 280 px
  Alors la barre latérale est visible en permanence et le bouton « Ouvrir le menu » n'est pas visible

Scénario: tablette paysage
  Étant donné un format de 1 024 px
  Alors la barre latérale est visible en permanence

Scénario: impression
  Étant donné le document imprimable
  Alors ni la barre d'app ni la barre latérale ne sont imprimées
```

### US-2 : En-tête de projet adaptatif

En tant que Camille,
je veux voir le nom du projet, ses actions et ses onglets sans défilement horizontal,
afin de passer d'un volet à l'autre au pouce.

Priorité : P0 · Effort : S

```gherkin
Scénario: téléphone
  Étant donné le rapport du projet d'exemple sur un format de 320 px
  Alors le fil d'Ariane, le prix et le mode sont lisibles sur toute la largeur
  Et le statut, « PDF » et « Partager » passent à la ligne sans déborder
  Et les cinq onglets forment une bande qui défile au doigt, l'onglet actif visible
  Et la page ne défile pas horizontalement

Scénario: tablette portrait et paysage
  Étant donné un format de 768 px, puis de 1 024 px
  Alors l'en-tête tient sur deux rangées (nom et actions, puis onglets) sans déborder

Scénario: onglet actif hors de la bande
  Étant donné un format de 320 px
  Quand j'ouvre directement le volet « Visite »
  Alors l'onglet « Visite » est défilé dans la partie visible de la bande

Scénario: lien de partage à copier à la main
  Étant donné un format de 375 px et un presse-papiers qui refuse
  Quand je touche « Partager »
  Alors le champ « Lien de partage » occupe la largeur disponible sans déborder
```

### US-3a : Écrans de liste, de création et de rapport

En tant que Camille,
je veux que « Mes projets », « Nouveau projet », « Vérifier », le « Rapport » et un projet partagé s'adaptent à mon écran,
afin de lire les chiffres et d'agir sans zoomer.

Priorité : P0 · Effort : M

```gherkin
Scénario: Mes projets sur téléphone
  Étant donné un format de 375 px
  Alors chaque carte de projet montre le nom, le prix, le statut, les quatre métriques en deux colonnes, les cinq feux et « Supprimer »
  Et les filtres, « Comparer » et « Nouveau projet » passent à la ligne sans déborder

Scénario: Nouveau projet et Vérifier
  Étant donné un format de 320 px
  Quand je touche « Je n'ai pas de lien, je saisis à la main »
  Alors le formulaire s'affiche sur une colonne, deux à partir de 640 px, trois à partir de 1 024 px

Scénario: Rapport
  Étant donné un format de 390 px
  Alors le verdict et les cinq feux s'affichent sur une colonne
  Et les cartes « cher » et « autofinance » s'empilent, puis se placent côte à côte à partir de 768 px
  Et la carte des leviers empile ses trois blocs, séparés par des filets horizontaux
  Et la jauge de prix garde ses repères lisibles sans chevauchement

Scénario: projet partagé
  Étant donné un lien de partage ouvert sur un format de 375 px
  Alors le bandeau « Projet partagé » empile son texte et « Ajouter à mes projets »

Scénario: ordinateur
  Étant donné un format de 1 280 px
  Alors ces écrans gardent la disposition d'aujourd'hui (les parcours Playwright existants restent verts)
```

### US-3b : Volets, comparaison et pages d'aide

En tant que Camille,
je veux que les volets Hypothèses, Fiscalité, Revente, Visite, la comparaison, la méthode, la page Extension et l'aperçu d'impression s'adaptent à mon écran,
afin de tout consulter sur téléphone et tablette.

Priorité : P0 · Effort : L

```gherkin
Scénario: Hypothèses
  Étant donné un format de 375 px
  Alors la synthèse (cash-flow, rendement, TRI, effort) tient en deux colonnes sous la barre d'app
  Et les champs de chaque groupe s'affichent sur une colonne, deux à partir de 640 px, trois à partir de 1 024 px

Scénario: Fiscalité et Revente
  Étant donné un format de 390 px
  Alors les quatre régimes et les quatre horizons s'affichent sur une colonne, deux à partir de 640 px, quatre à partir de 1 280 px
  Et le tableau « Année par année » défile dans sa carte, la colonne « Année » restant visible
  Et le détail de la plus-value passe sur une colonne

Scénario: Comparer
  Étant donné un format de 375 px et deux projets
  Alors le tableau défile dans sa carte, la colonne des indicateurs restant visible
  Et la page ne défile pas horizontalement

Scénario: Méthode
  Étant donné un format de 320 px
  Alors chaque constante s'affiche en bloc (libellé, valeur, source) au lieu d'un tableau à trois colonnes
  Et à partir de 768 px le tableau revient

Scénario: Imprimer
  Étant donné l'aperçu d'impression sur un format de 375 px
  Alors la barre « Retour au projet / Imprimer » s'empile et le document garde des marges de 16 px
  Et l'impression papier est inchangée (tests d'impression verts)
```

### US-4 : Confort tactile

En tant que Camille,
je veux des commandes assez grandes pour mon doigt et des champs qui ne font pas zoomer mon téléphone,
afin de saisir et naviguer sans erreur.

Priorité : P0 · Effort : S

```gherkin
Scénario: cibles tactiles
  Étant donné un format tactile et l'un des 13 écrans
  Alors chaque bouton, lien de navigation, onglet, liste, champ, résumé « Pourquoi ? » et case à cocher offre une cible effective d'au moins 44 × 44 px
  Sauf les liens au fil d'une phrase

Scénario: champs sans zoom
  Étant donné un écran tactile (pointeur grossier)
  Alors chaque champ, liste et zone de texte a une police d'au moins 16 px

Scénario: ordinateur
  Étant donné un pointeur fin (souris)
  Alors les champs gardent leur taille de police actuelle (15 px)

Scénario: information réservée au survol
  Étant donné un écran tactile
  Alors aucune information nécessaire n'existe seulement dans une infobulle (voir US-8 pour l'avertissement de partage)
```

---

## Épopée E2 : Application mobile

### US-5 : Application installable

En tant que Camille,
je veux installer Deklic sur l'écran d'accueil de mon téléphone,
afin de l'ouvrir en plein écran comme une application.

Priorité : P1 (Should) · Effort : M

```gherkin
Scénario: manifeste complet
  Étant donné le build de production
  Quand je lis /manifest.webmanifest
  Alors il déclare id, scope, start_url, display "standalone", lang "fr", theme_color, background_color
  Et les icônes 192 et 512 px en "any" et en "maskable"
  Et les raccourcis « Nouveau projet » et « Mes projets »
  Et une share_target (US-7)

Scénario: invite d'installation du navigateur
  Étant donné un navigateur qui émet beforeinstallprompt (Chrome, Edge, Android)
  Alors « Installer l'application » apparaît dans le profil de la barre latérale
  Quand je le touche
  Alors l'invite du navigateur s'ouvre
  Et après installation (appinstalled) le bouton disparaît

Scénario: application déjà installée
  Étant donné Deklic ouvert en mode standalone
  Alors « Installer l'application » n'apparaît pas

Scénario: iPhone
  Étant donné Safari sur iPhone (aucune invite)
  Alors la page Extension explique « Partager, puis Sur l'écran d'accueil »

Scénario: encoche et barre d'accueil
  Étant donné l'app installée sur un téléphone à encoche
  Alors la barre d'app et le tiroir respectent les marges de sécurité (env(safe-area-inset-*))
```

### US-6 : Application hors ligne

En tant que Camille dans le métro,
je veux ouvrir Deklic sans réseau,
afin de relire mes projets et préparer ma visite.

Priorité : P1 · Effort : M

```gherkin
Scénario: rechargement sans réseau
  Étant donné une première visite en ligne du build de production
  Quand le réseau est coupé et que je recharge « Mes projets »
  Alors « Mes projets » s'affiche avec mes projets

Scénario: route profonde sans réseau
  Étant donné l'application déjà visitée
  Quand j'ouvre /projets/<id>/fiscalite sans réseau
  Alors le volet Fiscalité s'affiche, calculé dans le navigateur

Scénario: nouvelle version publiée
  Étant donné une page chargée en ligne
  Alors la page elle-même est demandée au réseau d'abord : un déploiement est pris dès la visite suivante

Scénario: autres origines
  Étant donné un appel au Worker ou aux polices Google
  Alors le service worker ne le met pas en cache et ne l'intercepte pas

Scénario: développement et échec
  Étant donné le serveur de développement, ou un navigateur sans service worker
  Alors aucun service worker n'est enregistré et l'application fonctionne comme aujourd'hui
```

Contrat de cache :

| Requête                                                   | Stratégie                                       |
| --------------------------------------------------------- | ----------------------------------------------- |
| Navigation de même origine                                | Réseau d'abord, repli sur la coque en cache      |
| GET de même origine sous `/assets/`                       | Cache d'abord, sinon réseau puis mise en cache  |
| GET de même origine : manifeste, icônes, favicon          | Réseau d'abord, repli cache                     |
| `/capture.js`, autre méthode que GET, autre origine        | Ignorée (le navigateur fait comme sans service worker) |

Cache nommé par version de build ; à l'activation, les caches d'une autre version sont supprimés ; à l'installation, la coque (`/`, script et styles référencés par la page, manifeste, icônes) est mise en cache.

### US-7 : Recevoir une annonce partagée depuis l'app d'un portail

En tant que Camille dans l'app LeBonCoin,
je veux choisir « Partager → Deklic »,
afin de lancer l'analyse de l'annonce sans copier le lien.

Priorité : P1 · Effort : S

Contrat (manifeste) :

```json
"share_target": {
  "action": "/projets/nouveau",
  "method": "GET",
  "params": { "title": "titre", "text": "texte", "url": "lien" }
}
```

```gherkin
Scénario: lien dans le texte (Android)
  Étant donné /projets/nouveau?texte=Regarde%20cette%20annonce%20https%3A%2F%2Fwww.leboncoin.fr%2Fad%2Fventes_immobilieres%2F2214738851
  Alors le champ « Lien de l'annonce » contient https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851
  Et « leboncoin.fr reconnu » s'affiche avec « reçue par partage »
  Et la carte « Le texte de l'annonce » invite à coller le texte
  Et l'adresse redevient /projets/nouveau

Scénario: lien dans le paramètre lien ou titre
  Étant donné lien=https://www.seloger.com/annonces/achat/appartement/lyon-3eme-69/123456789.htm
  Alors SeLoger est reconnu
  Et le lien trouvé dans titre est pris quand lien et texte n'en ont pas

Scénario: lien d'un site non reconnu
  Étant donné texte=Vu ici https://exemple.fr/annonce/42
  Alors le champ contient https://exemple.fr/annonce/42 et « Site non reconnu » s'affiche

Scénario: texte sans lien
  Étant donné texte=Appartement T3 de 65 m² au 3e étage, prix 155 000 €, DPE D
  Alors le texte partagé est placé dans « Le texte de l'annonce », prêt à être lu

Scénario: paramètres absurdes
  Étant donné un texte de 20 000 caractères ou des paramètres vides
  Alors l'écran reste utilisable, le texte est tronqué à 10 000 caractères et rien n'est enregistré

Scénario: capture de l'extension prioritaire
  Étant donné à la fois #capture=… et ?texte=…
  Alors la capture de l'extension est utilisée
```

### US-8 : Partager un projet depuis le téléphone

En tant que Camille,
je veux envoyer mon projet par la feuille de partage de mon téléphone,
afin de le montrer à mon conjoint ou à mon banquier par message.

Priorité : P1 · Effort : S

```gherkin
Scénario: feuille de partage native
  Étant donné un écran tactile dont le navigateur propose navigator.share
  Quand je touche « Partager »
  Alors navigator.share reçoit le titre (nom du projet), un texte court et le lien de partage
  Et après le partage « Lien partagé » s'affiche avec l'avertissement « Il contient tout le projet, revenus et apport compris. »

Scénario: partage annulé
  Étant donné la feuille de partage ouverte
  Quand je la ferme sans choisir (AbortError)
  Alors rien d'autre ne se passe : ni copie, ni message d'erreur

Scénario: partage impossible
  Étant donné navigator.share absent, ou une autre erreur
  Alors le lien est copié comme aujourd'hui, ou affiché à copier à la main

Scénario: ordinateur
  Étant donné un pointeur fin
  Alors « Partager » copie le lien comme aujourd'hui, et l'avertissement s'affiche avec « Lien copié »
```

### US-9 : Page Extension pour téléphone et tablette

En tant que Camille sur mon téléphone,
je veux savoir comment installer Deklic et y envoyer une annonce,
afin de ne pas chercher une extension qui n'existe pas sur mobile.

Priorité : P2 (Could) · Effort : S

```gherkin
Scénario: écran tactile
  Étant donné la page /extension sur un format tactile
  Alors la première carte « Sur téléphone et tablette » explique : installer l'application (bouton quand le navigateur le permet, sinon la marche à suivre Android et iPhone) et partager une annonce vers Deklic
  Et le bouton-favori et l'extension sont présentés comme réservés à l'ordinateur

Scénario: ordinateur
  Étant donné un pointeur fin
  Alors la carte « Sur téléphone et tablette » vient après les cartes actuelles

Scénario: déjà installée
  Étant donné Deklic en mode standalone
  Alors la carte dit que l'application est installée et ne propose plus l'installation
```

---

## Épopée E3 : Preuve automatique

### US-10 : Parcours et formats contrôlés en continu

En tant que Pierre, qui ne relit pas le code,
je veux que la CI vérifie chaque écran sur téléphone, tablette et ordinateur,
afin qu'aucune régression de mise en page ne passe inaperçue.

Priorité : P0 · Effort : M

```gherkin
Scénario: parcours sur trois appareils
  Étant donné les projets Playwright « ordinateur » (1 280 × 720), « téléphone » (Pixel 7, 412 × 839, tactile) et « tablette » (768 × 1 024, tactile)
  Alors les 8 parcours existants passent sur les trois
  Et les aides de test ouvrent le menu quand la barre latérale est cachée

Scénario: 13 écrans × 9 formats
  Étant donné la spec « responsive »
  Alors chaque écran de référence a 0 px de débordement horizontal sur chacun des 9 formats
  Et sur les formats tactiles, les cibles effectives font au moins 44 px et les champs au moins 16 px
  Et en cas d'échec, le rapport nomme l'écran, le format et les éléments fautifs

Scénario: durée
  Étant donné le job CI e2e
  Alors il reste sous sa limite de temps (15 minutes, portée à 20 si nécessaire, justifiée dans la PR)
```

---

## Contrats d'interface (front)

| Élément                          | Contrat                                                                                                                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bouton de menu                   | `button` nommé « Ouvrir le menu », `aria-expanded`, `aria-controls` vers la navigation principale ; masqué à partir de 1 024 px                                                               |
| Tiroir                           | La barre latérale existante (`aside`), en panneau fixe sous 1 024 px ; bouton « Fermer le menu » ; fermeture à Échap, au voile et à chaque changement de route ; contenu derrière rendu inerte |
| Invite d'installation            | État en mémoire : `disponible` (événement gardé), `installee` (standalone ou appinstalled), `indisponible` ; jamais stocké                                                                    |
| Partage reçu                     | `lirePartageRecu(search: string)` → `{ statut: 'absent' }` ou `{ statut: 'recu', url?: string, texte?: string }` ; paramètres `titre`, `texte`, `lien` ; texte tronqué à 10 000 caractères       |
| Partage d'un projet              | Décision pure : `modePartage({ tactile, partageNatif })` → `'natif'` ou `'copie'` ; AbortError = annulation silencieuse                                                                      |
| Service worker                   | `/sw.js`, portée `/`, enregistré en production seulement ; stratégie par requête décidée par une fonction pure testée                                                                         |

## Modèles de données

Aucun changement : aucune donnée nouvelle n'est stockée (ni l'état d'installation, ni les paramètres de partage, ni l'état du menu). Le cache du service worker ne contient que les fichiers publics de l'application.

## Priorisation MoSCoW

| Story | Titre                                   | Priorité     | Effort | Dépendances       |
| ----- | --------------------------------------- | ------------ | ------ | ----------------- |
| US-1  | Navigation par menu sous 1 024 px       | Must (P0)    | M      | -                 |
| US-2  | En-tête de projet adaptatif             | Must (P0)    | S      | US-1              |
| US-3a | Liste, création, rapport                | Must (P0)    | M      | US-1              |
| US-3b | Volets, comparaison, pages d'aide       | Must (P0)    | L      | US-1              |
| US-4  | Confort tactile                         | Must (P0)    | S      | US-3a, US-3b      |
| US-10 | Parcours et formats contrôlés en CI     | Must (P0)    | M      | US-1 à US-4       |
| US-5  | Application installable                 | Should (P1)  | M      | US-1              |
| US-6  | Application hors ligne                  | Should (P1)  | M      | US-5              |
| US-7  | Recevoir une annonce partagée           | Should (P1)  | S      | US-5              |
| US-8  | Partager un projet depuis le téléphone  | Should (P1)  | S      | US-2              |
| US-9  | Page Extension pour téléphone           | Could (P2)   | S      | US-5, US-7        |

Ordre d'implémentation : US-1 → US-2 → US-3a → US-3b → US-4 → US-10 → US-5 → US-6 → US-7 → US-8 → US-9. Effort total estimé : XL.

## Auto-validation critique

- **11 stories, 3 épopées** : 6 Must, 4 Should, 1 Could. Toutes les Must rendent l'interface utilisable ; les Should font de Deklic une application ; la Could guide l'utilisateur.
- **Désaccord avec la maquette assumé** : sous 1 024 px la barre latérale devient un tiroir ; au-delà, rien ne bouge.
- **Risque de dérive** : US-3b est la plus longue (huit écrans). Elle reste une story, avec un commit, car ses écrans partagent les mêmes composants de mise en page.
- **Mesure plutôt que ressenti** : l'audit qui a produit le constat devient la spec `responsive` (US-10), avec la règle de cible effective écrite ici pour éviter les faux positifs (cases dans un label, liens dans le texte).
