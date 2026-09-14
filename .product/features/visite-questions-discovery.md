# Feature Discovery : Visite — base de questions, règles d'affichage, onglet masqué quand la visite est faite

Fiche de backlog : `../backlog/07-visite-questions.md` (Pierre, 14/09/2026). Pipeline `/new-feature`, points de contrôle auto-validés (décision de Pierre), état dans `../pipeline/visite-questions.json`. Session parallèle : `.product/pipeline-state.json` n'est pas touché.

## Demande d'origine

> Pour l'onglet Visite, il faut construire une base de données de questions et avoir des règles, en fonction des éléments présents, qui mettent les questions ou pas. Si la visite est déjà faite, il n'y a pas besoin d'avoir cet onglet.

## Constat (14/09/2026)

- Le moteur produit 14 **points de vigilance** par règles (`packages/moteur/src/verdict/vigilance.ts`) ; leurs phrases et trois catégories vivent côté web (`apps/web/src/textes/vigilance.ts`). Sur le projet d'exemple, 7 points ; sur le projet de Lyon des tests de bout en bout, 7 aussi.
- L'onglet Visite (`apps/web/src/ecrans/Visite.tsx`) les liste avec des cases **non persistées** (« sur cet écran seulement »). Rien ne dit si la visite a eu lieu ; `ProjetEnregistre` ne le sait pas.
- Neuf de ces points se vérifient sur place ou se demandent au vendeur (PV d'AG, charges de copropriété, procédure, DPE, rénovation énergétique, prix sous le marché, taxe foncière, risque naturel, étage sans ascenseur). Cinq sont financiers et ne se vérifient pas en visite (effort HCSF, durée du prêt, plafond du micro, loyer au-dessus du plafond, PS BIC à confirmer).
- Le dossier imprimé reprend l'onglet Visite comme quatrième volet ; le lien de partage porte tout `ProjetEnregistre` (1,5 à 4 Ko aujourd'hui).
- Base de tests : 961 tests unitaires verts, 8 parcours Playwright ; `onglets.spec.ts` compte 7 cases à cocher sur le projet d'exemple.

## Analyse

- **Quoi** : une vraie liste de visite tirée d'une base d'environ 70 questions sourcées, filtrée par des règles sur le projet (type de bien, copropriété, année de construction, DPE, étage et ascenseur, mode d'exploitation, risques, travaux, feux). Chaque question a une catégorie, une réponse (à vérifier · OK · problème · sans objet) et une note, **conservées avec le projet**. Une poignée de questions « à valeur » remplissent une hypothèse (charges, taxe foncière, DPE, travaux votés…). « Marquer la visite comme faite » retire l'onglet de la navigation ; le compte rendu reste dans le dossier imprimé et voyage dans le lien de partage.
- **Pourquoi** : Camille visite debout, téléphone à la main. La liste d'aujourd'hui est courte (7 lignes), générique, et oublie tout à la fermeture de l'écran. Une liste longue quand il le faut (immeuble de 1962 en copropriété, courte durée en ville) et courte quand le bien est simple, dont les réponses nourrissent le rapport, remplace le carnet de notes et la relecture des guides de visite.
- **Pour qui** : Camille avant, pendant et après la visite ; le banquier ou le co-investisseur qui reçoit le dossier imprimé ou le lien.
- **Où** : `packages/moteur/src/visite/` (base et règles, pur), `apps/web/src/stockage/` (`ProjetEnregistre.visite`), `apps/web/src/ecrans/Visite.tsx` et `Rapport.tsx`, `FormulaireProjet.tsx` (Vérifier), `ProjetLayout.tsx` (onglets), `document/DocumentProjet.tsx` (impression), `Partage.tsx`, `textes/`, tests unitaires et Playwright, docs. Rien dans `apps/worker`, `apps/extension`, `data/`.

## Les cinq questions ouvertes de la fiche, tranchées

| #   | Question                                        | Décision (recommandation appliquée)                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Qui écrit la base ?                             | Claude rédige une première base d'environ 70 questions à partir des listes publiques (ANIL, Notaires de France, Service-public.fr pour le dossier de diagnostic technique, loi ALUR pour les pièces de copropriété, ADEME, Géorisques, Code du tourisme et loi Le Meur pour la courte durée, décret décence 2002-120). **Chaque question porte sa source** dans le code ; Pierre relit dans le fichier ou dans l'écran (la source s'affiche sous chaque question).                                        |
| 2   | Catégories                                      | Les sept de la fiche : Documents à demander · Diagnostics et travaux · Sur place, le logement · L'immeuble et la copropriété · Le quartier · Questions au vendeur ou à l'agence · Exploitation locative. Une catégorie sans question ne s'affiche pas.                                                                                                                                                                                                                                                    |
| 3   | Les réponses nourrissent-elles les hypothèses ? | Oui pour neuf questions « à valeur » : charges de copropriété (€/an), taxe foncière, DPE (deux variantes : classe à confirmer ou inconnue), travaux votés à payer (ajoutés aux travaux), année de construction, surface (Carrez), loyer en cours, charges récupérables sur le locataire, nombre de lots. Le champ apparaît sous la question, écrit par `appliquerSaisie` (mêmes descripteurs que l'onglet Hypothèses, provenance « à toi ») et passe la question à « OK ». Non pour le reste en v1.       |
| 4   | Visite faite : onglet disparaît ou compte rendu | L'onglet disparaît de la bande des volets. La route reste ouverte (lien du Rapport « Visite faite le 14 sept. · 3 problèmes ») et montre le compte rendu en lecture avec un bouton « Rouvrir la visite ». Le dossier imprimé garde un volet « Compte rendu de visite » s'il existe au moins une réponse ; sans réponse, le volet n'est pas imprimé. Visite non faite : le volet imprimé reste la liste « Préparer la visite », à cocher sur papier. Le lien de partage transporte l'état et les réponses. |
| 5   | Les points financiers restent-ils dans Visite ? | Non. Les cinq points financiers restent dans `Resultats.verdict.vigilance` et s'affichent dans le **Rapport**, sous les feux, dans une carte « Avant de faire une offre ». Les neuf autres deviennent des questions de la base, avec les mêmes conditions (les codes disparaissent du moteur ; `ResultatsSchema` ne change pas de forme).                                                                                                                                                                 |

## Outcomes

1. Sur le projet d'exemple (T3 de 1962 en copropriété, 3e sans ascenseur, meublé, DPE D, argiles), l'onglet Visite propose une cinquantaine de questions en sept groupes ; sur une maison récente louée nue, une trentaine. Amiante seulement avant 1997, plomb avant 1949, règlement de copropriété seulement en copropriété, changement d'usage seulement en courte durée, surface des chambres seulement en colocation.
2. Chaque réponse et chaque note sont enregistrées avec le projet ; fermer et rouvrir l'écran les retrouve ; la progression (« 12 sur 48 répondues, 2 problèmes ») est visible en haut.
3. Répondre « 1 450 € » à la question des charges met à jour le cash-flow du rapport, avec le badge « à toi ».
4. « Marquer la visite comme faite » (ou la case « J'ai déjà visité ce bien » au moment de créer le projet) retire l'onglet ; le dossier imprimé et le lien de partage gardent le compte rendu.
5. Le Rapport montre les points financiers à régler avant l'offre ; l'onglet Visite ne parle plus de HCSF ni de prélèvements sociaux.

## Périmètre

- **IN** : base de questions et règles dans `packages/moteur/src/visite/` (`questionsPourProjet(projet, resultats)`, 100 % couvert) ; seuils datés dans `regles/2026-09.ts` (amiante avant juillet 1997, plomb avant 1949, installations de plus de 15 ans, étage sans ascenseur dès le 3e, chambre de 9 m² en colocation) ; `ProjetEnregistre.visite` validé par Zod, migration douce ; écran Visite réécrit (groupes, quatre états, notes, champs à valeur, progression, « Marquer la visite comme faite », compte rendu, « Rouvrir ») ; Rapport : carte « Avant de faire une offre » et lien vers la visite ; Vérifier : case « J'ai déjà visité ce bien » ; `ProjetLayout` : onglet masqué ; impression : volet « Compte rendu de visite » ; partage : réponses dans le fragment, projet ajouté avec ses réponses ; textes Méthode mis à jour ; tests unitaires, Playwright (`onglets.spec.ts`, écran « Visite faite » dans `formats.ts`) ; docs.
- **OUT** : fiche 05 (types d'exploitation : les conditions colocation et moyenne durée sont écrites et testées mais injoignables tant que le mode n'existe pas), photos ou pièces jointes, rappel ou agenda de visite, synchronisation des comptes, compression du lien de partage (voir risques), sélecteur de statut lié à la visite (le statut « Visite prévue » reste à la main).

## Contraintes

- Le moteur reste pur : la base est une donnée typée, les conditions des prédicats sur `Projet` et sur les feux ; aucune phrase n'est composée avec un format monétaire dans le moteur (les gabarits portent des `{paramètres}` que le web formate).
- Aucune réponse n'est interprétée par le moteur : « problème » n'a pas d'effet sur les feux (règle 7 : pas de score magique). Seules les questions à valeur écrivent dans le projet, par les descripteurs existants.
- Une question retirée de la base plus tard laisse une réponse orpheline, ignorée à l'affichage : le stockage est un `Record<id, réponse>` et n'échoue jamais.
- Mobile d'abord (règle responsive) : quatre états en boutons de 44 px, champs de 16 px au doigt, équivalents `print:` du volet.
- Couverture 100 % sur `packages/moteur`, `apps/web/src/{stockage,textes,visite}` ; français, pas de tiret cadratin.

## Risques

| Risque                                              | Mitigation                                                                                                                                                                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lien de partage trop long avec 50 réponses et notes | Seules les réponses différentes de « à vérifier » sans note sont enregistrées ; notes limitées à 300 caractères ; test de taille au pire (toutes répondues, notes de 120 caractères) sous 20 Ko ; compression en réserve |
| Base trop longue pour un bien simple                | Conditions strictes ; les questions « pour tous » sont limitées aux gestes de visite ; comptage vérifié sur trois projets types dans les tests                                                                           |
| Sources approximatives                              | Chaque question cite un texte ou un site public ; ce qui vient de l'usage est cité « spec Deklic » ; Pierre relit la base                                                                                                |
| Réponse « à valeur » qui écrit une hypothèse fausse | Même validation Zod que l'onglet Hypothèses (`mettreAJour` refuse et affiche l'erreur) ; la valeur reste modifiable partout                                                                                              |
| Retirer neuf codes de `verdict.vigilance`           | Aucun autre module ne les lit (vérifié par recherche) ; tests du verdict et des textes mis à jour ; Méthode corrigée                                                                                                     |
| Fiche 05 plus tard                                  | `typeExploitation(projet)` est le seul point à changer ; les conditions colocation et moyenne durée sont testées avec un contexte forgé                                                                                  |

## Auto-validation critique

- **Gabarits avec paramètres dans le moteur, formatage dans le web** : la fiche met le texte dans le moteur ; le projet interdit les phrases formatées côté moteur. Les deux tiennent ensemble avec des gabarits (`{dpe}`, `{ecart}`, `{risques}`) résolus par `textes/visite.ts`. Une question sans paramètre est un texte plein.
- **Questions à valeur = descripteurs existants** : pas de second mécanisme d'écriture ; `appliquerSaisie` et `mettreAJour` garantissent la validation et la provenance. Le moteur ne cite que le chemin, le web retrouve le descripteur (test : chaque chemin existe).
- **Onglet masqué mais route ouverte** : masquer sans issue de secours condamnerait la personne qui a coché « déjà visité » par erreur. Le lien du Rapport et « Rouvrir la visite » la sauvent sans menu de plus.
- **Compte rendu imprimé seulement s'il y a des réponses** : un dossier de banque n'a pas besoin de 50 lignes « à vérifier ».

## Definition of Done

- [ ] `questionsPourProjet` : base d'environ 70 questions sourcées, conditions couvertes à 100 %, comptages sur trois projets types
- [ ] Stockage : `ProjetEnregistre.visite`, migration douce, partage aller-retour et taille au pire
- [ ] Écran Visite : groupes, quatre états, notes, champs à valeur, progression, visite faite, compte rendu, rouvrir
- [ ] Rapport : carte « Avant de faire une offre », lien vers la visite ; Vérifier : « J'ai déjà visité ce bien » ; onglet masqué ; impression ; partage
- [ ] Gates : lint, typecheck, tests, couverture 100 % (moteur, stockage, textes, visite), e2e mis à jour, vérification dans le navigateur
- [ ] Docs : `architecture/visite-questions.md`, registre, README, CLAUDE.md, fiche 07 « livrée » ; PR ouverte et armée en auto-merge
