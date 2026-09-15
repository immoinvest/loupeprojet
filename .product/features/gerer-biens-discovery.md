# Feature Discovery : Mes biens et vie de la location (G1c)

**Slug** : `gerer-biens` · **Branche** : `feat/gerer-biens` (worktree `loupe-gestion`, base `master` 79a35e1) · **Date** : 2026-09-14 · **Épic** : `.product/features/gestion-locative-discovery.md` · **Précédente** : `quittances-fiches` (G1b, PR #73)

## Demande d'origine

Pierre, 14/09/2026, après la fusion de G1b, en voyant le menu Gérer (« Ajouter un bien », « Loyers du mois », « Tous les loyers ») : il manque une entrée pour voir tous ses biens d'un coup d'œil. « Oui, crée-le dans la prochaine étape. Et commence la prochaine étape. Fais la PR uniquement lorsque toutes les autres PR : 65, 77, 78 sont mergées. »

Ordre choisi avec Pierre : **G1c avant G2**. G2 (quittances par e-mail) est bloquée en production tant que le domaine d'envoi n'est pas vérifié chez Resend (l'expéditeur par défaut `onboarding@resend.dev` n'écrit qu'au propriétaire du compte Resend) et demande une tâche planifiée. G1c n'a aucun prérequis et reprend ce que G1b avait repoussé (`.product/specs/quittances-fiches-specs.md`, « Won't (G1c) ») : pages Biens et Locataires en liste, modifier une location, supprimer un bien, APL versée au bailleur.

## Analyse

### Quoi

1. **Mes biens** : une page qui liste tous les biens, loués ou non (nom, adresse, état, locataires, loyer, loyer du mois), et une entrée « Mes biens » dans le menu Gérer. C'est la page Biens prévue par l'UX de l'épic (`.product/design/gestion-locative-ux.md`, menu : « Biens · 4 »).
2. **Mes locataires** : la liste des locataires (actuels puis anciens) avec leur bien, et la correction du nom et de l'e-mail. L'e-mail juste prépare G2.
3. **Modifier une location** : loyer hors charges, charges, jour du loyer, dépôt, libellé de chambre, à partir d'un mois donné ; les mois déjà passés et les documents émis ne changent pas.
4. **Supprimer un bien** : confirmation en tapant son nom ; ses locations, paiements et documents disparaissent ; l'export est proposé d'abord.
5. **APL versée au bailleur** : un montant mensuel sur la location ; le loyer attendu du locataire est le total moins l'aide ; la quittance distingue la part de la CAF et celle du locataire.

### Pourquoi

- Avec plusieurs biens (Pierre en a plusieurs, dont une colocation), Gérer ne montre aujourd'hui un bien que par ses loyers du mois ou la mention « Sans locataire » : un bien sans loyer ce mois-ci n'a pas d'entrée visible.
- Un loyer change (erreur de saisie, nouveau montant convenu) : aujourd'hui il faut recréer la location, ce qui casse l'historique.
- Un bien vendu ou créé par erreur ne peut pas être retiré.
- L'APL en tiers payant est courante chez les bailleurs particuliers ; sans elle, le loyer attendu du locataire est faux et la quittance aussi.

### Pour qui

Pierre (plusieurs biens, une colocation, suivi manuel en attendant la banque) et Camille (un bien, parfois un locataire aidé par la CAF).

### Où

`packages/gestion` (montants par période d'effet, APL, contenu des documents), `apps/comptes` (modifier une location et un locataire, supprimer un bien, APL ; migration D1 `0005`), `apps/web` (pages `/gerer/biens` et `/gerer/locataires`, formulaires sur la fiche du bien, menu, textes).

## Règles légales et pratiques (sources consultées le 14/09/2026)

| Règle                                                                                                                                                                                 | Source                                                                                                                                                                                                                                                                      | Conséquence dans Deklic                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| APL d'un locataire versée au bailleur (tiers payant) ; pour un bailleur de moins de 10 logements, **seulement s'il le demande**, sinon au locataire                                   | [CCH, art. D832-1 à D832-4](https://www.legifrance.gouv.fr/codes/id/LEGISCTA000038878768)                                                                                                                                                                                   | L'APL est facultative sur une location, vide par défaut ; elle ne concerne que le bailleur qui la reçoit                                                              |
| Le bailleur **déduit la part reçue de la CAF du loyer** demandé au locataire ; il signale un impayé dans les trois mois, le départ du locataire, et rembourse une somme perçue à tort | [CAF, rappel sur le tiers payant](https://www.caf.fr/professionnels/offres-et-services/caf-de-tarn-et-garonne/partenaires-locaux/vous-etes-bailleur/rappel-sur-le-tiers-payant) ; [CCH, art. L823-6](https://www.legifrance.gouv.fr/codes/id/LEGISCTA000038814922) (départ) | Loyer attendu du locataire = loyer + charges − APL ; « Terminer la location » rappelle de prévenir la CAF quand une APL est saisie                                    |
| La quittance mentionne le montant payé **après déduction de l'aide**                                                                                                                  | Guide du bailleur de la CAF (résumé de recherche ; le PDF n'a pas pu être lu ici) — **à confirmer**                                                                                                                                                                         | Lignes loyer, charges, total, « dont aide au logement versée par la CAF », « payé par le locataire » ; drapeau « à confirmer » dans le code comme les règles fiscales |
| Actions dérivant du bail prescrites par **trois ans** ; révision du loyer par le bailleur : un an                                                                                     | [Loi n° 89-462, art. 7-1](https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000028777184/) (version du 27/03/2014)                                                                                                                                                     | Supprimer un bien propose d'abord l'export (quittances et paiements utiles trois ans) ; la révision IRL reste en G4                                                   |
| Quittance : loyer et charges distingués ; reçu en cas de paiement partiel                                                                                                             | [Loi n° 89-462, art. 21](https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000028806698) (déjà appliqué en G1b)                                                                                                                                                        | Inchangé ; l'APL s'ajoute aux lignes existantes                                                                                                                       |

## Outcomes

1. Tous les biens d'un compte se voient sur une page, en **un clic** depuis le menu, avec leur état.
2. Un loyer modifié s'applique **à partir du mois choisi**, sans changer un mois passé ni un document émis.
3. Un bien se supprime en **deux clics** et une saisie de son nom, jamais par erreur.
4. Un locataire aidé par la CAF a un loyer attendu et une quittance justes.
5. L'e-mail d'un locataire se corrige sans recréer la location (prêt pour G2).

## Outputs

1. `packages/gestion` : montants d'une location par période d'effet (loyer, charges, APL) et règle « à partir de » ; loyer dû du mois qui lit le montant en vigueur ; APL déduite ; contenu de la quittance et du reçu avec l'APL ; schémas Zod des modifications ; résumé d'un bien pour la liste (état, locataires, loyer du mois).
2. `apps/comptes` : `PATCH /locations/:id` (montants à partir d'un mois, jour, dépôt, libellé), `PATCH /locataires/:id` (nom, e-mail), `DELETE /biens/:id` (cascade), APL dans la création et la modification ; `GET /etat` expose les périodes de montants ; export à jour ; migration `0005_gestion_montants.sql` (table des montants par période, reprise des montants actuels).
3. `apps/web` : page `/gerer/biens` (liste, lien vers chaque fiche, « Ajouter un bien »), page `/gerer/locataires`, entrées « Mes biens » et « Mes locataires » du menu Gérer, « Modifier » sur la carte d'une location, « Supprimer ce bien » en bas de la fiche, champ APL dans « Plus de détails » (ajouter, louer, modifier), APL sur la quittance imprimable.

## Scope

### IN

- P0 : Mes biens (page et menu) ; modifier une location à partir d'un mois ; supprimer un bien.
- P1 : APL versée au bailleur ; Mes locataires (liste, nom et e-mail).

### OUT (features suivantes)

- Envoi par e-mail, accord du locataire, « Loyer reçu ? », relances → **G2** (domaine d'envoi à vérifier par Pierre).
- Révision IRL, préavis, dépôt restitué, régularisation des charges → **G4**. Dépenses, cash-flow réel → **G5**. Banque → **G3** (repoussée).
- Supprimer un locataire seul, archiver un bien sans le supprimer, partage du loyer entre colocataires, attestation de loyer pour la CAF (backlog F de l'épic).
- Modifier les dates d'entrée ou de sortie d'une location (« Terminer la location » existe) ; modifier l'adresse d'un bien → à trancher aux specs selon l'effort (l'adresse est figée sur les documents émis).

## Contraintes

- **Loyers dus calculés, jamais stockés** (ADR de G1a) : changer le montant d'une location sans période d'effet réécrirait les mois passés. Les montants deviennent des périodes « à partir de » ; le mois en cours et les suivants prennent le nouveau montant, sauf un mois déjà payé en tout ou en partie.
- **Documents figés** (ADR-G8) : une quittance émise garde son contenu ; supprimer un bien supprime aussi ses documents, d'où l'export proposé avant.
- **Somme des paiements ≤ dû** (ADR-G11) : baisser un montant sous ce qui est déjà payé pour un mois est refusé.
- **Migration D1** : `0005` à appliquer en production par Pierre **avant la fusion** (même garde-fou 503 que 0002 et 0003) ; `0004` est déjà prise par `sync-projets`.
- **PR après #65, #77 et #78** (consigne de Pierre) : commits et push de la branche possibles avant, PR seulement quand les trois sont fusionnées.
- **Deux clics** (`deux-clics-simplicite`) et **survol commun** (`.product/design/design-guidelines.md`) pour tout nouvel élément cliquable.
- Couverture 100 % : `packages/gestion`, `apps/comptes/src`, `apps/web/src/gestion`, textes.

## Risques

- **Historique des montants** : c'est le vrai changement de modèle de G1c (une table de plus, lue par l'état, le calcul des loyers, les documents et l'export). Parade : une seule fonction pure « montants en vigueur pour un mois », testée d'abord, et une migration qui reprend chaque location existante en une première période.
- **APL et paiements** : la CAF verse à une autre date que le locataire. Garder un seul bouton « Reçu » qui enregistre le mois entier (part locataire et part CAF) ; « En partie » reste disponible. Le détail par payeur (source « caf ») se tranche aux specs.
- **Suppression** : action destructrice ; confirmation par le nom, bouton rouge, aucun raccourci ; le projet d'origine d'un bien acheté garde son statut « acheté » (seul le bien de Gérer disparaît).
- **Sessions parallèles** : trois PR ouvertes à attendre et d'autres fusions probables ; fusionner `master` avant la QA et juste avant la PR.

## Definition of Done

- [ ] « Mes biens » dans le menu ; la page liste tous les biens avec leur état (tests de rendu, un clic depuis le menu).
- [ ] Modifier un loyer à partir d'un mois : mois passés, mois payés et documents émis inchangés (tests purs, d'API et de rendu).
- [ ] Supprimer un bien : confirmation par le nom, cascade complète, accès croisé 404, export proposé (tests d'API et de rendu).
- [ ] APL : loyer attendu du locataire, statut du mois et quittance justes ; drapeau « à confirmer » sur la mention de la quittance.
- [ ] Mes locataires : liste et correction du nom et de l'e-mail.
- [ ] Migration 0005 testée sur la D1 simulée et appliquée en production par Pierre avant la fusion.
- [ ] Écrans ajoutés à la spec des formats ; gates verts ; docs communes à jour ; PR ouverte après la fusion de #65, #77, #78 ; fusionnée ; CI de `master` verte.

## Auto-revue (checkpoint validé par Claude, sur autorisation de Pierre)

- **G1c plutôt que G2** : choisi par Pierre le 14/09/2026 ; G2 dépend d'un domaine d'envoi qui n'existe pas encore.
- **Mes biens en P0** : c'est la demande explicite de Pierre ; la page réutilise l'état déjà chargé (`GET /etat`) et `etatDuBien` de G1b, sans nouvelle route.
- **Modifier une location en P0 plutôt que l'APL** : une erreur de loyer bloque tous les bailleurs ; l'APL n'en concerne qu'une partie. L'APL s'appuie sur les mêmes périodes de montants : la faire après évite de migrer deux fois.
- **Périodes d'effet plutôt que « modifier et recalculer »** : recalculer tous les mois contredirait les paiements déjà saisis et les documents figés ; la spec de l'épic (G1-8) le dit déjà (« les échéances payées et documents émis ne changent pas »).
- **Supprimer plutôt qu'archiver** : l'épic (G1-8) prévoit la suppression confirmée par le nom ; l'archivage est un confort, hors G1c.
- **Mention APL « à confirmer »** : la déduction est sourcée (CAF, CCH) ; la formulation exacte de la quittance ne l'est que par un résumé du guide CAF, d'où le drapeau, comme pour les taux fiscaux non vérifiés.
