# Specs : Mes biens et vie de la location (G1c)

**Discovery** : `.product/features/gerer-biens-discovery.md` · **Épic** : `.product/specs/gestion-locative-specs.md` (G1-5 APL, G1-8 modifier et supprimer) · **Base** : G1b `quittances-fiches` (PR #73)

Définition d'un clic (reprise de l'épic) : les boutons qui font avancer comptent ; les saisies ne comptent pas. Tutoiement pour le bailleur, vouvoiement sur les documents destinés au locataire. Tout nouvel élément cliquable prend une recette `survol-*` (`.product/design/design-guidelines.md`).

## Stories

| #    | Story                                                                  | Priorité | Effort |
| ---- | ---------------------------------------------------------------------- | -------- | ------ |
| US-1 | Montants d'une location par période (calcul pur)                       | P0       | M      |
| US-2 | API : modifier une location (migration 0005), état et export           | P0       | M      |
| US-3 | API : supprimer un bien                                                | P0       | S      |
| US-4 | Page « Mes biens » et entrée du menu                                   | P0       | M      |
| US-5 | Fiche du bien : « Modifier » une location, « Supprimer ce bien »       | P0       | M      |
| US-6 | APL versée au bailleur (calcul, API, saisie, loyer attendu, quittance) | P1       | M      |
| US-7 | « Mes locataires » : liste, nom et e-mail corrigés                     | P1       | S      |

MoSCoW : **Must** US-1 à US-5 · **Should** US-6, US-7 · **Won't (plus tard)** supprimer un locataire seul, archiver un bien, modifier l'adresse d'un bien ou les dates d'une location, partage du loyer entre colocataires, révision IRL (G4), e-mails (G2).

Dépendances : US-2 et US-6 s'appuient sur US-1 ; US-5 sur US-2 et US-3 ; US-4 et US-7 sont indépendantes (US-7 a sa route).

---

### US-1 : Montants d'une location par période (calcul pur)

En tant que bailleur, je veux corriger un loyer à partir d'un mois sans réécrire le passé.

```gherkin
Scénario : montants en vigueur
  Étant donné une location entrée le 1er septembre 2026, loyer 650 €, charges 50 €
  Et un changement « à partir d'octobre 2026 » : loyer 680 €, charges 50 €
  Alors le loyer dû de septembre vaut 700 € et celui d'octobre et des mois suivants 730 €

Scénario : plusieurs changements
  Étant donné des changements à partir d'octobre puis de janvier 2027
  Alors chaque mois prend le dernier changement dont le mois de départ est au plus ce mois-ci

Scénario : prorata inchangé
  Étant donné une entrée le 12 septembre et un changement à partir de septembre
  Alors septembre reprend les nouveaux montants au prorata comme en G1a

Scénario : premier mois modifiable
  Étant donné des paiements pour septembre et octobre (même partiels)
  Alors le premier mois modifiable est novembre ; septembre et octobre gardent leurs montants
  Étant donné aucun paiement
  Alors le premier mois modifiable est le mois d'entrée

Scénario : bornes
  Alors un changement avant le premier mois modifiable, après la sortie ou plus d'un an après aujourd'hui est refusé
  Et un changement au même mois qu'un autre le remplace
```

Règles : montants en centimes ; `montantsDuMois(location, periode)` est la seule lecture des montants (loyers dus, statuts, documents, écrans) ; jour du loyer, dépôt et libellé ne sont pas des périodes (ils valent pour toute la location).

---

### US-2 : API — modifier une location (migration 0005), état et export

En tant que bailleur, je veux enregistrer la correction d'une location depuis n'importe quel appareil.

```gherkin
Scénario : nouveau loyer à partir d'un mois
  Quand j'envoie PATCH /api/gestion/locations/:id { montants: { aPartirDe: "2026-10", loyerHorsCharges: 68000, charges: 5000 } }
  Alors la réponse est 200 avec la location et ses montants par période
  Et GET /etat rend octobre à 730 € et septembre à 700 €

Scénario : jour, dépôt, libellé
  Quand j'envoie PATCH /api/gestion/locations/:id { jourLoyer: 10, depot: 130000, libelle: "Chambre 3" }
  Alors la réponse est 200 et seuls ces champs changent
  Et un libellé qui fait chevaucher une autre location du bien au même libellé → 409 BIEN_OCCUPE

Scénario : mois déjà payé
  Étant donné un paiement pour octobre
  Quand j'envoie un changement à partir d'octobre
  Alors la réponse est 409 PERIODE_PAYEE et rien n'est écrit

Scénario : bornes et validation
  Alors un mois avant l'entrée ou après la sortie, ou plus d'un an à l'avance → 400 HORS_LOCATION
  Et un corps vide ou invalide → 400 ; la location d'un autre compte → 404

Scénario : documents figés
  Étant donné une quittance émise pour septembre
  Quand le loyer change à partir d'octobre, ou que le libellé change
  Alors GET /documents/:id rend le contenu d'origine

Scénario : migration
  Étant donné une base en 0004 avec des locations
  Quand 0005 est appliquée
  Alors chaque location a une première période au mois d'entrée avec ses montants actuels
```

---

### US-3 : API — supprimer un bien

En tant que bailleur, je veux retirer un bien vendu ou créé par erreur.

```gherkin
Scénario : suppression
  Quand j'envoie DELETE /api/gestion/biens/:id
  Alors la réponse est 204
  Et le bien, ses locations, leurs montants, colocataires, paiements et documents ont disparu de GET /etat et de l'export

Scénario : locataires
  Alors un locataire qui n'a plus aucune location est supprimé aussi
  Et un locataire qui loue encore un autre bien du compte reste

Scénario : autre compte
  Quand le bien appartient à un autre compte
  Alors la réponse est 404 et rien n'est supprimé

Scénario : projet d'origine
  Étant donné un bien créé par « J'ai acheté ce bien »
  Alors le projet d'analyse n'est pas touché (il reste « acheté »)
```

---

### US-4 : Page « Mes biens » et entrée du menu

En tant que bailleur, je veux voir tous mes biens d'un coup d'œil, loués ou non.

```gherkin
Scénario : un clic depuis le menu
  Quand je clique « Mes biens » dans la section Gérer du menu                                # clic 1
  Alors la page « Mes biens » s'ouvre, titrée « 4 biens »
  Et l'entrée du menu montre le nombre de biens

Scénario : une ligne par bien
  Alors chaque bien montre : nom (lien vers sa fiche), adresse, état en mot et en couleur (Loué, Vacant, Départ prévu, À venir), locataires en cours ou « Sans locataire », loyer mensuel en cours (somme des locations en cours, charges comprises)
  Et le loyer de ce mois quand il existe : « Reçu », « Partiel », « Attendu » ou « En retard »
  Et un bien loué à la chambre montre « 2 locations en cours »

Scénario : ordre
  Alors les biens sont triés par nom (ordre naturel : « Chambre 2 » avant « Chambre 10 »)

Scénario : vide et ajout
  Étant donné aucun bien
  Alors la page propose les portes de Gérer (« Ajouter un bien »)
  Et avec des biens, « Ajouter un bien » reste en haut de la page

Scénario : un vacant se loue
  Quand je clique un bien vacant
  Alors sa fiche s'ouvre (« Louer ce bien » y est à un clic, G1b)
```

---

### US-5 : Fiche du bien — « Modifier » une location, « Supprimer ce bien »

En tant que bailleur, je veux corriger une location ou retirer un bien depuis sa fiche.

```gherkin
Scénario : modifier en deux clics
  Étant donné la fiche d'un bien loué 650 € + 50 €
  Quand je clique « Modifier » sur la carte de la location                                  # clic 1
  Alors un formulaire reprend loyer, charges, jour du loyer, dépôt et libellé
  Et « À partir de » propose le premier mois modifiable (US-1), et les mois suivants jusqu'à un an
  Quand je remplace le loyer par 680 et clique « Enregistrer »                                 # clic 2
  Alors la carte montre 680 € et « depuis octobre 2026 », et les loyers d'octobre valent 730 €

Scénario : refus
  Quand le serveur répond PERIODE_PAYEE, BIEN_OCCUPE ou HORS_LOCATION
  Alors le message s'affiche dans le formulaire et la saisie reste

Scénario : tout déjà payé
  Étant donné une location terminée dont tous les mois sont payés
  Alors « Modifier » ne propose que le jour, le dépôt et le libellé, avec la phrase « Les loyers de cette location sont tous réglés. »

Scénario : supprimer, jamais par erreur
  Quand je clique « Supprimer ce bien » en bas de la fiche                                  # clic 1
  Alors un encadré explique ce qui disparaît (locations, paiements, quittances et reçus) et propose « Exporter mes données d'abord »
  Et « Supprimer définitivement » reste désactivé tant que je n'ai pas tapé le nom du bien
  Quand je tape « T2 Lices » et clique « Supprimer définitivement »                           # clic 2
  Alors je reviens sur « Mes biens » avec « T2 Lices a été supprimé. »

Scénario : annuler
  Quand je clique « Annuler » dans l'encadré
  Alors rien n'est supprimé et le nom saisi est effacé
```

---

### US-6 : APL versée au bailleur

En tant que bailleur qui reçoit l'aide au logement de mon locataire, je veux un loyer attendu et une quittance justes.

Sources : CCH art. D832-1 à D832-4 (versement au bailleur) ; CAF, « Rappel sur le tiers payant » (le bailleur déduit la part reçue du loyer) ; mention de la quittance d'après le guide du bailleur de la CAF, **à confirmer**.

```gherkin
Scénario : saisie
  Quand j'ajoute un bien, loue un bien ou modifie une location, « Plus de détails » propose « APL versée par la CAF (par mois) », vide par défaut
  Et une APL supérieure au loyer charges comprises est refusée (400, message sous le champ)

Scénario : loyer attendu
  Étant donné un loyer de 650 € + 50 € et une APL de 180 €
  Alors le loyer du mois vaut 700 €, dont 180 € d'APL et 520 € à payer par le locataire
  Et la ligne du loyer affiche « 520 € + 180 € d'APL »

Scénario : reçu en un clic
  Quand je clique « Reçu »
  Alors le mois entier est enregistré (700 €, part du locataire et APL) et passe « Reçu »
  Et « En partie » reste possible pour une somme inférieure

Scénario : quittance
  Alors la quittance porte loyer 650 €, charges 50 €, total 700 €, « dont aide au logement versée par la CAF : 180 € », « payé par le locataire : 520 € »
  Et une quittance d'une location sans APL est identique à celle de G1b

Scénario : changement d'APL
  Alors l'APL suit les périodes de US-1 : une nouvelle APL « à partir de » un mois non payé

Scénario : fin de location
  Étant donné une location avec APL
  Quand je termine la location
  Alors le formulaire rappelle « Pense à prévenir la CAF du départ de ton locataire. »
```

---

### US-7 : « Mes locataires » : liste, nom et e-mail corrigés

En tant que bailleur, je veux retrouver mes locataires et corriger leurs coordonnées.

```gherkin
Scénario : liste
  Quand je clique « Mes locataires » dans le menu                                              # clic 1
  Alors la page liste « En ce moment » (location en cours ou à venir) puis « Anciens locataires »
  Et chaque locataire montre : nom, e-mail ou « E-mail manquant », bien (et chambre) en lien vers la fiche, entrée et sortie

Scénario : corriger en deux clics
  Quand je clique « Modifier » sur un locataire                                               # clic 1
  Et corrige l'e-mail puis clique « Enregistrer »                                               # clic 2
  Alors PATCH /api/gestion/locataires/:id { prenom, nom, email } répond 200 et la ligne montre le nouvel e-mail
  Et un e-mail vide retire l'e-mail ; un e-mail invalide est refusé sous le champ

Scénario : documents figés
  Étant donné une quittance émise au nom de Julie Martin
  Quand je corrige le nom en Julie Martin-Roux
  Alors la quittance déjà émise garde « Julie Martin » ; les suivantes portent le nouveau nom

Scénario : autre compte
  Alors PATCH d'un locataire d'un autre compte → 404
```

## Contrats d'API (ajouts de G1c)

Toutes les routes sous `/api/gestion`, session exigée, `Origin` exigé pour les écritures (G1a), 404 pour une ressource d'un autre compte, corps ≤ 64 Ko.

| Méthode  | Chemin                               | Corps                                                                                                    | Réponses                                                                          |
| -------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `PATCH`  | `/locations/:id`                     | au moins un de `{ montants: { aPartirDe, loyerHorsCharges, charges, apl? }, jourLoyer, depot, libelle }` | 200 location ; 400 ; 400 HORS_LOCATION ; 404 ; 409 PERIODE_PAYEE, BIEN_OCCUPE     |
| `DELETE` | `/biens/:id`                         | —                                                                                                        | 204 ; 404                                                                         |
| `PATCH`  | `/locataires/:id`                    | `{ prenom, nom, email? }`                                                                                | 200 locataire ; 400 ; 404                                                         |
| `POST`   | `/locations`, `/biens/:id/locations` | + `location.apl?` (centimes, ≤ loyer + charges)                                                          | inchangées ; 400 si APL trop élevée                                               |
| `GET`    | `/etat`, `/export`                   | —                                                                                                        | chaque location porte `montants: [{ aPartirDe, loyerHorsCharges, charges, apl }]` |

## Modèle de données (migration `0005`)

| Table             | Colonnes                                                                                                                                               | Remarques                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `gestion_montant` | `locationId` (cascade), `userId` (cascade), `aPartirDe` (AAAA-MM), `loyerHorsCharges`, `charges`, `apl`, `modifieLe` ; clé (`locationId`, `aPartirDe`) | une ligne par période ; la migration reprend chaque location existante au mois d'entrée |

Le détail (garder ou non les colonnes de montants de `gestion_location`, ordre des suppressions) se tranche à l'architecture.

## Auto-revue (checkpoint validé par Claude, sur autorisation de Pierre)

- **« À partir de » un mois non payé** : un mois payé, même en partie, ne peut plus changer de dû (ADR-G11, somme ≤ dû) ; la règle est simple à dire et à tester, et couvre la correction d'une faute de saisie (aucun paiement : dès l'entrée) comme une hausse convenue.
- **Jour, dépôt et libellé hors périodes** : ils n'ont pas d'historique utile en G1c ; un jour du loyer modifié ne change que les statuts calculés, jamais un paiement ni un document.
- **APL dans le même « Reçu »** : un seul bouton comme en G1a ; le détail par payeur (la CAF paie à une autre date) attend la banque (G3), qui verra les deux virements.
- **Suppression confirmée par le nom** : l'épic (G1-8) le prévoit ; deux clics et une saisie, bouton rouge, export proposé (prescription de trois ans, art. 7-1).
- **Locataires orphelins supprimés avec le bien** : sinon « Mes locataires » garderait des personnes sans bien, contraire à la minimisation (G1-9).
- **Nombre de biens dans le menu** : l'UX de l'épic (« Biens · 4 ») ; la pastille rouge reste réservée aux retards de « Loyers du mois ».
- **US-6 et US-7 en P1** : détachables sans rien casser si la session s'allonge ; US-6 réutilise les périodes de US-1 (pas de seconde migration).
