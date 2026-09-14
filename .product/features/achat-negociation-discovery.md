# Feature Discovery : Achat, négociation et travaux (fiche 04)

## Demande

Fiche `.product/backlog/04-achat-negociation-travaux.md` (Pierre, 14/09/2026) : « Sur l'achat, le prix affiché peut être négocié. J'aimerais un curseur qui monte le prix affiché, avec la possibilité de diminuer par rapport à la négociation qui a été faite. Ensuite, je ne sais pas à quoi sert la rénovation énergétique : enlève-la, ou explique-moi si c'est un intérêt. Enfin, les travaux sont optionnels et par défaut mis à zéro. »

## Ce qui existe

- Le moteur n'a **qu'un prix** : `achat.prix`, prix affiché honoraires inclus. Tout en découle : base des frais d'acquisition (DMTO, émoluments), montant emprunté, provision d'entretien, coût total des rendements, valeur de revente et prix d'acquisition de la plus-value, base amortissable du LMNP, écart avec l'estimation, feu prix, scénarios et prix cibles.
- La négociation existe comme **scénario** (« Levier 1 · Négocier » du Rapport : prix qui met le cash-flow à zéro, sinon −10 %), sans que l'utilisateur puisse fixer son propre montant.
- `travauxRenovationEnergetique` n'a **qu'un effet** : en nu au réel, année déficitaire, le déficit foncier imputable sur le revenu global passe de 10 700 € à 21 400 € (règle datée, jusqu'au 31/12/2027). Partout ailleurs la case ne change rien, mais elle est toujours affichée.
- `travaux` vaut déjà 0 par défaut ; la case reste visible avec « 0 » dans Hypothèses et « Travaux prévus » dans Vérifier.

## Analyse

- **Prix retenu.** Un seul nouveau champ, `achat.negociationTaux` (0 à 0,3, défaut 0), et une seule fonction `prixRetenu(achat)` = prix affiché × (1 − taux), arrondi à l'euro (à taux nul, le prix affiché tel quel). Elle remplace `achat.prix` dans les onze lectures du moteur. Les honoraires d'agence restent en euros : c'est le prix total affiché qui est négocié, l'agence garde ses honoraires (comportement le plus courant, à confirmer par Pierre). Le moteur expose `Resultats.achat` : prix affiché, prix retenu, taux et montant de la négociation, pour que l'interface n'ait rien à recalculer.
- **Stocker le taux, afficher le montant.** Le taux survit à une mise à jour du prix affiché et se compare d'un projet à l'autre ; le montant et le prix retenu sont affichés à côté du curseur, dans l'en-tête du projet et dans le Rapport (« Prix affiché 92 000 € · retenu 87 400 € (−5 %) »).
- **Curseur.** 0 à −15 % par pas de 0,5 %, avec le champ « Négociation » en % à côté (saisie précise, jusqu'à 30 %, pour une négociation hors norme). Pas de surenchère. Composant `Curseur` générique et accessible dans `apps/web/src/composants/`, que la fiche 06 (horizon de revente) reprendra.
- **Viser le prix estimé.** Quand `Resultats.estimation` existe et que son centre est sous le prix affiché, un bouton règle le curseur sur le taux (arrondi au pas de 0,5 %, plafonné à 15 %) qui amène le prix retenu au centre de l'estimation. Si le prix affiché est déjà sous l'estimation, le bouton disparaît et une phrase le dit.
- **Rénovation énergétique.** La règle est juste et datée : elle reste dans le moteur. La case n'apparaît que si `location.mode = nu` **et** `travaux > 0`, sous le libellé « Ces travaux font sortir le logement des classes E, F ou G » et une aide qui cite le plafond doublé (valeurs lues dans les règles, jamais recopiées).
- **Travaux repliés.** Dans Hypothèses, Travaux, Rénovation énergétique et Mobilier passent derrière un dépliant : fermé « + Ajouter des travaux » quand les travaux sont à 0 (le mobilier estimé est rappelé dans le résumé, pour ne rien cacher), ouvert « Travaux 6 000 € · mobilier 5 000 € » sinon. Dans Vérifier, « Travaux prévus » passe derrière le même « + Ajouter des travaux ». Pas de curseur à la création : on négocie une fois le rapport lu.
- **Scénarios.** `avecPrix(projet, prix)` fixe un prix retenu exact (négociation remise à 0) ; les prix cibles gardent leur écart au prix affiché (c'est ce que l'on négocie) ; le repli du levier « Négocier » devient −10 % du prix retenu.
- **Migration douce.** Les projets enregistrés passent par `ProjetSchema` à la lecture : champ absent = 0, rien à migrer. Un lien de partage ancien reste valide.

## Stories

| Story | Titre                          | Résumé                                                                                                                                                                                                                                            |
| ----- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-1  | Moteur : prix retenu           | `negociationTaux`, `prixRetenu`, `resumerAchat`, `tauxPourPrixRetenu` ; onze lectures remplacées ; `Resultats.achat` ; T3 Marseille inchangé au centime à taux 0 ; cas négocié vérifié à la main (DMTO sur le prix négocié, honoraires inchangés) |
| US-2  | Hypothèses : carte « L'achat » | Composant `Curseur` ; négociation (curseur + champ %), prix retenu et montant, « Viser le prix estimé » ; travaux et mobilier repliés ; rénovation énergétique conditionnelle avec aide                                                           |
| US-3  | Prix retenu partout            | Rapport (phrase et jauge), en-tête du projet, Mes projets, Comparer (indicateur « Négociation », prix au m² retenu), Revente, Adresse, document imprimé                                                                                           |
| US-4  | Vérifier, Méthode, e2e         | « + Ajouter des travaux » dans Vérifier ; Méthode (acquisition, crédit, scénarios, nu au réel, défauts) ; parcours Playwright                                                                                                                     |

## Périmètre

- **IN** : `packages/moteur` (schéma, `achat/`, financement, cash-flow, rendement, revente, estimation, verdict, scénarios, résultats, exemples, tests) ; `apps/web` (composant `Curseur`, Hypothèses, Vérifier, Rapport, en-tête, Mes projets, Comparer, Revente, Adresse, document, Méthode, textes, analyses, tests, e2e) ; docs.
- **OUT** : saisie de la négociation en euros (le taux se règle au curseur ou en %, le montant est affiché) ; surenchère ; extension, Worker, comptes, capture (aucun champ nouveau à lire dans une annonce) ; fiche 02 (hypothèses optionnelles) et fiche 06 (curseur d'horizon), qui reprendront `Curseur` et le dépliant.

## Contraintes

- Le moteur reste pur ; une seule fonction porte la règle ; aucune lecture directe de `achat.prix` ne subsiste hors de `achat/`, des scénarios (bornes de recherche, écart au prix affiché) et de l'exemple.
- Tests d'abord pour tout calcul : cas de référence inchangés à négociation nulle, cas négocié calculé à la main dans le test.
- Toute interaction de l'onglet Hypothèses passe par `appliquerSaisie` ; provenance « utilisateur » sur le taux.
- Couverture 100 % sur le moteur et sur `analyses/`, `hypotheses/`, `textes/` du web.
- Mobile d'abord (curseur de 44 px au doigt), équivalent `print:` (le curseur devient du texte en mode document), écrans de référence Playwright inchangés.
- Français, pas de tiret cadratin, moins de texte que de chiffres.

## Risques

| Risque                                                                    | Mitigation                                                                                                                                           |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Une lecture de `achat.prix` oubliée : deux prix dans un même rapport      | Recherche exhaustive (`achat.prix`, `.prix`), test d'intégration négocié qui vérifie financement, rendement, revente, estimation, verdict, scénarios |
| Arrondi du prix retenu qui change le cas de référence à taux nul          | À taux nul, `prixRetenu` rend `achat.prix` sans arrondi ; test d'égalité stricte des résultats                                                       |
| « Viser le prix estimé » hors des bornes du curseur                       | Arrondi au pas, plafond 15 %, bouton masqué si le prix est déjà sous l'estimation                                                                    |
| Sessions parallèles sur `HypothesesSchema` et Vérifier (fiches 01-03, 05) | Fusions de `master` fréquentes ; modifications localisées (nouveau champ en fin de `AchatSchema`, dépliant autour d'un seul champ dans Vérifier)     |
| Le mobilier estimé disparaît derrière le dépliant                         | Le résumé fermé rappelle « mobilier 4 875 € » ; le badge « estimé » reste sur le champ                                                               |

## Auto-validation critique

- **Taux plutôt que montant** : un montant en euros serait plus parlant mais deviendrait faux dès que le prix affiché change (annonce mise à jour, saisie corrigée) ; le taux reste vrai, et le montant est toujours affiché à côté.
- **Négociation sur le total affiché, honoraires fixes** : c'est la pratique la plus fréquente ; si Pierre préfère une négociation « nette vendeur » (honoraires proportionnels), il suffit de changer `prixRetenu` et `baseFraisAcquisition`, tout le reste suit.
- **Garder la rénovation énergétique** : 10 700 € × la tranche marginale en moins l'année 1 pour un bailleur en nu au réel avec de gros travaux, c'est un vrai levier ; la retirer aurait été une perte. La cacher quand elle ne joue pas répond à la gêne de Pierre.
- **Pas de curseur dans Vérifier** : deux clics pour un premier rapport ; la négociation vient après la lecture du verdict, là où « Viser le prix estimé » a un sens.

## Definition of Done

- [ ] Gates verts : lint, typecheck, tests fichier par fichier puis suite complète, `test:coverage` (100 % moteur et dossiers web listés), build
- [ ] T3 Marseille strictement inchangé à négociation 0 ; cas négocié vérifié à la main
- [ ] Hypothèses : curseur, champ %, prix retenu, Viser, dépliant travaux, rénovation conditionnelle ; vérifié dans le navigateur
- [ ] Rapport, en-tête, Mes projets, Comparer, Revente, Adresse, document : prix retenu ; Méthode à jour
- [ ] Docs : `specs`, `architecture`, `pipeline/achat-negociation.json`, registre, README, CLAUDE.md, fiche 04 et tableau du backlog → « livrée » ; PR ouverte et armée en auto-merge
