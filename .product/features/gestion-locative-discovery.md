# Feature Discovery : Gérer — la gestion locative après l'achat

**Slug** : `gestion-locative` (épic découpé en cinq features, une par session) · **Branche** : `docs/gestion-locative` (documentation seule) · **Date** : 2026-09-14 · **Statut** : spécifié, **rien n'est développé** (demande de Pierre)

Documents liés : specs `.product/specs/gestion-locative-specs.md` · UX `.product/design/gestion-locative-ux.md` · maquettes `.product/design/gestion-locative-maquettes.html` ([en ligne](https://claude.ai/code/artifact/8cbafc8f-e84c-442e-ac70-c676588ce7e0)) · état `.product/pipeline/gestion-locative.json`.

## Demande d'origine

Pierre, 14/09/2026 :

- « Préparer de nouvelles fonctionnalités liées à la gestion des biens. Dans le menu, c'est quelque chose de totalement séparé de l'analyse d'un bien, ça vient après. »
- « Refaire comme Rentila (j'ai un abonnement), en simplifiant pour les investisseurs particuliers, pas pour les agences. Ajouter des biens, des locataires, et ces locataires font des locations dans les biens. Renseigner, suivre, connecter les paiements avec la banque, envoyer automatiquement les quittances. »
- « UX qui ressemble plus à Monsieur Hugo, Lybox, Qalimo. »
- « Ne développe rien : prépare les spécifications, l'UX, les fonctionnalités. Simple, intuitif et très rapide à mettre en place. »
- « **En deux clics, tout doit être prêt et fonctionner. C'est vraiment le plus important.** »

## Ce qu'on a regardé

### Rentila (compte de Pierre, relevé le 14/09/2026)

Aucune donnée de locataire n'est reprise ici : seulement la structure du produit.

**Menu** (« L'essentiel » + « Le plus », avec un « Mode expert ») :

| Rubrique       | Sous-menus                                                                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bureau         | tableau de bord                                                                                                                                           |
| Biens          | Lots, Immeubles                                                                                                                                           |
| Locataires     | —                                                                                                                                                         |
| Locations      | —                                                                                                                                                         |
| Réservations   | (location saisonnière)                                                                                                                                    |
| État des lieux | États des lieux, Inventaires                                                                                                                              |
| Finances       | Paiements (quittances, revenus, dépenses), Prêts, Import bancaire, Bilan, Prévisionnel, Déclarations fiscales                                             |
| Documents      | Mes documents, Mes modèles, Signature électronique, Modèles de lettres                                                                                    |
| Le plus        | Carnet, Interventions, Tâches, Notes, Messages, Candidats, Communauté, Corbeille                                                                          |
| Outils         | Révision de loyer, Régularisation des charges, Équipements, Déplacements, Relevés compteurs, Rapports, Simulateur, Indices, Envoi de courrier, Actualités |

**Bureau** : quatre compteurs (biens loués, locataires, locations, loyers annuels) ; revenus et dépenses du mois (loyers payés, loyers à encaisser, revenu brut, dépenses, résultat net, évolution sur 12 mois) ; « Conformité des biens » (DPE, gaz, électricité, assurance propriétaire) ; actualités ; raccourcis Bien, Locataire, Location, Quittances, Revenu, Dépense.

**Créer une location qui tourne demande trois formulaires** :

- **Bien** : 9 onglets (informations générales, complémentaires, financières, clés et digicode, contrats et diagnostics, flyer, photos, contacts, documents) ; 26 types de biens ; adresse en 9 champs ; état locatif ; loyer « indicatif ».
- **Locataire** : 5 onglets ; civilité, deuxième prénom, date et lieu de naissance, nationalité, numéro fiscal, profession, revenus, pièce d'identité (type, numéro, expiration, fichier), e-mail et invitation à l'espace locataire, e-mail secondaire, téléphones, adresse.
- **Location** : 8 onglets ; 13 types de bail ; périodicité (7 choix), terme à échoir ou échu, moyen de paiement ; **trois dates à régler** pour que la quittance parte au bon moment (date de paiement, date de quittancement, génération de J-90 à J+90) ; loyer, charges (provision ou forfait), autres paiements ; prorata de la première quittance ; dépôt de garantie ; CAF/APL ; frais de retard ; loyers prépayés ; révision (8 indices, trimestre, automatique ou non, période, date) ; encadrement des loyers (6 questions) ; locataires ; signature électronique (10 par mois).

Environ **60 champs** vus avant la première quittance.

**Banque** : import de fichier OFX/QIF ou synchronisation (offres payantes) ; rapprochement par feux (vert : montant, date et mot-clé identiques, le loyer passe payé ; orange : à vérifier ; gris : rien trouvé) ; règles d'automatisation à écrire ; transactions effacées au-delà de 12 mois.

**Prix** : gratuit pour 1 bien ; Silver 5,90 €/mois (2 à 5 biens, synchronisation bancaire) ; Gold 11,90 €/mois (illimité).

**Constat** : complet et fiable, mais pensé pour tous les cas (agences, commerces, saisonnier, immeubles) : une quarantaine d'écrans, des réglages que le particulier ne comprend pas, et c'est à lui de tout relier.

### Concurrents (sources publiques)

| Outil             | Positionnement                                           | Ce qui compte pour nous                                                                                                                                                                                             | Prix                                         |
| ----------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **Qalimo**        | Bailleur particulier, location nue et meublée            | Démarrage annoncé en « 5 minutes » ; synchronisation bancaire DSP2 qui détecte les loyers ; quittances automatiques ; relances à J+3, J+8, J+15 ; 2044 et 2042-C-PRO ; révision IRL ; bail et état des lieux signés | 4,90 €/bien/mois ; module LMNP réel 379 €/an |
| **Monsieur Hugo** | Gestion « sans agence » avec services                    | Prélèvement SEPA des loyers (comptes séquestres) ; quittances et relances automatiques ; comptabilité ; juristes, artisans, assurance loyers impayés                                                                | 33,90 €/mois                                 |
| **Lybox**         | Chasse et analyse d'annonces (comme Deklic côté analyse) | Pas de module de gestion trouvé dans les sources consultées ; référence d'UX « investisseur »                                                                                                                       | abonnement                                   |
| **Rentila**       | Généraliste, du particulier à la petite agence           | Voir plus haut                                                                                                                                                                                                      | 0 à 11,90 €/mois                             |

UX commune à Qalimo et Monsieur Hugo : une promesse d'automatisation, peu de menus, un tableau de bord qui répond d'abord à « qui a payé ? ».

### Connexion bancaire : l'offre en septembre 2026

| Fournisseur                                | Ce qu'on sait                                                                                                                                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GoCardless Bank Account Data (ex-Nordigen) | Était gratuit ; **fermé aux nouveaux clients depuis juillet 2025**                                                                                                                                                              |
| Enable Banking                             | Agréé (pas besoin d'agrément pour nous) ; gratuit seulement pour relier **ses propres** comptes ; ouverture au public après contrat ; prix au volume avec un minimum mensuel, **sur devis** ; consentement de 180 jours au plus |
| Powens (ex-Budget Insight), Bridge         | Agrégateurs français agréés, large couverture des banques françaises ; **prix sur devis**                                                                                                                                       |

**Aucune option gratuite pour de vrais utilisateurs** : la synchronisation bancaire est une dépense, donc une décision de Pierre. Deux replis gratuits existent : l'import d'un fichier exporté de la banque (OFX, CSV), et un e-mail « Loyer reçu ? » où le bailleur confirme d'un clic.

## Analyse

### Quoi

Un second espace de l'application, **« Gérer »**, séparé de l'analyse (« Analyser ») par un sélecteur en haut du menu. On y retrouve ses **biens**, ses **locataires** et ses **locations** ; chaque mois, Deklic sait qui a payé, envoie les quittances tout seul et signale ce qui demande une action. Tout le reste (révision du loyer, dépôt de garantie, charges, bilan, déclaration) arrive au bon moment, sous forme de proposition à valider d'un clic.

### Pourquoi

- La spec plaçait le « suivi après achat » en v3. Pierre veut l'avancer : c'est l'étape d'après l'analyse, et une raison de revenir chaque mois.
- **Avantage que Rentila n'a pas** : Deklic connaît déjà le bien, le prix, le prêt, le loyer visé, les charges et le régime fiscal retenu. Rien à ressaisir, et on peut comparer **le réel au prévu** (« ton T2 rapporte 38 €/mois de moins que prévu : vacance en mars »).
- Les outils existants demandent de tout relier soi-même ; la demande est l'inverse : **deux clics et ça tourne**.

### Pour qui

- **Camille** après son premier achat : un bien, un locataire, aucune envie d'apprendre un logiciel.
- **Pierre** : plusieurs biens dont une colocation, abonné à Rentila, qui veut plus simple.
- **Pas les agences** : ni mandats, ni propriétaires clients, ni location saisonnière, ni immeubles entiers, ni baux commerciaux.

### Où

Full-stack : écrans dans `apps/web` ; données **côté serveur** liées au compte (les envois automatiques doivent partir quand l'ordinateur de l'utilisateur est éteint) ; e-mails ; tâches planifiées ; calculs purs testés (échéances, quittances, révision, rapprochement) dans un paquet sans I/O ; plus tard un agrégateur bancaire. Le choix précis des modules et de l'hébergement se fait à l'architecture de chaque feature.

## La règle d'or : deux clics

**Définition** : depuis l'écran d'accueil de Gérer, **deux clics chez Deklic** suffisent pour qu'une location soit créée, que ses loyers soient suivis et que ses quittances partent. Deklic ne pose que les questions auxquelles il ne peut pas répondre seul ; tout le reste a une valeur par défaut sourcée et modifiable plus tard (principe 5 « jamais de case vide »).

Trois portes d'entrée :

| Porte                       | Pour qui                             | Clic 1                                                     | Ce que Deklic fait seul                                                                                                                                                            | Clic 2          | Seule saisie éventuelle                                     |
| --------------------------- | ------------------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ----------------------------------------------------------- |
| **« J'ai acheté ce bien »** | A analysé son bien dans Deklic       | Sur le projet : « J'ai acheté ce bien »                    | Reprend adresse, type, surface, DPE, prix, frais, prêt (échéancier), taxe foncière, copropriété, assurance, loyer, charges, meublé ou nu, régime fiscal, puis prépare la location  | « C'est parti » | Prénom, nom et e-mail du locataire (ou « pas encore loué ») |
| **« Connecter ma banque »** | Déjà propriétaire (le cas de Pierre) | Choisir sa banque (puis valider dans l'appli de la banque) | Lit 13 mois d'opérations, trouve les **virements qui reviennent chaque mois** (loyers) et les dépenses récurrentes (prêt, taxe foncière, syndic, assurance), propose les locations | « Tout créer »  | L'adresse de chaque loyer trouvé (saisie assistée)          |
| **« Ajouter à la main »**   | Sans analyse ni banque               | « Ajouter à la main » (un seul écran)                      | Déduit dépôt, jour de paiement, indice de révision, type de bail                                                                                                                   | « Créer »       | Adresse, loyer, charges, locataire, date d'entrée           |

Et une fois créé, **plus aucun clic nécessaire** : avec la banque, le loyer reçu est rapproché et la quittance part ; sans banque, le bailleur reçoit « Loyer de Julie reçu ? » et répond d'un clic dans l'e-mail.

## Garder, simplifier, retirer (par rapport à Rentila)

| Rentila                                                                                                                                                               | Deklic Gérer                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Bien (9 onglets, 26 types)                                                                                                                                            | **Garder, simplifié** : appartement, maison, studio, parking ; chambres (lots) seulement pour la colocation                               |
| Immeubles, Lots                                                                                                                                                       | **Retirer** (les chambres d'une colocation suffisent)                                                                                     |
| Locataire (5 onglets, pièce d'identité, nationalité…)                                                                                                                 | **Simplifier** : prénom, nom, e-mail, téléphone facultatif. Aucune pièce d'identité, date de naissance ni nationalité (minimisation RGPD) |
| Location (8 onglets, 13 types de bail, 3 dates)                                                                                                                       | **Simplifier** : nue, meublée, meublée étudiant, bail mobilité ; un seul « jour du loyer » ; le reste par défaut                          |
| Quittances, avis d'échéance, paiements                                                                                                                                | **Garder, automatiser** : quittance envoyée au paiement constaté ; avis d'échéance en option                                              |
| Frais de retard                                                                                                                                                       | **Retirer** : les pénalités sont interdites dans un bail d'habitation                                                                     |
| Import bancaire + règles à écrire                                                                                                                                     | **Garder, automatiser** : détection des loyers, rapprochement sans réglage, règles apprises en classant                                   |
| Prêts                                                                                                                                                                 | **Garder** : repris de l'analyse ou détecté dans la banque                                                                                |
| Bilan, Prévisionnel                                                                                                                                                   | **Fusionner** en « Argent » : réel vs prévu (l'analyse est le prévisionnel)                                                               |
| Déclarations fiscales                                                                                                                                                 | **Garder** : montants à reporter, régime repris de l'analyse                                                                              |
| Révision de loyer, régularisation des charges                                                                                                                         | **Garder** : proposées d'elles-mêmes au bon moment                                                                                        |
| Conformité des biens                                                                                                                                                  | **Garder** : alertes DPE (validité, logement G interdit à la relocation), assurance, fin de bail                                          |
| États des lieux, inventaires, signature électronique                                                                                                                  | **Plus tard**                                                                                                                             |
| Documents, modèles de lettres                                                                                                                                         | **Plus tard** (les lettres utiles sont générées : révision, relance, restitution du dépôt)                                                |
| Réservations, candidats, carnet, interventions, tâches, notes, messages, communauté, équipements, déplacements, compteurs, envoi de courrier, actualités, mode expert | **Retirer**                                                                                                                               |

## Outcomes

1. **Deux clics** de l'accueil de Gérer à une location qui fonctionne (mesuré par parcours de bout en bout ; objectif : moins de 2 minutes, saisie comprise).
2. Le bailleur n'a **rien à faire** un mois normal : quittances envoyées, loyers suivis ; il n'intervient que sur une exception (retard, révision à valider).
3. Avec la banque, au moins **8 loyers sur 10** sont rapprochés sans intervention.
4. Chaque bien issu d'une analyse montre **l'écart entre le réel et le prévu**.
5. Pierre peut **quitter Rentila** pour ses biens (critère de réussite qualitatif).

## Outputs (par feature)

| Feature                    | Livrables                                                                                                                                                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G1 `gerer-socle`**       | Sélecteur Analyser / Gérer ; accueil de Gérer et ses trois portes ; portes « J'ai acheté ce bien » et « Ajouter à la main » ; biens, locataires, locations ; loyers du mois et « Reçu » en un clic ; quittance et reçu en PDF ; données liées au compte |
| **G2 `quittances-auto`**   | Accord du locataire par e-mail ; quittance envoyée au paiement constaté ; « Loyer reçu ? » au bailleur ; relance douce ; avis d'échéance en option ; résumé mensuel                                                                                     |
| **G3 `banque`**            | Connexion d'une banque ; lecture de 13 mois ; porte « Connecter ma banque » (détection des loyers et des dépenses) ; rapprochement continu ; classement des opérations ; import de fichier en repli                                                     |
| **G4 `vie-du-bail`**       | Révision annuelle (IRL, gel des logements F et G) ; fin de location et préavis ; dépôt de garantie ; régularisation des charges ; alertes de conformité ; colocation par chambre                                                                        |
| **G5 `bilan-declaration`** | « Argent » par bien et global ; réel vs prévu ; dépenses ; aide à la déclaration (micro-foncier, réel 2044, micro-BIC) ; export pour le comptable                                                                                                       |

## Scope

### IN (l'épic)

- Location **nue**, **meublée**, **meublée étudiant**, **bail mobilité**, **colocation** (bail unique ou une location par chambre) ; résidence principale du locataire.
- Un bailleur par compte (personne physique ; SCI à l'IR saisie comme nom de bailleur sur les quittances).
- Biens en France (métropole et outre-mer pour l'IRL).
- Paiement mensuel, terme à échoir ; APL versée au bailleur (tiers payant).
- E-mails en français ; ton Deklic (tutoiement pour le bailleur, vouvoiement pour le locataire).
- Ordinateur et téléphone (écrans adaptatifs).

### OUT (plus tard ou jamais)

- Encaissement des loyers par Deklic (prélèvement SEPA, comptes séquestres : c'est un métier réglementé).
- Espace locataire avec connexion (le locataire reçoit des e-mails, c'est tout).
- États des lieux, inventaires, signature électronique, rédaction du bail, candidatures et dossiers locataires.
- Stockage de documents (bail signé, diagnostics, factures) : feature « documents » ultérieure.
- Location saisonnière, baux commerciaux et professionnels, immeubles, multi-bailleurs, mandats d'agence.
- Liasse LMNP au réel (2031, amortissements comptables) : renvoi vers un expert-comptable ; éventuellement une offre v3.
- Encadrement des loyers (vérification du loyer de référence) : alerte simple plus tard.
- Lecture d'un bail PDF par l'IA (nouveau point d'usage du modèle de langage : ADR à écrire, données personnelles envoyées à un fournisseur).
- Import d'un export Rentila (utile à Pierre, à tester sur ses fichiers ; candidat « Could » de G3).

## Contraintes

- **Compte obligatoire pour Gérer** : les envois partent du serveur, donc les données y vivent. L'analyse reste gratuite et sans compte (principe 9 intact). Gérer s'ouvre sans compte sur une page qui explique pourquoi, avec « Se connecter ».
- **Principes métier** : le modèle de langage ne calcule rien (aucun usage prévu dans l'épic) ; tous les calculs (échéances, prorata, quittances, révision, dépôt, régularisation, rapprochement, détection) sont des **fonctions pures testées à 100 %** ; les règles légales sont **versionnées et datées** comme les règles fiscales (`regles/`), avec le drapeau « à confirmer » quand la source n'est pas vérifiée.
- **Vie privée** : données hébergées en UE ; le bailleur est responsable du traitement des données de ses locataires, Deklic est sous-traitant (conditions d'utilisation et mentions à écrire) ; minimisation ; aucune donnée personnelle dans les journaux ; export et suppression des données.
- **Budget** (< 10 €/mois hors banque) : D1 et tâches planifiées dans les quotas gratuits de Cloudflare ; Resend gratuit = 3 000 e-mails/mois et 100 par jour (étaler les envois ; ~1 quittance + 1 e-mail par location par mois) ; domaine d'envoi vérifié obligatoire (déjà un prérequis des comptes).
- **Hébergement** : le worker Pages (`apps/comptes`) n'a pas de tâches planifiées ; les envois programmés demanderont un Worker avec déclencheur cron et accès à la base (à trancher à l'architecture de G1).
- **Une feature par session** : G1 à G5 dans l'ordre, chacune avec son architecture.
- **Coque existante** (direction « Le guide ») ; la fiche de backlog 11 (menu et en-tête fixes) touche la même barre latérale : à coordonner.

## Risques

- **Banque payante** : sans contrat, pas de porte « Connecter ma banque » ; la promesse « deux clics » tient quand même par les deux autres portes, et « Loyer reçu ? » remplace la détection.
- **Reconsentement bancaire** tous les 180 jours au plus : sans rappel, la synchronisation s'arrête et les quittances ne partent plus. Rappel 14 jours avant, puis bascule automatique sur « Loyer reçu ? ».
- **Détection imparfaite** : loyer payé en deux virements, par la CAF, par un colocataire pour tous, montant qui change ; tout ce qui n'est pas sûr passe en « à confirmer », jamais en payé.
- **Quittance erronée** : une quittance atteste un paiement. Elle ne part que sur paiement **complet** constaté ou confirmé ; un paiement partiel donne un **reçu**.
- **Accord du locataire** pour les quittances par e-mail (obligation légale) : recueilli par un lien dans le premier e-mail, sans clic de plus pour le bailleur ; en attendant, les quittances restent téléchargeables.
- **E-mails en indésirables** : domaine vérifié (SPF, DKIM), textes sobres, pas de pièce jointe lourde.
- **Liens d'action dans les e-mails** (« Oui, reçu ») ouverts par les antivirus de messagerie : page de confirmation obligatoire, jeton signé à usage unique et durée limitée.
- **Données personnelles de tiers** (locataires) : sécurité d'accès par compte testée (un compte ne voit jamais les données d'un autre).
- **Règles légales mouvantes** (IRL, décence énergétique, encadrement) : règles datées, sources dans la Méthode.
- **Périmètre** : la tentation de refaire tout Rentila ; chaque ajout doit passer le test « est-ce que ça garde les deux clics ? ».

## Décisions à prendre par Pierre

| #   | Décision                                    | Recommandation                                                                                                                                                                      |
| --- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Fournisseur de connexion bancaire et budget | Demander dès maintenant trois devis (Powens, Bridge, Enable Banking) sur ~100 comptes connectés ; livrer G1 et G2 sans banque (« Loyer reçu ? ») ; brancher G3 dès le contrat signé |
| 2   | Gérer gratuit ou payant                     | Gérer **gratuit** sans banque (coût quasi nul) ; **synchronisation bancaire payante** (prix fixé quand le coût est connu) : cohérent avec « ne jamais dégrader le gratuit »         |
| 3   | Nom et place dans le menu                   | Sélecteur « Analyser · Gérer » en haut de la barre latérale                                                                                                                         |
| 4   | Import depuis Rentila                       | À tester sur les exports de Pierre ; « Could » de G3                                                                                                                                |

## Découpage et ordre

| Ordre | Feature             | Taille | Dépend de                                | Ce que l'utilisateur gagne                                 |
| ----- | ------------------- | ------ | ---------------------------------------- | ---------------------------------------------------------- |
| 1     | `gerer-socle`       | L      | comptes en service, domaine e-mail       | Ses biens et locations en deux clics ; quittances en PDF   |
| 2     | `quittances-auto`   | M      | G1                                       | Plus rien à faire un mois normal                           |
| 3     | `banque`            | L      | G2, **contrat fournisseur** (décision 1) | Porte « Connecter ma banque » ; loyers détectés tout seuls |
| 4     | `vie-du-bail`       | M      | G1 (G2 pour les lettres)                 | Révision, fin de bail, dépôt, charges, alertes             |
| 5     | `bilan-declaration` | M      | G1 (G3 pour les dépenses automatiques)   | Réel vs prévu, déclaration, export                         |

G5 peut passer avant G4 si la saison des déclarations (avril-juin) approche.

## Definition of Done (de l'épic)

- [ ] Les trois portes mènent à une location active en deux clics (tests de bout en bout).
- [ ] Un mois sans incident ne demande aucune action : quittances envoyées (banque) ou une réponse d'un clic (sans banque).
- [ ] Quittances et reçus conformes (mentions, détail loyer et charges, gratuité, accord du locataire).
- [ ] Révision, dépôt, préavis et régularisation calculés par des fonctions pures, sourcées, testées à 100 %.
- [ ] Aucun accès croisé entre comptes (tests) ; export et suppression des données.
- [ ] Réel vs prévu visible sur les biens issus d'une analyse.
- [ ] Documentation : architecture de chaque feature, ADR (hébergement des données de gestion, fournisseur bancaire), Méthode enrichie des règles de gestion, README, CLAUDE.md.

## Auto-revue (checkpoint validé par Claude, sur autorisation de Pierre)

- **« Deux clics » est pris au pied de la lettre** et devient un test de bout en bout, pas un slogan. La validation dans l'appli de la banque (authentification forte) n'est pas un clic Deklic : l'écran le dit honnêtement.
- **La porte « Connecter ma banque » est la plus magique mais la seule payante** : l'ordre des features ne la rend pas bloquante ; si Pierre refuse la dépense, l'épic reste utile.
- **Rentila n'a pas pu être exploré jusqu'au bout** (onglet figé sur l'import bancaire et les déclarations) : ces écrans sont décrits d'après l'aide en ligne de Rentila ; à revoir avec Pierre si un détail compte.
- **Compte obligatoire pour Gérer** : écart assumé avec « sans compte », limité à cet espace et justifié par les envois automatiques ; à confirmer par Pierre s'il le voit autrement.
- **Règles légales** citées de mémoire et par des sources secondaires : toutes marquées « à vérifier sur Légifrance » dans les specs, à sourcer à l'architecture (Rule 6).
- **Prix des concurrents** relevés sur leurs pages et des avis de septembre 2026 : ils bougent (Rentila annonce une évolution de ses tarifs au 1er septembre 2026).

## Sources

- Rentila : espace bailleur de Pierre (14/09/2026) ; [aide « Synchronisation bancaire et import »](https://www.rentila.com/support/archives/2504) ; [tarifs](https://www.rentila.com/tarifs).
- Qalimo : [services](https://www.qalimo.fr/services/) ; [avis Lybox sur Qalimo](https://blog-investissement-immobilier.lybox.fr/avis-qalimo-gestion-locative/).
- Monsieur Hugo : [site](https://www.monsieurhugo.com/) ; [avis bailpdf](https://bailpdf.com/gestion-locative/monsieur-hugo).
- Banque : [GoCardless, inscriptions fermées](https://bankaccountdata.gocardless.com/new-signups-disabled) ; [FAQ Enable Banking](https://enablebanking.com/docs/faq/) ; [Bridge](https://www.bridgeapi.io/) ; [Powens](https://www.powens.com/fr/).
- Quittance et IRL : [Qalimo, modèle de quittance](https://www.qalimo.fr/quittance-de-loyer/) ; [Kohen avocats, révision 2026 et DPE F/G](https://kohenavocats.fr/2026/04/30/augmentation-loyer-2026-calcul-irl-078-dpe-fg-contestation/) ; [CPIM, IRL 2026](https://www.cpim.fr/inflation-loyers-irl-2026/).
