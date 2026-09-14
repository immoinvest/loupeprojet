# Specs — Gérer : la gestion locative après l'achat

Discovery : `.product/features/gestion-locative-discovery.md` · UX : `.product/design/gestion-locative-ux.md` · Date : 2026-09-14 · **Documentation seule : rien n'est développé.**

Cinq features, une par session, dans l'ordre G1 → G5. Chaque feature repasse par `/architecture` avant d'être codée : les noms de modules, de routes et de tables ci-dessous sont des propositions, pas des décisions.

---

## 1. La règle des deux clics (critère d'acceptation transversal)

```gherkin
Règle : deux clics chez Deklic suffisent pour qu'une location fonctionne

Scénario : mesure
  Étant donné un utilisateur connecté sur l'accueil de Gérer
  Quand il suit une des trois portes jusqu'à « Location active »
  Alors le parcours compte au plus 2 activations de bouton ou de lien dans Deklic
  Et les saisies au clavier (e-mail, adresse) ne comptent pas comme des clics
  Et l'authentification dans l'application de la banque ne compte pas (elle se passe chez la banque)
  Et le test de bout en bout de chaque porte échoue si un clic de plus apparaît
```

**Ce qui compte comme un clic** : un bouton ou un lien qui fait avancer (ouvrir la porte, valider, créer). **Ce qui n'en est pas un** : remplir un champ, choisir dans une liste, cocher une case, corriger une valeur par défaut, et tout ce qui se passe hors de Deklic (authentification chez la banque, connexion Google). Le compte part de l'utilisateur **connecté** : sans compte, la connexion s'intercale une fois, puis le parcours reprend là où il en était.

Principes qui en découlent, applicables à toutes les stories :

1. **Une seule question par information inconnue.** Deklic ne demande que ce qu'il ne peut ni reprendre (analyse), ni lire (banque), ni déduire (règle par défaut).
2. **Jamais de case vide** : chaque valeur par défaut porte un badge de provenance : `analyse`, `banque`, `par défaut`, `à toi`.
3. **Proposer, pas imposer** : ce qui engage le bailleur vis-à-vis du locataire (révision, relance, restitution du dépôt) est préparé puis validé d'un clic, jamais envoyé sans accord, sauf la quittance d'un paiement complet constaté, qui est un droit du locataire.
4. **Rien d'irréversible sans confirmation** ; toute création se modifie ou s'annule ensuite.

---

## 2. Modèle de données (conceptuel)

Toutes les entités appartiennent à **un compte** (`compteId`) ; aucune requête ne lit ou n'écrit hors du compte de la session.

| Entité                  | Champs essentiels                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bailleur**            | nom affiché sur les quittances (personne ou SCI), adresse postale, e-mail de réponse                                                                                                                                                                                                                                                                                                      |
| **Bien**                | nom court, adresse (libellé, code postal, ville, code INSEE, coordonnées), type (`appartement`, `maison`, `studio`, `parking`), surface, pièces, meublé, DPE (classe, date), zone tendue (déduite), chambres (colocation), `projetId` et **instantané du projet d'analyse** au jour de l'achat (entrées + `version_regles`), prêt (capital, taux, durée, date de début, assurance)        |
| **Locataire**           | prénom, nom, e-mail (facultatif), téléphone (facultatif), accord pour les envois par e-mail (`en_attente`, `accorde`, `refuse`, `declare_par_bailleur`, date)                                                                                                                                                                                                                             |
| **Location**            | bien (et chambre), locataires, type (`nue`, `meublee`, `etudiant`, `mobilite`), début, fin prévue, jour du loyer (1 à 28), loyer hors charges, charges et mode (`provision`, `forfait`), APL versée au bailleur, dépôt (montant, encaissé le), révision (indice, trimestre et valeur de référence, active), statut (`active`, `preavis`, `terminee`), origine (`achat`, `banque`, `main`) |
| **Échéance**            | location, période (début, fin), dû (loyer, charges, APL déduite), statut (`a_venir`, `attendue`, `recue`, `partielle`, `en_retard`, `annulee`), paiements                                                                                                                                                                                                                                 |
| **Paiement**            | échéance, montant, date, source (`banque`, `confirmation`, `manuel`), opération bancaire liée                                                                                                                                                                                                                                                                                             |
| **Document émis**       | type (`quittance`, `recu`, `avis`, `relance`, `revision`, `restitution`, `regularisation`), numéro, **contenu figé** (noms, adresse, montants, période au moment de l'émission), émis le, envoi (destinataires, statut, date). Le PDF est rendu à la demande depuis le contenu figé : aucun fichier stocké                                                                                |
| **Dépense**             | bien (ou aucun), catégorie (`credit`, `taxe_fonciere`, `copropriete`, `assurance`, `travaux`, `entretien`, `gestion`, `autre`), montant, date, source, opération liée, récurrence                                                                                                                                                                                                         |
| **Connexion bancaire**  | fournisseur, banque, comptes suivis, consentement valable jusqu'au, état                                                                                                                                                                                                                                                                                                                  |
| **Opération bancaire**  | compte, date, montant signé, libellé, contrepartie normalisée, classement (`loyer`, `depense`, `ignoree`, `a_classer`) et cible                                                                                                                                                                                                                                                           |
| **Règle de classement** | motif (contrepartie ou mot du libellé, sens, fourchette de montant) → classement ; apprise quand l'utilisateur classe                                                                                                                                                                                                                                                                     |

Les « choses à faire » (retard, révision à valider, consentement qui expire, DPE à refaire) **ne sont pas stockées** : elles se déduisent des données à l'affichage, comme les résultats du moteur.

**Instantané du projet** : les résultats d'analyse ne sont jamais persistés (principe 5). Pour « réel vs prévu », Gérer garde une copie des **entrées** du projet et sa `version_regles` au jour de l'achat, et recalcule le prévu avec le moteur.

**Calculs purs** (paquet proposé `packages/gestion`, zéro I/O, Zod, 100 % de couverture) : générer les échéances, prorata, statut d'une échéance à une date, contenu d'une quittance ou d'un reçu, détection des récurrences bancaires, score de rapprochement, révision du loyer, dépôt et délais, préavis, régularisation des charges, montants de déclaration, écart réel/prévu.

---

## 3. Règles légales (versionnées, datées, à vérifier sur Légifrance à l'architecture)

Fichier proposé : `packages/gestion/src/regles/2026-09.ts`, même principe que les règles fiscales du moteur. Toute valeur non vérifiée sur la source primaire porte `aConfirmer: true` et s'affiche comme telle dans la Méthode.

| Règle                      | Contenu retenu                                                                                                                                                                                                                                             | Source à vérifier                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Quittance                  | Due gratuitement au locataire qui en fait la demande ; détail du loyer et des charges ; **paiement partiel = reçu**, pas quittance ; envoi dématérialisé avec l'**accord exprès** du locataire                                                             | Loi n° 89-462 du 6 juillet 1989, art. 21            |
| Mentions de la quittance   | Bailleur, locataire, adresse du logement, période, date, montant total et détail loyer / charges (et APL déduite le cas échéant)                                                                                                                           | Art. 21 ; pratique courante                         |
| Frais d'envoi              | Aucun frais de quittance ni d'avis d'échéance à la charge du locataire                                                                                                                                                                                     | Art. 21                                             |
| Pénalités de retard        | Clause réputée non écrite : **aucun champ « frais de retard »**                                                                                                                                                                                            | Art. 4                                              |
| Avis d'échéance            | Facultatif ; gratuit                                                                                                                                                                                                                                       | —                                                   |
| Révision annuelle          | Seulement si le bail la prévoit ; indice IRL du trimestre de référence ; nouveau loyer = loyer × IRL nouveau ÷ IRL de référence, arrondi au centime ; prend effet **à la demande**, sans rétroactivité ; demande dans l'année qui suit la date de révision | Art. 17-1 ; IRL publié par l'INSEE                  |
| Gel des logements F et G   | Aucune hausse (révision, relocation, renouvellement) pour un logement classé F ou G : baux conclus, renouvelés ou reconduits depuis le 24/08/2022 en métropole ; date propre à l'outre-mer                                                                 | Loi n° 2021-1104 « Climat et résilience », art. 159 |
| Décence énergétique        | Classe G : plus de nouveau bail ni de renouvellement depuis le 01/01/2025 ; F à partir du 01/01/2028 ; E à partir du 01/01/2034 (métropole)                                                                                                                | Loi Climat et résilience ; décret décence           |
| Validité du DPE            | 10 ans ; DPE réalisés du 01/01/2013 au 31/12/2017 invalides depuis le 01/01/2023 ; du 01/01/2018 au 30/06/2021 invalides depuis le 01/01/2025                                                                                                              | Code de la construction et de l'habitation          |
| Dépôt de garantie          | Nue : 1 mois de loyer hors charges au plus ; meublée : 2 mois ; bail mobilité : aucun dépôt. Restitution : 1 mois si l'état des lieux de sortie est conforme, 2 mois sinon ; majoration de 10 % du loyer mensuel hors charges par mois de retard commencé  | Art. 22, art. 25-6, titre I ter                     |
| Préavis du locataire       | Nue : 3 mois, 1 mois en zone tendue (et cas listés) ; meublée : 1 mois ; bail mobilité : 1 mois                                                                                                                                                            | Art. 15, art. 25-8, titre I ter                     |
| Régularisation des charges | Annuelle ; décompte par nature de charges un mois avant ; pièces tenues à disposition 6 mois ; seulement en mode `provision` (le forfait ne se régularise pas)                                                                                             | Art. 23                                             |
| Durées de bail             | Nue : 3 ans (bailleur personne physique) ; meublée : 1 an ; étudiant : 9 mois ; mobilité : 1 à 10 mois                                                                                                                                                     | Art. 10, art. 25-7, titre I ter                     |
| Prorata du premier mois    | Loyer × jours occupés ÷ jours du mois (convention affichée, modifiable)                                                                                                                                                                                    | Usage ; à documenter dans la Méthode                |

---

## 4. Épics et stories

| Feature                | Épic                                  | Stories     |
| ---------------------- | ------------------------------------- | ----------- |
| G1 `gerer-socle`       | Biens, locataires, locations, loyers  | G1-1 à G1-9 |
| G2 `quittances-auto`   | Envois automatiques                   | G2-1 à G2-7 |
| G3 `banque`            | Connexion bancaire et rapprochement   | G3-1 à G3-6 |
| G4 `vie-du-bail`       | Révision, fin de bail, dépôt, charges | G4-1 à G4-6 |
| G5 `bilan-declaration` | Argent, réel vs prévu, déclaration    | G5-1 à G5-5 |

Priorités : **P0** = sans elle la feature n'a pas de sens ; **P1** = attendue dans la feature ; **P2** = si le temps le permet.

---

### G1 — `gerer-socle`

#### G1-1 : Les sections Analyser et Gérer du menu

En tant que bailleur, je veux voir mes projets à étudier et mes biens loués dans le même menu, chacun dans sa section, et pouvoir masquer celle qui ne me sert pas.

Décision de Pierre (14/09/2026) : deux sections dans un seul menu, pas de sélecteur ; option dans Mon compte pour en masquer une.

P0 · Effort M

```gherkin
Scénario : deux sections
  Étant donné la barre latérale
  Alors elle montre la section « Analyser » (Nouveau projet, les 5 projets les plus récents, « Tous mes projets · N » au-delà de 5, Comparer)
  Puis la section « Gérer » (Ajouter un bien, Accueil, Loyers, Biens, Locataires, Argent ; Banque à partir de G3)
  Puis l'aide, l'installation et le profil, comme aujourd'hui
  Et le grand bouton « Nouveau projet » disparaît : chaque section commence par son action de création
  Et Loyers porte une pastille avec le nombre de loyers en retard ou à confirmer
  Et sous 1 024 px, le tiroir existant montre les mêmes sections (aucune barre d'onglets en bas)

Scénario : masquer une section depuis Mon compte
  Étant donné la carte « Mon menu » de la page Mon compte (interrupteurs Analyser et Gérer, les deux actifs par défaut)
  Quand je désactive « Analyser »
  Alors la section Analyser disparaît du menu, ainsi que « J'ai acheté ce bien » dans les projets et « Analyser ce bien » dans les fiches bien
  Et le logo mène à la première section affichée
  Et le réglage est enregistré avec mon compte (même menu sur tous mes appareils) ; sans compte, sur l'appareil
  Quand une seule section reste affichée
  Alors son interrupteur est inactif : impossible de masquer les deux

Scénario : page d'une section masquée
  Étant donné la section Gérer masquée
  Quand j'ouvre /gerer par un lien direct
  Alors la page s'affiche avec un bandeau « Cette section est masquée dans ton menu · L'afficher »
  Et « L'afficher » réactive la section sans passer par Mon compte

Scénario : Gérer sans compte
  Étant donné que je ne suis pas connecté
  Alors la section Gérer se réduit à « Gérer mes biens loués »
  Quand je l'ouvre
  Alors je vois une page courte : ce que Gérer fait, pourquoi un compte est nécessaire (« tes quittances partent même quand ton ordinateur est éteint ») et « Se connecter »
  Et après la connexion je reviens sur l'accueil de Gérer
  Et l'analyse reste accessible sans compte

Scénario : premier accès connecté
  Étant donné un compte sans aucun bien géré
  Quand j'ouvre /gerer
  Alors je vois les trois portes : « J'ai acheté un bien analysé », « Connecter ma banque », « Ajouter à la main »
  Et la porte « J'ai acheté » liste mes projets en statut « Offre faite » en premier
  Et la porte banque est marquée « Bientôt » tant que G3 n'est pas livrée
```

#### G1-2 : Porte « J'ai acheté ce bien »

En tant que Camille, je veux transformer mon analyse en bien géré, pour ne rien ressaisir.

P0 · Effort M

```gherkin
Scénario : deux clics depuis un projet
  Étant donné un projet analysé avec une adresse précise, un loyer, des charges, un prêt et un régime retenu
  Quand je clique « J'ai acheté ce bien » (en-tête du projet ou porte de l'accueil)          # clic 1
  Alors l'écran « Prêt à gérer » affiche quatre blocs repris de l'analyse, avec badges :
    | Le bien      | adresse, type, surface, DPE                              | analyse    |
    | Le prêt      | mensualité, fin du prêt                                   | analyse    |
    | Les charges  | taxe foncière, copropriété, assurance                     | analyse    |
    | La location  | loyer, charges, dépôt, jour du loyer, entrée du locataire | analyse / par défaut |
  Et une seule ligne à remplir : « Ton locataire » (prénom, nom, e-mail)
  Et deux boutons : « C'est parti » et « Pas encore loué »
  Quand je saisis « Julie Martin, julie@exemple.fr » et clique « C'est parti »                # clic 2
  Alors le bien, le locataire et la location sont créés, statut « Location active »
  Et les échéances jusqu'à la fin du mois suivant sont générées
  Et le projet d'analyse passe en statut « Acheté » et pointe vers le bien géré
  Et l'instantané des entrées du projet est enregistré avec sa version de règles

Scénario : pas encore loué
  Quand je clique « Pas encore loué » (second bouton, sans case à cocher : un clic, pas deux)   # clic 2
  Alors le bien est créé « Vacant », sans échéance ni locataire
  Et l'accueil propose « Ajouter le locataire » sur ce bien

Scénario : valeurs par défaut
  Étant donné une analyse en meublé à 650 € hors charges
  Alors le dépôt proposé est 1 300 € (2 mois, badge « par défaut »)
  Et le jour du loyer est le 5, l'entrée le 1er du mois suivant, la révision IRL active au trimestre du dernier indice publié
  Et chaque valeur se modifie d'un clic sur la ligne sans quitter l'écran (ce clic est facultatif)

Scénario : analyse incomplète
  Étant donné un projet sans adresse précise
  Alors le bloc « Le bien » demande l'adresse (saisie assistée) avant d'activer « C'est parti »
```

Correspondance analyse → gestion (noms exacts du schéma `Projet` à fixer à l'architecture) :

| Analyse                                                   | Gérer                                       |
| --------------------------------------------------------- | ------------------------------------------- |
| Adresse enregistrée du projet, type, surface, pièces, DPE | Bien                                        |
| Mode meublé / nu                                          | Type de location (`meublee` / `nue`)        |
| Loyer hors charges, charges locataire                     | Loyer, charges (`provision`)                |
| Montant emprunté, taux, durée, assurance                  | Prêt et dépense mensuelle « crédit » prévue |
| Taxe foncière, copropriété, PNO, comptable, CFE           | Dépenses prévues (annuelles)                |
| Régime fiscal retenu                                      | Régime proposé dans la déclaration (G5)     |
| Projet complet + `version_regles`                         | Instantané pour « réel vs prévu » (G5)      |

#### G1-3 : Porte « Ajouter à la main »

En tant que bailleur sans analyse, je veux créer une location sur un seul écran.

P0 · Effort S

```gherkin
Scénario : un écran, un bouton
  Quand je clique « Ajouter à la main »                                                      # clic 1
  Alors un seul écran demande : adresse (saisie assistée), meublé ou vide, loyer hors charges, charges, locataire (prénom, nom, e-mail), date d'entrée
  Quand je remplis et clique « Créer »                                                        # clic 2
  Alors bien, locataire et location sont créés avec les défauts : dépôt légal maximal, jour 5, révision IRL, type de bien « appartement »
  Et « Plus de détails » (replié) permet de préciser surface, DPE, jour du loyer, APL, colocation

Scénario : validation
  Quand le loyer est vide, négatif ou supérieur à 100 000 €, ou l'e-mail est mal formé
  Alors le champ dit quoi corriger et « Créer » reste inactif
  Et un e-mail vide est accepté (aucun envoi ne partira, le bien affiche « Ajouter l'e-mail pour envoyer les quittances »)
```

#### G1-4 : Ajouter un locataire à un bien, colocation

En tant que bailleur, je veux louer un bien vacant ou gérer une colocation.

P1 · Effort M

```gherkin
Scénario : louer un bien vacant
  Étant donné un bien « Vacant »
  Quand je clique « Ajouter le locataire »
  Alors le même mini-formulaire que la porte « à la main » apparaît, adresse et loyer déjà remplis

Scénario : colocation à bail unique
  Quand j'ajoute deux locataires à la même location
  Alors une seule échéance mensuelle est générée pour le loyer total
  Et la quittance est émise au nom des deux quand le total est reçu, quel que soit le payeur

Scénario : colocation par chambre
  Quand je déclare trois chambres et une location par chambre
  Alors chaque chambre a sa location, ses échéances et ses quittances
  Et l'accueil montre le bien comme un seul bien « 2 chambres louées sur 3 »
```

#### G1-5 : Échéances (calcul pur)

En tant que bailleur, je veux que les loyers dus apparaissent tout seuls chaque mois.

P0 · Effort M

```gherkin
Scénario : génération mensuelle
  Étant donné une location active du 1er octobre 2026, loyer 650 €, charges 50 €, jour 5, terme à échoir
  Alors l'échéance d'octobre couvre 01/10–31/10, due le 05/10, 700 €
  Et une nouvelle échéance est générée chaque mois tant que la location est active

Scénario : prorata
  Étant donné une entrée le 12 octobre 2026
  Alors l'échéance d'octobre vaut 700 × 20 ÷ 31 = 451,61 € (arrondi au centime, détail loyer et charges proratisés séparément)

Scénario : APL versée au bailleur
  Étant donné une APL de 180 € versée au bailleur
  Alors l'échéance attend 520 € du locataire et 180 € de la CAF, et la quittance mentionne les deux

Scénario : statuts
  Étant donné l'échéance due le 05/10
  Alors elle est « À venir » avant le 01/10, « Attendue » du 01/10 au 09/10, « En retard » à partir du 10/10 sans paiement complet
  Et « Partielle » si un paiement couvre moins que le dû, « Reçue » quand le total est couvert

Scénario : fin de location
  Étant donné une sortie le 14 mars
  Alors la dernière échéance est proratisée au 14 mars et aucune n'est générée ensuite
```

#### G1-6 : Accueil et loyers du mois

En tant que bailleur, je veux voir en une seconde qui a payé.

P0 · Effort M

```gherkin
Scénario : accueil
  Étant donné 4 échéances en septembre dont 3 reçues
  Alors l'accueil titre « Septembre : 3 loyers sur 4 reçus » avec une barre de progression en euros
  Et « À faire » liste au plus 3 actions, la plus urgente d'abord (retard, e-mail manquant…)
  Et chaque bien apparaît sur une ligne avec un point d'état (reçu, attendu, en retard, vacant)

Scénario : marquer reçu en un clic
  Étant donné une échéance « Attendue » de 700 €
  Quand je clique « Reçu »
  Alors un paiement de 700 € daté d'aujourd'hui (source « manuel ») est enregistré, l'échéance passe « Reçue »
  Et un bandeau « Reçu · quittance prête » propose « Annuler » pendant 10 secondes

Scénario : paiement partiel ou autre date
  Quand j'ouvre le menu « … » de l'échéance et choisis « Reçu en partie »
  Alors je saisis le montant et la date ; l'échéance passe « Partielle » et un reçu (pas une quittance) est prêt

Scénario : loyers d'un autre mois
  Quand je change de mois dans Loyers
  Alors je vois les échéances de ce mois groupées : En retard, Attendus, Reçus
```

#### G1-7 : Quittance et reçu en PDF

En tant que bailleur, je veux une quittance conforme sans rien régler.

P0 · Effort M

```gherkin
Scénario : quittance
  Étant donné une échéance reçue en totalité
  Quand je clique « Quittance »
  Alors un PDF A4 contient : bailleur (nom, adresse), locataire(s), adresse du logement, période, date d'émission, loyer, charges, APL déduite, total, mention « pour acquit »
  Et un numéro unique par bail (année-mois-locationcourte)
  Et le contenu est figé : modifier ensuite le loyer ne change pas une quittance émise

Scénario : reçu
  Étant donné une échéance « Partielle »
  Alors le document s'intitule « Reçu », indique le montant reçu, la date et le reste dû, et ne porte pas « pour acquit »

Scénario : pas de quittance sans paiement
  Étant donné une échéance « Attendue »
  Alors aucune quittance ne peut être émise (bouton absent)

Scénario : identité du bailleur manquante
  Étant donné un compte sans nom ni adresse de bailleur
  Quand je demande la première quittance
  Alors on me demande ces deux informations une seule fois, puis le PDF s'ouvre
```

#### G1-8 : Fiches bien, locataire, location

En tant que bailleur, je veux corriger une information ou terminer une location.

P1 · Effort M

```gherkin
Scénario : fiche bien
  Alors elle montre l'adresse, le statut, la location en cours, les 12 dernières échéances en frise, et « Voir l'analyse » si le bien vient d'un projet

Scénario : modifier
  Quand je modifie le loyer d'une location
  Alors les échéances futures non payées sont recalculées ; les échéances payées et documents émis ne changent pas

Scénario : terminer et archiver
  Quand je clique « Terminer la location » et donne la date de sortie
  Alors la location passe « Terminée », la dernière échéance est proratisée, le bien redevient « Vacant »

Scénario : supprimer
  Quand je supprime un bien
  Alors je dois taper son nom pour confirmer ; ses locations, échéances et documents sont supprimés
```

#### G1-9 : Données, sécurité et vie privée

En tant que bailleur, je veux être sûr que les données de mes locataires sont protégées.

P0 · Effort M

```gherkin
Scénario : isolement des comptes
  Étant donné deux comptes A et B
  Quand A demande un bien, un locataire, une échéance ou un document de B par son identifiant
  Alors la réponse est 404 (jamais 403 qui confirmerait l'existence) et rien n'est modifié

Scénario : minimisation
  Alors aucun champ ne demande pièce d'identité, date ou lieu de naissance, nationalité, revenus ou numéro fiscal du locataire

Scénario : export et suppression
  Quand je clique « Exporter mes données de gestion »
  Alors je reçois un fichier JSON de tous mes biens, locataires, locations, échéances, paiements et documents
  Quand je supprime mon compte
  Alors l'export m'est proposé d'abord (les quittances émises sont des pièces à conserver)
  Et toutes mes données de gestion sont supprimées

Scénario : journaux
  Alors aucun journal ne contient de nom, d'e-mail, d'adresse ni de montant rattaché à une personne
```

---

### G2 — `quittances-auto`

Prérequis : domaine d'envoi vérifié (Resend) ; tâche planifiée quotidienne (hébergement à trancher à l'architecture).

#### G2-1 : Accord du locataire, sans clic pour le bailleur

P0 · Effort S

```gherkin
Scénario : premier e-mail au locataire
  Étant donné une location créée avec l'e-mail du locataire
  Alors le locataire reçoit « Vos quittances de loyer par e-mail » (vouvoiement, nom du bailleur, adresse du logement)
  Et un bouton « Oui, recevoir mes quittances par e-mail » ouvre une page de confirmation avec un bouton
  Quand il confirme
  Alors l'accord est enregistré (« accorde », date) et le bailleur n'a rien eu à faire

Scénario : le bailleur a déjà l'accord
  Quand le bailleur coche « Mon locataire m'a déjà donné son accord » sur la fiche location
  Alors l'accord passe « declare_par_bailleur » avec la date

Scénario : pas d'accord
  Étant donné un accord « en_attente » ou « refuse »
  Alors aucune quittance n'est envoyée par e-mail ; elles restent téléchargeables et l'accueil le signale une seule fois
```

#### G2-2 : Quittance envoyée au paiement complet

P0 · Effort M

```gherkin
Scénario : envoi
  Étant donné un accord valide et une échéance qui passe « Reçue » (clic, confirmation par e-mail ou banque)
  Alors le locataire reçoit dans l'heure « Votre quittance de loyer – octobre 2026 » avec le PDF en pièce jointe
  Et la fiche location affiche « Envoyée le 06/10 à julie@… »

Scénario : échec d'envoi
  Quand le fournisseur refuse l'e-mail (adresse invalide, rebond)
  Alors l'envoi est réessayé une fois, puis l'accueil affiche « E-mail de Julie à vérifier »

Scénario : renvoyer
  Quand je clique « Renvoyer » sur une quittance
  Alors le même document (même numéro, même contenu) est renvoyé

Scénario : quota
  Étant donné la limite quotidienne du fournisseur d'e-mails
  Alors les envois sont étalés sans perdre de quittance, la quittance restant datée du paiement
```

#### G2-3 : « Loyer reçu ? » (sans banque)

P0 · Effort M

```gherkin
Scénario : question au bailleur
  Étant donné une échéance « Attendue » due le 05/10 et aucune banque connectée
  Quand arrive le 07/10
  Alors le bailleur reçoit un seul e-mail regroupant ses loyers attendus : « Loyer de Julie (700 €) reçu ? » avec « Oui, en entier » et « Pas encore »

Scénario : réponse en un clic
  Quand il clique « Oui, en entier »
  Alors une page Deklic affiche le résumé et un bouton « Confirmer » (protège des antivirus qui ouvrent les liens)
  Quand il confirme
  Alors le paiement est enregistré (source « confirmation ») et la quittance part (G2-2)

Scénario : sécurité du lien
  Alors le lien contient un jeton signé, lié à l'échéance et au compte, valable 14 jours, à usage unique
  Et un jeton expiré, réutilisé ou modifié mène à « Ce lien n'est plus valable » avec un lien vers Loyers

Scénario : pas encore
  Quand il clique « Pas encore »
  Alors la question revient le 12/10 ; l'échéance passera « En retard » selon G1-5
```

#### G2-4 : Relance douce

P1 · Effort S

```gherkin
Scénario : proposée, pas imposée
  Étant donné une échéance « En retard »
  Alors l'accueil propose « Relancer Julie » avec un message courtois prêt (montant, période, coordonnées du bailleur, aucune pénalité)
  Quand je clique « Envoyer la relance »
  Alors l'e-mail part et la fiche location le trace

Scénario : relances automatiques (option)
  Quand j'active « Relancer automatiquement » dans les réglages
  Alors une relance part à J+5 et J+15 après la date due, puis plus rien : la suite revient au bailleur
```

#### G2-5 : Avis d'échéance (option)

P2 · Effort S

```gherkin
Scénario : désactivé par défaut
  Quand j'active « Envoyer un avis d'échéance » sur une location
  Alors le locataire reçoit 5 jours avant la date due l'avis avec montant et période
```

#### G2-6 : Résumé mensuel au bailleur

P1 · Effort S

```gherkin
Scénario : un e-mail par mois
  Étant donné le 11 de chaque mois
  Alors le bailleur reçoit : loyers reçus / attendus, quittances envoyées, retards, les 3 actions à faire
  Et il peut le désactiver d'un lien
```

#### G2-7 : Réglages d'envoi

P2 · Effort S

```gherkin
Scénario : copie
  Quand j'active « Me mettre en copie » ou ajoute un e-mail secondaire (comptable)
  Alors les quittances sont envoyées aussi à ces adresses
```

---

### G3 — `banque`

Décision de Pierre (14/09/2026) : comme Rentila, la connexion passe par les **API bancaires** (DSP2, lecture des comptes) pour détecter le virement du loyer ; c'est le cœur de Gérer et la feature suivante après `gerer-socle`. Prérequis : ADR « fournisseur bancaire » au début de G3 (recommandation : Enable Banking, gratuit en « production restreinte » sur les propres comptes de Pierre pour développer et tester ; contrat au volume avant l'ouverture au public). G3-5 (import de fichier) reste un repli.

#### G3-1 : Connecter une banque

P0 · Effort M

```gherkin
Scénario : connexion
  Quand je clique « Connecter ma banque » et choisis ma banque dans la liste (recherche, logos)          # clic 1
  Alors je suis redirigé vers ma banque pour valider (authentification forte, hors Deklic)
  Et au retour Deklic lit tous les comptes autorisés, sans étape de choix (un compte se retire ensuite depuis la page Banque)
  Et Deklic affiche « On lit tes 13 derniers mois… » puis le résultat (G3-2)
  Et le jour du loyer d'une location créée depuis la banque est le jour observé des virements, pas le 5 par défaut

Scénario : consentement qui expire
  Étant donné un consentement valable jusqu'au 20/03
  Alors l'accueil affiche « Reconnecter ta banque » dès le 06/03 et un e-mail part le 06/03
  Et après expiration, les loyers repassent par « Loyer reçu ? » (G2-3) sans perte

Scénario : déconnecter
  Quand je déconnecte une banque
  Alors l'accès est révoqué chez le fournisseur et les opérations importées sont supprimées ; les paiements déjà rapprochés restent
```

#### G3-2 : Porte « Connecter ma banque » : loyers et dépenses trouvés

P0 · Effort L

```gherkin
Scénario : détection des loyers
  Étant donné 13 mois d'opérations
  Alors un loyer est proposé pour chaque contrepartie qui verse au moins 3 mois sur les 4 derniers, à ±5 jours du même jour et ±5 % du même montant
  Et chaque carte montre : « Virement de M. ou Mme MARTIN J. · 700 € · vers le 5 · depuis mars 2025 »
  Et les versements de la CAF sont reconnus et proposés comme APL rattachables à un loyer

Scénario : dépenses récurrentes
  Alors sont proposés : échéance de prêt (même montant chaque mois, libellé de prêt), taxe foncière (prélèvement ou paiement DGFIP), syndic de copropriété (trimestriel), assurance
  Et chacune se rattache à un bien d'un menu

Scénario : deux clics
  Quand je donne l'adresse de chaque loyer (saisie assistée, biens existants et projets proposés en premier) et clique « Tout créer »   # clic 2
  Alors biens, locataires (nom tiré de la contrepartie, e-mail vide), locations (loyer = montant, charges 0 € badge « à toi »), échéances des 13 mois marquées reçues et dépenses sont créés
  Et l'accueil liste « Ajoute l'e-mail de tes locataires pour envoyer les quittances » (une ligne par locataire)

Scénario : rien d'inventé
  Étant donné un versement irrégulier ou en plusieurs fois
  Alors il n'est pas proposé comme loyer mais apparaît dans « À classer »
  Et une carte peut être décochée pour ne rien créer
```

#### G3-3 : Rapprochement continu

P0 · Effort M

```gherkin
Scénario : sûr
  Étant donné une nouvelle opération au crédit de la contrepartie connue d'une location, du montant exact attendu, entre J-10 et J+25 de la date due
  Alors le paiement est enregistré (source « banque »), l'échéance passe « Reçue » et la quittance part (G2-2)

Scénario : probable
  Étant donné un montant différent ou une contrepartie inconnue mais un montant exact
  Alors l'opération est proposée « C'est le loyer de Julie ? » avec « Oui » / « Non », rien n'est enregistré sans réponse

Scénario : paiement en deux fois ou groupé
  Étant donné deux virements de 350 € la même semaine de la même contrepartie
  Alors ils sont proposés ensemble pour l'échéance de 700 €
  Étant donné un virement de 1 400 € d'un colocataire pour deux chambres
  Alors il est proposé pour les deux échéances

Scénario : fréquence
  Alors les opérations sont relues au moins une fois par jour
```

#### G3-4 : Classer les opérations, règles apprises

P1 · Effort M

```gherkin
Scénario : « C'est quoi ? »
  Étant donné des opérations « À classer »
  Alors chacune propose des pastilles : Loyer de…, Prêt, Taxe foncière, Copropriété, Assurance, Travaux, Autre dépense du bien, Personnel (ignorer)
  Quand je classe « SYNDIC LES PINS » en Copropriété du T2 Lices
  Alors Deklic propose « Toujours classer ainsi ? » et crée la règle sur « Oui »

Scénario : personnel ignoré
  Alors les opérations classées « Personnel » ne sont ni affichées ailleurs ni conservées au-delà de la purge
```

#### G3-5 : Import de fichier (repli gratuit)

P1 · Effort M

```gherkin
Scénario : fichier OFX ou CSV
  Quand je dépose le relevé exporté de ma banque
  Alors les opérations sont lues localement dans le navigateur puis envoyées sous forme structurée (jamais le fichier)
  Et la même détection (G3-2) et le même rapprochement (G3-3) s'appliquent
  Et un CSV aux colonnes inconnues demande une seule fois quelle colonne est la date, le montant, le libellé

Scénario : doublons
  Quand je réimporte une période déjà importée
  Alors aucune opération n'est dupliquée (empreinte date + montant + libellé + compte)
```

#### G3-6 : Conservation des données bancaires

P0 · Effort S

```gherkin
Scénario : purge
  Alors les opérations de plus de 13 mois sont supprimées ; les paiements et dépenses rapprochés restent
  Et les jetons d'accès du fournisseur sont chiffrés au repos et jamais renvoyés au navigateur
```

---

### G4 — `vie-du-bail`

#### G4-1 : Révision annuelle du loyer

P0 · Effort M

```gherkin
Scénario : proposée un mois avant
  Étant donné une location nue, révision active, trimestre de référence T2, IRL de référence 146,68, loyer 650 €, DPE D, date anniversaire 01/10/2026
  Quand arrive le 01/09/2026
  Alors l'accueil propose « Réviser le loyer de Julie : 650 € → 657,49 € (+1,15 %) » avec l'indice T2 2026 = 148,37 et sa source INSEE
  Quand je clique « Appliquer et prévenir Julie »
  Alors une lettre de révision est envoyée (ou téléchargeable sans accord e-mail) et les échéances à partir de la demande utilisent le nouveau loyer

Scénario : pas de rétroactivité
  Étant donné une révision proposée le 01/09 et appliquée le 15/11
  Alors le nouveau loyer s'applique aux échéances postérieures au 15/11, jamais à octobre ou novembre déjà dus

Scénario : gel F et G
  Étant donné un bien classé F ou G
  Alors aucune hausse n'est proposée ; la carte explique « Loyer gelé : logement classé F » avec la règle datée

Scénario : indice pas encore publié
  Alors la proposition attend la publication INSEE et le dit
```

#### G4-2 : Fin de location et préavis

P1 · Effort M

```gherkin
Scénario : le locataire donne congé
  Quand je clique « Julie part » et saisis la date de réception du congé
  Alors Deklic calcule la date de fin selon le type et la zone (3 mois nue, 1 mois en zone tendue, 1 mois meublée), modifiable
  Et la location passe « Préavis » puis « Terminée » à la date de fin, dernière échéance proratisée
```

#### G4-3 : Dépôt de garantie

P1 · Effort M

```gherkin
Scénario : restitution
  Étant donné une location terminée le 31/03, dépôt 650 €
  Quand je choisis « État des lieux conforme » et « Rendre 650 € »
  Alors la date limite est le 30/04 (1 mois), rappelée à J-7
  Quand je choisis « Retenues » avec 120 € de travaux justifiés
  Alors la date limite est le 31/05 (2 mois) et un décompte est prêt à envoyer
  Et au-delà de la date limite, la majoration de 10 % du loyer hors charges par mois commencé est affichée

Scénario : dépôt au-dessus du maximum
  Étant donné une location nue à 650 € et un dépôt saisi de 1 300 €
  Alors la saisie est refusée avec « 650 € au plus en location vide »
```

#### G4-4 : Régularisation annuelle des charges

P2 · Effort M

```gherkin
Scénario : provisions contre dépenses réelles
  Étant donné des provisions de 50 €/mois sur 12 mois et 540 € de charges récupérables saisies ou importées
  Alors Deklic propose un remboursement de 60 € (ou un complément si les charges dépassent) avec le décompte par nature
  Quand je valide
  Alors une échéance de régularisation (positive ou négative) est créée et le décompte envoyé
  Et le mode « forfait » ne propose jamais de régularisation
```

#### G4-5 : Alertes de conformité

P1 · Effort S

```gherkin
Scénario : DPE
  Étant donné un bien classé G
  Alors la fiche affiche « Relocation interdite depuis le 01/01/2025 » avant toute nouvelle location
  Étant donné un DPE réalisé en 2016
  Alors « DPE plus valable depuis le 01/01/2023 »

Scénario : fin de bail court
  Étant donné un bail mobilité ou étudiant
  Alors l'accueil prévient un mois avant la fin prévue
```

#### G4-6 : Changement de colocataire

P2 · Effort S

```gherkin
Scénario : départ d'un colocataire (bail unique)
  Quand un colocataire part et un autre arrive
  Alors la location continue ; les quittances suivantes portent les nouveaux noms
```

---

### G5 — `bilan-declaration`

#### G5-1 : Argent, par bien et au total

P0 · Effort M

```gherkin
Scénario : vue mois et année
  Alors « Argent » montre pour la période : loyers encaissés, dépenses par catégorie, mensualités de prêt, cash-flow réel
  Et une courbe sur 12 mois, un filtre par bien
```

#### G5-2 : Réel vs prévu

P0 · Effort M

```gherkin
Scénario : bien issu d'une analyse
  Étant donné l'instantané du projet (cash-flow prévu −35 €/mois)
  Et 12 mois réels (cash-flow réel −73 €/mois)
  Alors la fiche bien titre « 38 €/mois de moins que prévu » et nomme les deux plus gros écarts (ex. vacance en mars, taxe foncière +140 €)
  Et le prévu est recalculé par le moteur avec la version de règles de l'instantané

Scénario : bien sans analyse
  Alors la carte propose « Analyser ce bien » qui crée un projet prérempli depuis la gestion
```

#### G5-3 : Aide à la déclaration

P1 · Effort L

```gherkin
Scénario : au printemps
  Étant donné l'année civile 2026 terminée
  Quand j'ouvre « Déclaration 2027 (revenus 2026) »
  Alors je vois par régime les montants à reporter et la case correspondante (micro-foncier, réel 2044, micro-BIC), avec le régime retenu dans l'analyse en premier
  Et chaque case et chaque abattement viennent des règles fiscales versionnées du moteur, marqués « à confirmer » tant que la notice de l'année n'est pas vérifiée
  Et le LMNP au réel affiche seulement les recettes et un renvoi vers un expert-comptable
```

#### G5-3 bis : ce qui n'est pas fait

Pas de télédéclaration, pas de liasse 2031, pas de calcul d'amortissements comptables réels.

#### G5-4 : Dépenses

P1 · Effort S

```gherkin
Scénario : ajout rapide
  Quand je clique « Ajouter une dépense »
  Alors je saisis montant, catégorie (liste fixe), bien, date : un écran, un bouton
```

#### G5-5 : Export pour le comptable

P2 · Effort S

```gherkin
Scénario : CSV
  Quand je clique « Exporter l'année »
  Alors j'obtiens un CSV (date, bien, catégorie, libellé, montant, source) et un récapitulatif PDF imprimable
```

---

## 5. Priorisation MoSCoW

| Must (MVP : G1 + G2)                                                                                                                                                                      | Should                                                                                                                | Could                                                                                                           | Won't (pour l'instant)                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Espace Gérer, portes « J'ai acheté » et « À la main », échéances, « Reçu » en un clic, quittance et reçu, accord du locataire, envoi automatique, « Loyer reçu ? », isolement des comptes | Banque (G3-1 à G3-4), révision IRL, fin de bail, dépôt, alertes, Argent, réel vs prévu, relance douce, résumé mensuel | Import de fichier, déclaration, régularisation, avis d'échéance, export, colocation par chambre, import Rentila | Encaissement SEPA, espace locataire, états des lieux, signature, documents, saisonnier, commercial, liasse LMNP, lecture de bail par IA |

## 6. Exigences non fonctionnelles

- **Performance** : accueil de Gérer affiché en moins de 1 s avec 20 biens ; génération des échéances et rapprochement en moins de 100 ms par compte (fonctions pures).
- **Fiabilité des envois** : une quittance est envoyée au plus une fois par déclenchement (idempotence par document) ; aucun envoi perdu si la tâche planifiée échoue (reprise le lendemain).
- **Sécurité** : chaque route authentifiée et filtrée par compte ; tests d'accès croisé systématiques ; jetons d'e-mail signés à usage unique ; jetons bancaires chiffrés ; aucun secret côté client ; en-têtes et CSP existants.
- **Vie privée** : hébergement UE ; minimisation ; journaux sans donnée personnelle ; export et suppression ; mentions « sous-traitant » dans les conditions d'utilisation ; opérations bancaires purgées à 13 mois.
- **Accessibilité** : cibles de 44 px, contraste AA, navigation au clavier, statuts lisibles sans la couleur (texte + forme).
- **Mobile** : toutes les actions de l'accueil et des loyers faisables au téléphone.
- **Tests** : couverture 100 % du paquet de calcul pur et des règles ; tests d'API avec doubles ; un parcours Playwright par porte vérifiant le compte de clics ; courriels testés par instantané de contenu. Le job `e2e` ne sert aujourd'hui que le build statique : il devra aussi lancer l'API (`npm run dev:node -w apps/comptes` sur une base éphémère), sinon les parcours de Gérer ne peuvent pas tourner en CI.

## 7. Questions ouvertes (pour l'architecture, pas pour Pierre)

1. Hébergement des données de gestion : dans `apps/comptes` (même origine, même base D1) ou un nouveau module servi par le worker Pages, et où tourne la tâche planifiée quotidienne. **Recommandation** : l'API HTTP dans `apps/comptes` (même origine que le site, donc même cookie de session) et la tâche planifiée dans `apps/worker` (déjà déployé, accepte un déclencheur cron) avec un binding sur la même base D1 `deklic-comptes` ; le calcul pur dans un paquet partagé. À écrire en ADR au début de G1.
2. Génération PDF côté serveur pour la pièce jointe (bibliothèque PDF pure JavaScript compatible Workers) et côté client pour l'aperçu (`@media print` existant) : un seul gabarit ?
3. Saisie assistée d'adresse : réutiliser le géocodage de `apps/worker` (Géoplateforme) déjà en place.
4. Source de l'IRL : série INSEE (identifiant à vérifier) récupérée chaque trimestre par l'Action « Référentiels » et publiée sur R2, comme l'usure.
5. Zone tendue (préavis d'un mois) : référentiel des communes à ajouter à `data/` ou déduction du zonage déjà publié.
