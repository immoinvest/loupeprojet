# UX — Gérer

Specs : `.product/specs/gestion-locative-specs.md` · Maquettes : `.product/design/gestion-locative-maquettes.html` (en ligne : https://claude.ai/code/artifact/8cbafc8f-e84c-442e-ac70-c676588ce7e0) · Direction visuelle : « Le guide » (ADR-004) avec l'identité Deklic (ADR-005) · Date : 2026-09-14

## Intention

Gérer doit se sentir comme **un assistant qui a déjà fait le travail**, pas comme un logiciel à remplir. Trois idées guident tout l'espace :

1. **Deux clics.** Chaque porte d'entrée finit sur un écran déjà rempli où il ne reste qu'à dire « C'est parti ».
2. **Une question par écran.** L'accueil répond à « qui a payé ? » ; une fiche répond à « où en est ce bien ? » ; un e-mail pose une seule question.
3. **Les exceptions, pas la routine.** Un mois normal ne demande rien. Deklic ne montre que ce qui demande une décision.

Ce qui distingue Deklic de Rentila à l'écran : aucun onglet dans les formulaires, aucune liste déroulante de 26 types de biens, aucun réglage de dates de quittancement, et une phrase lisible en tête de chaque écran.

## Navigation

### Sélecteur « Analyser · Gérer »

Sous le logo, un sélecteur à deux segments. Il change **tout le menu** et le bouton principal ; le choix est retenu.

```
┌──────────────────────────┐
│ Deklic                   │
│ ┌──────────┬───────────┐ │
│ │ Analyser │ ▌Gérer    │ │
│ └──────────┴───────────┘ │
│ [ + Ajouter un bien    ] │
│                          │
│ ⌂  Accueil               │
│ €  Loyers            •2  │   pastille = loyers en retard ou à confirmer
│ ▢  Biens                 │
│ ☺  Locataires            │
│ ↗  Argent                │
│ ⇄  Banque     (G3)       │
│                          │
│ MES BIENS                │
│ T2 Lices            ●    │   point : reçu / attendu / en retard / vacant
│ Coloc Rouet    2/3  ●    │
│                          │
│ (profil)                 │
└──────────────────────────┘
```

- « Analyser » garde le menu actuel (Nouveau projet, Mes projets, Comparer, aide).
- La liste « Mes biens » reprend le motif de « Mes projets » (nom + point d'état) pour que les deux espaces se ressemblent.
- **Téléphone** : barre du bas à 5 entrées : Accueil, Loyers, **+** (ajouter), Argent, Plus ; le sélecteur Analyser · Gérer passe dans l'en-tête.

### Sans compte

`/gerer` affiche une seule carte : « Tes loyers suivis, tes quittances envoyées toutes seules. » · « Pour envoyer tes quittances même quand ton ordinateur est éteint, Deklic garde tes biens sur ses serveurs en Europe. Il faut un compte. » · bouton « Se connecter » · lien « Continuer à analyser ».

## Les trois portes (accueil vide)

Titre : **« Mettons tes biens en pilote automatique. »** Sous-titre : « Deux clics, promis. »

Trois cartes côte à côte (empilées au téléphone), même hauteur, même structure : icône, titre, une phrase, bouton.

| Carte                           | Phrase                                                           | Bouton                                                         | État                                                        |
| ------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------- |
| **J'ai acheté un bien analysé** | « On reprend tout de ton analyse : prêt, charges, loyer. »       | liste des projets (Offre faite en premier) → « Gérer ce bien » | masquée s'il n'y a aucun projet                             |
| **Connecter ma banque**         | « Déjà propriétaire ? On retrouve tes loyers dans tes comptes. » | « Choisir ma banque »                                          | badge « Recommandé » si aucun projet ; « Bientôt » avant G3 |
| **Ajouter à la main**           | « Une adresse, un loyer, un locataire. »                         | « Ajouter »                                                    | toujours là                                                 |

## Porte 1 : « J'ai acheté ce bien »

**Clic 1** : bouton dans l'en-tête d'un projet (à côté de Partager et PDF), ou « Gérer ce bien » sur la carte de l'accueil.

**Écran « Prêt à gérer »** (une page, pas une fenêtre modale) :

```
Prêt à gérer
T2 · 12 rue des Lices, Marseille 5e
Tout vient de ton analyse du 12 septembre. Touche une ligne pour la changer.

┌ Le bien ──────────────────────┐  ┌ La location ───────────────────────────┐
│ Appartement · 38 m² · DPE D    │  │ Meublée · 650 € + 50 € de charges       │
│                     [analyse]  │  │ Loyer le 5 du mois          [par défaut] │
└────────────────────────────────┘  │ Dépôt 1 300 € (2 mois)      [par défaut] │
┌ Le prêt ──────────────────────┐  │ Entrée le 1er octobre       [par défaut] │
│ 612 €/mois jusqu'en 2046       │  └────────────────────────────────────────┘
│                     [analyse]  │  ┌ Ton locataire ─────────────────────────┐
└────────────────────────────────┘  │ Prénom Nom      [Julie Martin        ] │
┌ Les charges ──────────────────┐  │ E-mail          [julie@exemple.fr    ] │
│ Taxe foncière 720 €/an         │  │ ☐ Pas encore loué                       │
│ Copropriété 90 €/mois          │  └────────────────────────────────────────┘
│ Assurance 12 €/mois  [analyse] │
└────────────────────────────────┘
                         Ensuite, on s'occupe des quittances.   [ C'est parti ]
```

- Les lignes « par défaut » sont en encre secondaire ; toucher une ligne ouvre l'édition **sur place** (pas de nouvel écran).
- « Ensuite, on s'occupe des quittances » : la seule phrase d'explication, à côté du bouton.
- **Clic 2** : « C'est parti » → écran de confirmation bref (animation du point qui passe au vert) → accueil avec le bien.

## Porte 2 : « Connecter ma banque » (G3)

1. **Clic 1** : « Choisir ma banque » → liste avec recherche et logos des banques les plus courantes en premier. Mention sous la liste : « Tu valides dans l'appli de ta banque. Deklic ne voit jamais tes identifiants et ne peut faire aucun virement. »
2. Retour de la banque → « On lit tes 13 derniers mois… » (barre de progression, 5 à 20 s).
3. **« On a trouvé 2 loyers, une APL et 4 dépenses. »**

```
Loyers                                                           ☑ tout
┌───────────────────────────────────────────────────────────────────────┐
│ ☑  MARTIN J.        700 € · vers le 5 · depuis oct. 2025               │
│    Adresse du bien  [ 12 rue des Lices, Marseille               ▾ ]    │
├───────────────────────────────────────────────────────────────────────┤
│ ☑  DUPONT A.        430 € · vers le 3 · depuis janv. 2026              │
│    Adresse du bien  [ Tape l'adresse…                              ]   │
├───────────────────────────────────────────────────────────────────────┤
│ ☑  CAF DES BOUCHES  180 € · le 5 · depuis janv. 2026  → APL de DUPONT A.│
└───────────────────────────────────────────────────────────────────────┘
Chaque ligne montre aussi 13 petites barres (un mois reçu = une barre pleine) : la preuve de la détection.
Dépenses
│ ☑  Prêt           612 €/mois        → [ T2 Lices ▾ ]                   │
│ ☑  Syndic         270 €/trimestre   → [ T2 Lices ▾ ]                   │
│ ☑  Taxe foncière  720 € en octobre  → [ T2 Lices ▾ ]                   │
│ ☐  Assurance      12 €/mois         → [ Choisir ▾  ]                   │

                                               [ Tout créer ]
```

- Tant qu'une adresse manque sur une carte cochée, le bouton dit « Encore 1 adresse » (inactif) : l'utilisateur sait exactement ce qui bloque.
- **Clic 2** : « Tout créer » → accueil avec « Ajoute l'e-mail de Julie et d'Antoine pour envoyer leurs quittances » (champ en ligne, sans ouvrir de fiche).

## Porte 3 : « Ajouter à la main »

Une carte, six champs, un bouton :

```
Ajouter un bien loué
Adresse           [ Tape l'adresse…                          ]
Location          ( Vide )  ( Meublée )
Loyer             [ 650 ] € hors charges   + [ 50 ] € de charges
Locataire         [ Prénom Nom        ]  [ E-mail              ]
Entrée            [ 01/10/2026 ]
▸ Plus de détails (surface, DPE, jour du loyer, APL, colocation)
                                                         [ Créer ]
```

## Accueil (régime de croisière)

```
Septembre
3 loyers sur 4 reçus
████████████████████░░░░░░  1 680 € sur 2 110 €

À faire
● Loyer d'Antoine : 430 € attendus depuis le 3   [ Relancer ]
● Réviser le loyer de Julie : 650 → 657,49 €     [ Voir ]
● Ta banque se reconnecte dans 12 jours          [ Reconnecter ]

Mes biens
T2 Lices          Julie Martin        700 €   ● Reçu le 5
Studio Baille     Antoine Dupont      430 €   ● En retard
Coloc Rouet       2 chambres sur 3    980 €   ● Reçu
Parking Prado     —                   —       ○ Vacant

Ce mois-ci          encaissé 1 680 €  ·  dépenses 1 012 €  ·  cash-flow +668 €
```

- **Le titre est une phrase** (« 3 loyers sur 4 reçus »), le chiffre en euros vient en second.
- « À faire » : **trois lignes au plus**, chacune avec un seul bouton ; au-delà, « et 2 autres ».
- Si tout est reçu : « Tout est reçu. Rien à faire ce mois-ci. » (état célébré sobrement : point vert, aucun confetti).
- Statuts toujours doublés d'un mot : jamais la couleur seule.

## Loyers

- Sélecteur de mois (‹ Septembre 2026 ›).
- Trois groupes dans cet ordre : **En retard**, **Attendus**, **Reçus**. Un groupe vide disparaît.
- Ligne : bien · locataire · montant · date due · statut · action principale (« Reçu » si attendu, « Quittance » si reçu, « Relancer » si en retard) · menu « … » (reçu en partie, autre date, renvoyer, annuler).
- Bandeau après « Reçu » : « Reçu · quittance envoyée à Julie » + « Annuler » (10 s).

## Fiche bien

En-tête : nom, adresse, pastille d'état, bouton « Voir l'analyse » (si issu d'un projet).

Contenu en cartes, dans l'ordre des questions :

1. **La location** : locataire(s), loyer, charges, prochaine échéance, accord e-mail ; actions « Modifier », « Julie part ».
2. **Les 12 derniers mois** : frise de 12 points (reçu, partiel, retard, vacant) ; clic sur un point = détail + quittance.
3. **Réel vs prévu** (G5) : « 38 €/mois de moins que prévu » + deux causes.
4. **À surveiller** (G4) : DPE, assurance, fin de bail.
5. **Infos du bien** (repliée) : surface, DPE, prêt, charges.

## Banque (G3)

- Connexions : banque, comptes, « valable jusqu'au 20 mars ».
- **À classer** : une opération à la fois en carte (« SYNDIC LES PINS · −270 € · 02/09 · C'est quoi ? ») avec pastilles ; après un classement, « Toujours classer ainsi ? Oui / Non ». Compteur « 4 à classer ».
- Pas de tableau de toutes les opérations par défaut (lien « Toutes les opérations » en bas).

## Argent (G5)

- Filtre période (mois, année) et bien.
- Une phrase en tête : « En 2026, tes biens t'ont rapporté 4 120 € après crédit. »
- Barres encaissé / dépenses par catégorie / crédit → cash-flow (même composant « Barres de flux » que le Rapport).
- Carte « Déclaration 2027 » visible d'avril à juin, repliée le reste de l'année.

## E-mails

Tous : expéditeur « Deklic pour {nom du bailleur} », réponse vers l'e-mail du bailleur, logo discret, texte court, un seul bouton.

| E-mail               | Destinataire | Objet                                       | Contenu et bouton                                                                                                |
| -------------------- | ------------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Accord               | Locataire    | « Vos quittances de loyer par e-mail »      | « {Bailleur} utilise Deklic pour vous envoyer vos quittances pour le logement {adresse}. » · **Oui, par e-mail** |
| Quittance            | Locataire    | « Votre quittance de loyer – octobre 2026 » | Montant, période ; PDF joint · pas de bouton                                                                     |
| Reçu                 | Locataire    | « Reçu de paiement – octobre 2026 »         | Montant reçu, reste dû ; PDF joint                                                                               |
| Loyer reçu ?         | Bailleur     | « 2 loyers à confirmer »                    | Une ligne par loyer : « Julie · 700 € · dû le 5 » · **Oui, en entier** / Pas encore                              |
| Relance              | Locataire    | « Loyer d'octobre : petit rappel »          | Montant, période, coordonnées du bailleur ; ton courtois, aucune pénalité                                        |
| Résumé mensuel       | Bailleur     | « Septembre : 3 loyers sur 4 reçus »        | Les chiffres de l'accueil + « À faire » · **Ouvrir Deklic**                                                      |
| Révision             | Locataire    | « Révision annuelle de votre loyer »        | Ancien et nouveau loyer, indice, date d'effet ; lettre PDF jointe                                                |
| Banque à reconnecter | Bailleur     | « Ta banque se déconnecte le 20 mars »      | **Reconnecter**                                                                                                  |

Les liens d'action mènent toujours à une **page de confirmation** Deklic avec un bouton (les antivirus de messagerie ouvrent les liens).

## Textes et ton

- Bailleur : **tutoiement**, phrases courtes, verbes d'action (« C'est parti », « Tout créer », « Relancer »).
- Locataire : **vouvoiement**, neutre, jamais culpabilisant.
- Nommer les choses comme le bailleur les connaît : « loyer », « quittance », « dépôt », « charges » ; jamais « échéance », « transaction », « rapprochement » à l'écran (termes internes).
- Montants toujours en euros avec espace fine insécable, centimes seulement quand ils existent (650 €, 657,49 €).
- Dates en toutes lettres courtes (« le 5 », « 1er octobre ») ; jamais de format ISO.

## États et cas limites

| Situation                         | Ce que l'écran fait                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------------------- |
| E-mail du locataire absent        | Ligne « Ajoute l'e-mail de Julie » avec champ en ligne sur l'accueil                               |
| Accord e-mail en attente          | Fiche location : « En attente de l'accord de Julie · Renvoyer la demande · Elle m'a déjà dit oui » |
| Identité du bailleur absente      | Demandée une fois, au moment de la première quittance                                              |
| Banque déconnectée                | Bandeau orange sur l'accueil ; « Loyer reçu ? » reprend le relais                                  |
| Aucun loyer ce mois (tout vacant) | « Aucun loyer attendu en septembre. » + action « Ajouter le locataire »                            |
| Erreur réseau                     | Le bouton reste, message « Pas de connexion. Rien n'a été enregistré. Réessaie. »                  |

## Accessibilité

Cibles de 44 px ; contraste AA ; statut = couleur + mot + forme du point (plein, creux, barré) ; focus visible ; la frise de 12 mois est aussi une liste lisible au lecteur d'écran ; animations coupées avec `prefers-reduced-motion`.

## Composants à réutiliser ou créer

- **Réutilisés** : coque et barre latérale, cartes, badge de provenance (nouvelles valeurs `analyse`, `banque`, `par défaut`), point de feu, barres de flux, champ d'adresse du formulaire Vérifier.
- **Nouveaux** : sélecteur de segments (Analyser · Gérer), carte porte, ligne de loyer avec action principale, frise de 12 mois, carte « À faire », carte d'opération à classer, bandeau d'annulation.
