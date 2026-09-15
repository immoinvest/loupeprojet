# Specs — `liens-courts-domaine` (fiche 23)

Discovery : `.product/features/liens-courts-domaine-discovery.md`. Priorités MoSCoW.

## US-1 (Must) — Une seule origine de production

En tant que mainteneur, je change l'adresse du site en un seul endroit.

```gherkin
Scénario: valeur par défaut
  Étant donné aucune variable DEKLIC_ORIGINE au build
  Alors le bouton-favori, og:image et l'extension visent https://loupeprojet.pages.dev

Scénario: bascule préparée
  Étant donné DEKLIC_ORIGINE=https://app.deklic.pro au build
  Alors le bouton-favori et og:image visent https://app.deklic.pro

Scénario: valeur invalide
  Étant donné DEKLIC_ORIGINE=ftp://x ou « app.deklic.pro/chemin »
  Alors la valeur par défaut est gardée

Scénario: origines acceptées
  Alors l'API des comptes accepte https://app.deklic.pro, https://loupeprojet.pages.dev et ses aperçus
  Et refuse https://app.deklic.pro.pirate.example et http://app.deklic.pro
  Et le Worker accepte https://app.deklic.pro en CORS
  Et le pont de l'extension se charge sur https://app.deklic.pro/* et https://*.loupeprojet.pages.dev/*
  Et l'identifiant Firefox reste loupe@loupeprojet.pages.dev
```

## US-2 (Must) — API des liens courts

```gherkin
Scénario: créer
  Quand POST /api/partage { projet } depuis une origine connue
  Alors 201 { id (8 caractères base62), jeton, expireLe = maintenant + 90 jours }
  Et la visite n'est pas stockée

Scénario: lire
  Quand GET /api/partage/:id d'un lien valide
  Alors 200 { projet, expireLe } et l'expiration repart pour 90 jours
  Quand l'identifiant est mal formé, inconnu, supprimé ou expiré
  Alors 404 INTROUVABLE

Scénario: arrêter
  Quand DELETE /api/partage/:id { jeton } avec le bon jeton
  Alors 204, le lien ne s'ouvre plus
  Avec un mauvais jeton : 404, rien n'est supprimé

Scénario: limites
  Plus de 10 créations par heure pour une IP → 429 LIMITE_ATTEINTE
  Corps > 64 Ko → 413 CORPS_TROP_GROS ; projet invalide → 400 CHAMPS_INVALIDES
  Écriture sans Origin connu → 403 ORIGINE_INCONNUE
  Table absente (migration pas appliquée) → 503 PARTAGE_INDISPONIBLE
  Réponses jamais mises en cache ; empreinte d'IP effacée après une heure ; liens expirés purgés à la création
```

## US-3 (Must) — Ouvrir un lien court et un lien compressé

```gherkin
Scénario: /p/:id
  Quand j'ouvre /p/7fK2qA9x
  Alors je vois « Chargement du projet partagé… » puis le projet en lecture seule et « Ajouter à mes projets »
  Lien inconnu ou arrêté : « Ce lien a expiré ou a été arrêté »
  API injoignable : « Impossible d'ouvrir ce lien pour l'instant »

Scénario: #z=
  Quand j'ouvre /partage#z=<compressé>
  Alors le projet s'affiche comme avec #p=
  Et un fragment compressé abîmé ou trop gros une fois décompressé → « lien incomplet ou abîmé »

Scénario: anciens liens
  /partage#p=… continue de s'ouvrir, visite comprise
```

## US-4 (Must) — Bouton Partager

```gherkin
Scénario: lien court
  Quand je clique Partager
  Alors la boîte affiche « Préparation du lien… » puis https://<site>/p/<id>, copié
  Et un second clic sans modification du projet redonne le même lien (aucune nouvelle création)
  Et après une modification, un nouveau lien est créé

Scénario: repli
  Quand l'API échoue ou que l'appareil est hors ligne
  Alors la boîte donne /partage#z=… et dit « Lien long : le partage court n'est pas disponible »

Scénario: arrêter le partage
  Quand un lien court existe et que je clique « Arrêter le partage »
  Alors les liens courts de ce projet sont supprimés et la boîte le dit
```

## US-5 (Should) — Transfert des projets vers la nouvelle adresse

```gherkin
Scénario: import
  Quand j'ouvre /transfert#d=<projets compressés>
  Alors les projets valides sont ajoutés, un projet de même identifiant plus récent n'est pas écrasé
  Et la page dit « N projets récupérés » avec un lien vers Mes projets, et retire le fragment de l'adresse
  Fragment absent ou illisible : message, rien n'est écrit

Scénario: envoi (ancienne adresse)
  Étant donné DEKLIC_TRANSFERT=1 et DEKLIC_ORIGINE différente de l'adresse courante https://loupeprojet.pages.dev
  Quand j'ouvre l'ancienne adresse avec des projets pas encore transférés
  Alors je suis envoyé vers <nouvelle>/transfert#d=… et le transfert est marqué fait
  Sinon je suis redirigé vers la même page sur la nouvelle adresse
  Et un aperçu *.loupeprojet.pages.dev, localhost ou le drapeau absent : rien ne se passe
```

## US-6 (Must) — Documentation

ADR-009, README « Passer sur app.deklic.pro » (étapes de Pierre dans l'ordre), architecture, registre.

## Auto-revue critique

- US-5 envoi : le marqueur est posé avant la redirection ; si le nouveau site échoue, les projets restent sur l'ancien appareil (rien n'est supprimé) : pas de perte possible.
- US-4 : la copie dans le presse-papiers intervient après une requête réseau ; Safari peut la refuser → le message « sélectionnez le lien » existe déjà. Accepté.
- Stories testables une à une, ordre de dépendance : US-1 → US-2 → US-3 → US-4 → US-5 → US-6. Validé.
