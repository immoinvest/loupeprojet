# Feature Discovery : Hypothèses et financement (fiches 01 et 03)

## Demande

Deux fiches du backlog de Pierre (14/09/2026), traitées ensemble parce qu'elles touchent les mêmes fichiers (`apps/web/src/hypotheses/groupes-*.ts`, onglet Hypothèses) :

- **01 — Hypothèses : le financement.** « Les hypothèses liées au financement doivent être effectivement sur financement. Les revenus nets ne sont pas demandés, tu peux enlever. Et je veux un bouton qui redirigera vers une simulation de prêt, qui est un outil indépendant d'un projet en particulier, même si pour l'instant on ne va pas développer l'outil. »
- **03 — Hypothèses : retirer le bloc « Le marché ».** « DVF : retire cette partie-là, car elle est déjà couverte dans Estimation, donc pas besoin de l'avoir. »

## Ce qui existe

- L'onglet Hypothèses affiche sept cartes (`GROUPES`) : Le bien, Le marché, L'achat, Le financement, La location, Les charges, La fiscalité et la revente. La carte « Le marché » propose cinq chiffres DVF à taper à la main et le plafond d'encadrement des loyers ; son sous-titre « Bientôt rempli automatiquement » est faux depuis `enrichissement-marche` et `dvf-adresse` (l'onglet Estimation remplit `marche.dvf` d'un clic).
- La carte « Le financement » porte les huit hypothèses du prêt et **« Vos revenus nets »** (`hypotheses.revenusMensuels`), obligatoire dans le moteur, demandé aussi par le formulaire Vérifier. Il ne sert qu'au taux d'effort HCSF (`financement/effort.ts`), lu par le feu « effort » du verdict, par le point de vigilance `EFFORT_HCSF_DEPASSE`, par la phrase du verdict (« banque d'accord (effort 25 %) »), par la ligne « Effort bancaire » de Comparer et par la synthèse collante de l'onglet Hypothèses.
- Les résultats du financement (mensualité, TAEG, coût du crédit, tableau d'amortissement) existent tous dans `Resultats.financement` mais aucun écran ne les montre en détail : le Rapport n'affiche que « Crédit et assurance » dans la carte cash-flow.
- Le moteur calcule déjà un **taux de couverture** (`cashflow.tauxCouverture` = mensualité assurance comprise ÷ loyer hors charges), affiché nulle part.
- Le simulateur de prêt (fiche 08) est spécifié (`.product/specs/simulateur-pret-specs.md`, contrat du lien `#s=`) mais pas implémenté : ni `apps/web/src/simulateur/`, ni route `/simulateur-pret`.

## Décisions (questions ouvertes des fiches)

| #   | Question                                     | Décision                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | « Sur financement » = onglet ou carte ?      | **Onglet « Financement »** entre Estimation et Hypothèses (Rapport · Estimation · Financement · Hypothèses · Fiscalité · Revente · Visite), sur le modèle de Fiscalité et Revente : les hypothèses du prêt en haut, la lecture du prêt dessous (mensualité, TAEG, coût total, d'où vient l'argent, année par année). La carte « Le financement » quitte Hypothèses. À confirmer par Pierre ; option par défaut.                                                    |
| 2   | Que devient le feu « effort » sans revenus ? | Le feu devient **« couverture »** : mensualité assurance comprise ÷ loyer hors charges, sans donnée personnelle. Seuils dans `regles/2026-09.ts` : bon jusqu'à 70 % (la part des loyers que le HCSF retient comme revenu), à surveiller jusqu'à 100 % (le loyer couvre encore la mensualité), problème au-delà. Le taux d'effort HCSF reste calculé pour les projets déjà enregistrés qui portent des revenus ; son point de vigilance n'apparaît que dans ce cas. |
| 3   | Bouton « Simuler un prêt »                   | Lien vers `/simulateur-pret#s=…` selon le contrat de la fiche 08 (prix, honoraires, travaux, frais de notaire calculés, département ; une offre : apport, frais, taux, assurance, durée, différés, frais bancaires financés). En attendant la fiche 08, la route affiche une page « Bientôt » qui dit ce qui arrive et que le prêt du projet est déjà dans le lien. D'accord pour la voir en production : elle ne promet rien de daté.                             |
| 4   | Retirer les revenus de Comparer et du PDF ?  | Oui : la ligne « Effort bancaire » de Comparer devient « Crédit ÷ loyer » (le feu couverture) ; l'infobulle du bouton Partager ne parle plus de revenus. Le document imprimé gagne le volet Financement (dossier banque).                                                                                                                                                                                                                                          |
| 5   | Fiche 03 : saisie manuelle du repère DVF ?   | Non. La seule porte d'entrée du marché est l'onglet Estimation. `preparerDvf` (création du bloc DVF à la première saisie) disparaît avec la carte.                                                                                                                                                                                                                                                                                                                 |
| 6   | Fiche 03 : le plafond d'encadrement ?        | Déménage dans « La location », juste sous le loyer visé.                                                                                                                                                                                                                                                                                                                                                                                                           |

## Ce que ça change pour Camille

- Créer un projet ne demande plus ses revenus : une question intime de moins, et le rapport n'en avait pas besoin pour dire si le loyer porte le crédit.
- Un onglet « Financement » où elle règle son prêt et lit tout de suite ce qu'il coûte : mensualité, assurance, TAEG, coût total, d'où vient l'argent, tableau par année, différés.
- Le cinquième feu dit désormais « Crédit 84 % du loyer » : compréhensible sans la banque.
- Un bouton « Simuler un prêt » pour comparer des offres de banque hors de tout projet, pré-rempli avec son prêt.
- Hypothèses perd deux cartes (Le marché, Le financement) : il reste le bien, l'achat, la location, les charges, la fiscalité et la revente.

## Périmètre

- **IN** : moteur (`revenusMensuels` facultatif, `depasseHcsf` faux sans revenus, feu `couverture` et ses seuils, exemple sans revenus), web (onglet Financement, hypothèses de prêt éditables, lien `#s=`, page « Bientôt » `/simulateur-pret`, retrait des revenus de Vérifier / construction / défauts / textes / partage, Hypothèses sans Le marché ni Le financement, plafond dans La location, synthèse et Comparer sur la couverture, Méthode à jour, Financement dans le document imprimé), tests unitaires et e2e (`creerProjetManuel`, volet Financement, formats), docs.
- **OUT** : l'outil simulateur lui-même (fiche 08), la carte « Saisir mon propre repère » d'Estimation, la fiche 02 (hypothèses optionnelles), tout backend.

## Contraintes

- Le moteur reste pur ; aucun calcul dans les écrans : la couverture vient de `cashflow.tauxCouverture`, la simulation du lien se construit dans `analyses/` à partir de `Resultats`.
- Les projets déjà enregistrés se relisent tels quels (`revenusMensuels` reste accepté).
- Les résultats ne sont jamais persistés : renommer l'axe `effort` en `couverture` ne casse aucun stockage.
- Couverture 100 % sur le moteur et les dossiers listés dans `vitest.config.ts` (`analyses/`, `hypotheses/`, `stockage/`, `textes/`, `annonces/`…).
- Mobile d'abord, équivalent `print:` pour le volet Financement (imprimé), cibles de 44 px, ajout aux `ecransDeReference`.

## Risques

| Risque                                                               | Mitigation                                                                                                                                        |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Un projet ancien porte des revenus faibles : point HCSF sans champ   | Le point garde sa phrase explicite ; l'onglet Financement affiche la ligne « Effort bancaire (revenus indiqués à la création) » quand elle existe |
| Seuils de couverture non officiels                                   | Sourcés « Choix Deklic, alignés sur la part des loyers retenue par le HCSF (70 %) » et affichés dans Méthode                                      |
| Le lien `#s=` doit rester compatible avec la fiche 08                | Schéma Zod local copié du contrat, testé ; la fiche 08 remplacera le schéma local par celui du moteur                                             |
| `descripteurParChemin` appelé avec un chemin du prêt depuis un écran | Les descripteurs du prêt restent enregistrés dans un registre complet ; seul l'affichage de Hypothèses change                                     |
| Les tests d'écran comptent les cartes, les feux ou lisent « Effort » | Tous relus : `rapport.spec`, `hypotheses.spec`, `aides.ts`, `formats.ts`, tests de rendu                                                          |

## Auto-validation critique

- **Onglet plutôt que carte** : cohérent avec Fiscalité et Revente (une analyse = un onglet où l'on règle ses hypothèses), et les mêmes cartes serviront à la fiche 08. Le coût est un écran de plus à maintenir en mode document.
- **Couverture plutôt qu'« inconnu »** : garder cinq feux quoi qu'il arrive vaut mieux qu'un feu gris permanent ; la couverture répond à la question de Camille (« le loyer paie-t-il le crédit ? ») sans données personnelles.
- **Retirer vraiment les revenus** plutôt que les rendre facultatifs : c'est la demande ; un champ facultatif « pour la banque » reviendra si la fiche 02 ou un retour utilisateur le demande, le moteur est prêt.
- **Renommer l'axe** `effort` → `couverture` : plus clair que garder un nom trompeur ; rien n'est persisté.

## Definition of Done

- [ ] Gates verts : lint, typecheck, test:coverage (100 % moteur et dossiers listés), build
- [ ] Onglet Financement vérifié dans le navigateur (ordinateur et téléphone), impression avec le volet
- [ ] Vérifier sans revenus ; Hypothèses sans Le marché ni Le financement ; plafond dans La location
- [ ] Feu couverture dans Rapport, Comparer, Hypothèses (synthèse), Méthode
- [ ] Bouton « Simuler un prêt » : lien `#s=` décodable selon le contrat de la fiche 08 ; page « Bientôt »
- [ ] e2e : `creerProjetManuel`, `rapport.spec`, nouveau parcours Financement, formats
- [ ] Docs : architecture, registre, README, CLAUDE.md, fiches 01 et 03 → livrée, tableau du backlog
