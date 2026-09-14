# Specs : Visite — base de questions, règles, réponses conservées, onglet masqué

Discovery : `../features/visite-questions-discovery.md`. Périmètre : `packages/moteur/src/visite`, `apps/web` (stockage, écran Visite, Rapport, Vérifier, onglets, impression, partage), tests Playwright, docs. Rien côté Worker, extension ni données.

Vocabulaire : une **question** vient de la base (identifiant, catégorie, texte, source, condition, valeur éventuelle) ; une **question posée** est une question dont la condition est vraie pour le projet, avec ses paramètres ; une **réponse** est l'état (`a_verifier`, `ok`, `probleme`, `sans_objet`) et la note donnés par la personne ; la **visite** d'un projet enregistré est `{ faite, date?, reponses }`.

Projets types des tests :

- **Exemple** : T3 de 65 m² à Marseille, 1962, copropriété de 24 lots, 3e sans ascenseur, DPE D, meublé, argiles (niveau moyen), feu prix « bon ».
- **Maison récente** : maison de 2015, sans copropriété, DPE B, louée nue, sans risque, sans ventes réelles.
- **Immeuble ancien en courte durée** : appartement de 1930, copropriété en procédure, DPE G, rez-de-chaussée, courte durée, inondation « fort », loyer encadré.

---

## Épopée E1 : La base et ses règles (moteur)

### US-1 : Questions posées pour un projet

En tant que Camille,
je veux que la liste de visite ne contienne que les questions qui concernent ce bien,
afin qu'elle soit longue pour un immeuble ancien en copropriété et courte pour une maison neuve.

Priorité : P0 (Must) · Effort : L

```gherkin
Scénario: la base est cohérente
  Étant donné la base de questions du moteur
  Alors chaque identifiant est unique, en majuscules et soulignés
  Et chaque question a une catégorie parmi les sept, un texte et une source non vides
  Et chaque question à valeur cite un chemin du projet écrit par l'onglet Hypothèses
  Et la base compte entre 60 et 90 questions

Scénario: questions conditionnelles sur le projet d'exemple
  Étant donné le projet d'exemple et ses résultats
  Quand je demande les questions posées
  Alors elles contiennent les PV d'AG (24 lots, 1962), les charges de copropriété, le règlement de copropriété, le DPE D à confirmer, le 3e étage sans ascenseur, le prix sous le marché, l'inventaire du meublé et le risque argiles
  Et elles ne contiennent ni amiante (1962 est après 1949 mais avant 1997 : amiante oui, plomb non)
  Et elles ne contiennent ni procédure de copropriété, ni rénovation énergétique, ni changement d'usage, ni surface des chambres
  Et elles sont entre 40 et 60

Scénario: maison récente louée nue
  Étant donné une maison de 2015, sans copropriété, DPE B, louée nue
  Alors aucune question de copropriété, d'amiante, de plomb, d'ascenseur, de meublé ni de courte durée n'est posée
  Et l'assainissement, le terrain et les limites sont posés
  Et les questions sont entre 25 et 40

Scénario: immeuble ancien en courte durée, en procédure, DPE G, inondable
  Étant donné l'appartement de 1930 en procédure, DPE G, en rez-de-chaussée, en courte durée, en zone inondable forte, avec un plafond de loyer
  Alors l'amiante et le plomb sont posés, la procédure, la rénovation énergétique obligatoire (G, 2025), le rez-de-chaussée, le changement d'usage, le règlement de copropriété face à la courte durée, la taxe d'habitation sur résidence secondaire, l'encadrement des loyers et le risque inondation
  Et les questions à valeur « année de construction » et « DPE inconnu » ne sont pas posées

Scénario: paramètres pour le web
  Étant donné une question posée avec des paramètres
  Alors les paramètres sont des nombres ou des textes bruts (classe DPE, étage, écart de prix en décimal, types de risques séparés par des virgules)
  Et le texte de la question porte un jeton `{nom}` pour chacun d'eux

Scénario: conditions sur les types d'exploitation à venir
  Étant donné un contexte de visite forgé avec l'exploitation « colocation »
  Alors les questions « surface des chambres » et « espaces communs » sont posées
  Étant donné l'exploitation « moyenne durée »
  Alors la question du bail mobilité est posée
  Et aujourd'hui `typeExploitation` déduit nue, meublée ou courte durée du mode du projet

Scénario: seuils datés dans les règles
  Étant donné les règles 2026-09
  Alors elles portent les seuils de visite : amiante avant 1997, plomb avant 1949, installations de plus de 15 ans, étage sans ascenseur dès le 3e, chambre de 9 m²

Scénario: points de vigilance financiers seulement
  Étant donné le projet d'exemple
  Quand je calcule le verdict
  Alors `verdict.vigilance` contient seulement des codes financiers (effort, durée, plafond du micro, loyer encadré, PS BIC)
  Et le projet d'exemple en a exactement un (PS BIC à confirmer)
```

---

## Épopée E2 : Réponses conservées avec le projet

### US-2 : Enregistrement de la visite

En tant que Camille,
je veux que mes réponses et mes notes restent avec le projet,
afin de les retrouver après la visite et de les partager.

Priorité : P0 (Must) · Effort : M

```gherkin
Scénario: migration douce
  Étant donné un projet enregistré avant cette feature (sans champ visite)
  Quand je le relis
  Alors il est accepté, la visite n'est pas faite et il n'a aucune réponse

Scénario: réponse enregistrée
  Étant donné un projet et la question DOC_TAXE_FONCIERE
  Quand je réponds « problème » avec la note « avis 2025 : 1 320 € »
  Alors la visite du projet contient cette réponse
  Et une réponse « à vérifier » sans note n'est pas enregistrée (elle est l'état par défaut)
  Et une note est coupée à 300 caractères par le schéma (refusée au-delà)

Scénario: progression
  Étant donné 48 questions posées et 12 réponses dont 2 « problème » et 3 « sans objet »
  Alors la progression dit 12 répondues sur 48, 2 problèmes
  Et une réponse orpheline (identifiant absent de la base) ne compte pas

Scénario: visite faite et rouverte
  Quand je marque la visite comme faite le 14 septembre 2026
  Alors `visite.faite` est vrai et la date est enregistrée, les réponses intactes
  Quand je rouvre la visite
  Alors `visite.faite` est faux, la date effacée, les réponses intactes

Scénario: mise à jour depuis le contexte
  Étant donné le fournisseur de projets
  Quand j'appelle mettreAJour avec le projet et le complément { visite }
  Alors la visite est écrite dans la même écriture que le projet, sans écraser l'adresse

Scénario: création avec visite déjà faite
  Quand je crée un projet avec l'option visite { faite: true }
  Alors le projet enregistré porte cette visite

Scénario: lien de partage
  Étant donné un projet complet dont toutes les questions sont répondues avec une note de 120 caractères
  Quand j'encode puis décode le lien
  Alors je retrouve le projet et sa visite à l'identique
  Et le lien fait moins de 20 000 caractères
  Et le projet d'exemple sans visite tient toujours sous 4 000 caractères
```

---

## Épopée E3 : L'écran Visite

### US-3 : Répondre pendant la visite

En tant que Camille, téléphone à la main,
je veux répondre à chaque question d'un geste et noter ce que je vois,
afin de ne rien oublier et de corriger mes hypothèses sur place.

Priorité : P0 (Must) · Effort : L

```gherkin
Scénario: groupes et progression
  Étant donné l'onglet Visite du projet d'exemple
  Alors le titre est « Préparer la visite »
  Et les cinq feux sont rappelés
  Et une barre de progression dit « 0 sur N répondues »
  Et les questions sont groupées sous les titres des catégories présentes, dans l'ordre : Documents à demander, Diagnostics et travaux, Sur place, le logement, L'immeuble et la copropriété, Le quartier, Questions au vendeur ou à l'agence, Exploitation locative
  Et chaque question montre son texte, sa source et quatre choix : À vérifier, OK, Problème, Sans objet

Scénario: répondre
  Quand je choisis « Problème » sur la première question
  Alors la réponse est enregistrée dans le projet
  Et la progression dit « 1 sur N répondues, 1 problème »
  Quand je recharge l'écran
  Alors « Problème » est toujours sélectionné

Scénario: note
  Quand je touche « Ajouter une note » sous une question et que je tape « chaudière de 2019 »
  Alors la note est enregistrée avec la réponse
  Et elle est affichée au retour sur l'écran

Scénario: question à valeur
  Étant donné la question des charges de copropriété (valeur : hypotheses.charges.coproAnnuel)
  Alors un champ « Charges de copropriété » en €/an montre la valeur actuelle et son badge de provenance
  Quand je tape 1450
  Alors le projet porte 1 450 € avec la provenance « à toi », la question passe à « OK », et le rapport se recalcule
  Quand je tape « abc »
  Alors une erreur s'affiche sous le champ et le projet ne change pas

Scénario: marquer la visite comme faite
  Quand je touche « Marquer la visite comme faite »
  Alors la visite est faite avec la date du jour
  Et je suis renvoyée au Rapport
  Et l'onglet « Visite » n'est plus dans la bande des volets

Scénario: compte rendu et rouvrir
  Étant donné une visite faite
  Quand j'ouvre /projets/:id/visite
  Alors le titre est « Compte rendu de visite », avec la date
  Et chaque question répondue montre son état et sa note, sans boutons
  Et un bouton « Rouvrir la visite » remet l'onglet et les boutons

Scénario: téléphone
  Étant donné un format de 320 px tactile
  Alors les quatre choix font au moins 44 px de haut et les champs 16 px
  Et la page ne défile pas horizontalement
```

---

## Épopée E4 : Autour de la visite

### US-4 : Rapport, Vérifier, onglets, impression, partage

En tant que Camille,
je veux que la visite s'intègre au reste du dossier,
afin que le Rapport garde les points financiers, que le dossier imprimé porte le compte rendu, et que je puisse dire dès la création que j'ai déjà visité.

Priorité : P0 (Must) · Effort : M

```gherkin
Scénario: Rapport
  Étant donné le projet d'exemple
  Alors le Rapport montre, sous les feux, une carte « Avant de faire une offre » avec « Prélèvements sociaux du meublé à 18,6 % : taux à confirmer »
  Et un lien « Préparer la visite : N questions » vers l'onglet Visite
  Étant donné une visite faite avec 2 problèmes
  Alors le lien dit « Visite faite le 14 sept. 2026 · 2 problèmes »
  Étant donné un projet sans point financier
  Alors la carte dit « Rien à régler côté banque ni fiscalité » et garde le lien vers la visite
  Et dans le dossier imprimé ou partagé, l'état de la visite est un texte, pas un lien

Scénario: Vérifier
  Étant donné le formulaire de création à la main
  Quand je coche « J'ai déjà visité ce bien » et que je crée le projet
  Alors le projet est créé avec la visite faite à la date du jour
  Et son en-tête n'a pas d'onglet Visite

Scénario: impression, visite non faite
  Étant donné le projet d'exemple
  Quand j'ouvre le dossier imprimable
  Alors le quatrième volet est « Préparer la visite » et liste les questions sans boutons

Scénario: impression, compte rendu
  Étant donné une visite faite avec des réponses
  Alors le quatrième volet est « Compte rendu de visite » avec les états et les notes
  Étant donné une visite faite sans aucune réponse
  Alors le dossier n'a que trois volets

Scénario: partage
  Étant donné un lien de partage d'un projet dont la visite est faite avec des réponses
  Quand je l'ouvre et que je clique « Ajouter à mes projets »
  Alors le projet ajouté porte la même visite (et la même adresse)

Scénario: Méthode
  Alors la section Verdict de la page Méthode dit que les points financiers sont dans le Rapport et que la liste de visite vient d'une base de questions sourcées
```

---

## Épopée E5 : Preuve

### US-5 : Tests de bout en bout et vérification dans le navigateur

Priorité : P1 (Should) · Effort : S

```gherkin
Scénario: parcours Playwright
  Étant donné le projet d'exemple
  Quand j'ouvre Visite, réponds « OK » à la première question, « Problème » à la deuxième, puis reviens à « À vérifier »
  Alors le compteur suit, et la réponse survit à un rechargement
  Quand je marque la visite comme faite
  Alors l'onglet Visite disparaît et le Rapport dit « Visite faite »

Scénario: formats
  Étant donné les 9 formats de la spec responsive
  Alors l'écran « Visite » et le nouvel écran « Visite faite » (compte rendu) n'ont ni débordement, ni cible sous 44 px, ni champ sous 16 px
```

---

## Priorisation MoSCoW

| Story | Priorité | Dépend de  |
| ----- | -------- | ---------- |
| US-1  | Must     | —          |
| US-2  | Must     | US-1       |
| US-3  | Must     | US-1, US-2 |
| US-4  | Must     | US-2, US-3 |
| US-5  | Should   | US-3, US-4 |

## Contrats

- `questionsPourProjet(projet: Projet, resultats: Pick<Resultats, 'verdict'>): readonly QuestionPosee[]` avec `QuestionPosee = { id, categorie, texte, source, parametres, valeur? }`.
- `VisiteSchema = { faite: boolean, date?: string (ISO), reponses: Record<string, { etat, note? }> }` ; `ProjetEnregistre.visite?: Visite`.
- `mettreAJour(id, projet, { adresse?, visite? })` ; `creerProjet({ …, visite?, adresse? })`.
- Fragment de partage inchangé dans sa forme (`#p=` base64url du `ProjetEnregistre`).
