# Feature Discovery : Quittances et fiches (G1b)

**Slug** : `quittances-fiches` · **Branche** : `feat/quittances-fiches` (worktree `loupe-gestion`, base `master` ca1d257) · **Date** : 2026-09-14 · **Épic** : `.product/features/gestion-locative-discovery.md` · **Précédente** : `gerer-socle` (G1a, PR #53)

## Demande d'origine

Pierre, 14/09/2026, après la fusion de G1a : « Allons-y pour la prochaine étape. La connexion au compte bancaire peut être faite plus tard (ce sera une validation manuelle pour le moment). »

Conséquence sur l'ordre de l'épic : G3 `banque` est repoussée. L'encaissement se valide à la main (« Reçu », livré en G1a). La feature suivante est donc **G1b**, qui rend cette validation manuelle complète : paiement partiel, quittance et reçu, loyers des autres mois, fiche du bien, export des données.

## Analyse

### Quoi

Ce qui manque à un bailleur qui gère ses loyers à la main avec Deklic, dans l'ordre de l'usage :

1. **Dire ce qui a été payé, exactement** : « Reçu en partie » (montant et date), « Reçu » à une autre date que le jour même ; le loyer passe « Partiel » puis « Reçu » quand le total est couvert.
2. **Remettre la quittance ou le reçu** : un document A4 conforme, figé et numéroté, à télécharger en PDF (impression du navigateur, comme le dossier d'analyse) ; l'identité du bailleur (nom, adresse) est demandée une seule fois.
3. **Voir un autre mois** : page Loyers avec un sélecteur de mois, groupes En retard, Partiels, Attendus, Reçus.
4. **Corriger et suivre un bien** : fiche bien (adresse, location en cours, frise des 12 derniers mois, « Voir l'analyse »), « Terminer la location », « Ajouter le locataire » sur un bien vacant.
5. **Emporter ses données** : « Exporter mes données de gestion » (JSON), qui ferme le point ouvert de l'audit de sécurité de G1a.

### Pourquoi

- Sans banque, le « Reçu » en un clic ne couvre que le cas parfait. Les paiements partiels et les retards de quelques jours sont courants ; la loi impose alors un **reçu**.
- La quittance est le document que les locataires demandent (caution, CAF, dossier de location) et la promesse d'origine de Pierre (« envoyer automatiquement les quittances de loyer »). G1b la produit ; G2 l'enverra par e-mail.
- Un bien dont le locataire part, ou qui est loué après sa création, bloque aujourd'hui l'usage : il faut pouvoir le faire évoluer sans le recréer.

### Pour qui

Pierre (plusieurs biens, validation manuelle en attendant la banque) et Camille (un bien, une quittance à fournir chaque mois).

### Où

`packages/gestion` (statut partiel, contenu et numéro des documents, fin de location), `apps/comptes` (paiements partiels, documents émis, identité du bailleur, fin de location, export ; migration D1 `0003`), `apps/web` (page Loyers, menu « … » d'un loyer, document hors coque, fiche bien, export dans Mon compte).

## Règles légales (sources officielles consultées le 14/09/2026)

| Règle                                                                                                                                                 | Source                                                                                                                    | Conséquence dans Deklic                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Quittance transmise **gratuitement** au locataire qui la demande ; elle porte **le détail des sommes versées en distinguant le loyer et les charges** | [Loi n° 89-462, art. 21](https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000028806698) (version du 27/03/2014)     | Loyer, charges et total sur des lignes séparées ; aucune option payante autour de la quittance                      |
| **Aucuns frais** liés à la gestion de l'avis d'échéance ou de la quittance facturés au locataire                                                      | Même article                                                                                                              | Rien à facturer ; rien à paramétrer                                                                                 |
| Transmission **dématérialisée** seulement **avec l'accord exprès du locataire**                                                                       | Même article                                                                                                              | G1b : le bailleur télécharge et remet lui-même le document ; l'envoi par e-mail et l'accord restent en G2           |
| Paiement partiel : le bailleur est **tenu de délivrer un reçu**                                                                                       | Même article                                                                                                              | Un loyer « Partiel » produit un **reçu** (pas une quittance) : montant reçu, date, reste dû                         |
| Bail mobilité : **aucun dépôt de garantie**                                                                                                           | [Loi n° 89-462, art. 25-17](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000037649098) (version du 25/11/2018) | Règle déjà appliquée en G1a (dépôt 0 en moyenne durée) ; le commentaire du code citait à tort l'art. 25-6 : corrigé |

Le modèle de quittance de l'ANIL ajoute l'usage de la mention « la présente quittance annule tous les reçus qui auraient pu être établis précédemment en cas de paiement partiel du montant du présent terme » : reprise sur la quittance d'un mois qui a d'abord été partiel.

## Outcomes

1. Un paiement partiel se saisit en **deux clics** depuis Loyers (menu « … », puis « Enregistrer ») et produit un reçu conforme.
2. Une quittance s'ouvre **en un clic** depuis un loyer reçu ; le même document (même numéro, même contenu) revient à chaque ouverture, même si le loyer change ensuite.
3. Tout mois passé ou futur se consulte ; aucun loyer n'est caché.
4. Un bien évolue sans être recréé : fin de location, nouveau locataire.
5. Toutes les données de gestion d'un compte s'exportent en un fichier.

## Outputs

1. `packages/gestion` : statut `partiel`, reste dû ; contenu d'un document (quittance ou reçu) calculé depuis la location, les paiements et l'identité du bailleur ; numéro de document ; règles de fin de location ; schémas Zod associés.
2. `apps/comptes` : `POST /paiements` accepte plusieurs paiements par mois tant que la somme reste ≤ au dû ; `PUT /bailleur` ; `POST /documents` (émission idempotente et figée) et `GET /documents/:id` ; `POST /locations/:id/fin` ; `POST /biens/:id/locations` (louer un bien vacant) ; `GET /export` ; migration `0003_gestion_documents.sql`.
3. `apps/web` : page `/gerer/loyers` (mois, groupes, actions), dialogue « Reçu en partie », document `/gerer/document/:id` hors coque (impression → PDF), identité du bailleur demandée à la première quittance, fiche `/gerer/biens/:id`, « Exporter mes données de gestion » dans Mon compte, lien Loyers dans la section Gérer du menu.

## Scope

### IN

- P0 : paiement partiel et autre date ; quittance et reçu figés, numérotés, imprimables ; identité du bailleur ; page Loyers par mois ; export JSON.
- P1 : fiche bien (lecture), terminer une location, louer un bien vacant.

### OUT (features suivantes)

- Colocation (bail unique à plusieurs, location par chambre), APL versée au bailleur, suppression d'un bien, pages Biens et Locataires en liste, modification d'une location (loyer, jour) → **G1c**.
- Envoi par e-mail, accord du locataire, « Loyer reçu ? », relances → G2.
- Révision IRL, dépôt de garantie restitué, préavis → G4. Banque → G3 (repoussée par Pierre).
- Parcours Playwright contre l'API réelle : toujours hors CI (le job `e2e` sert le site statique) ; preuve par tests de rendu et spec des formats avec réponses simulées, comme G1a.

## Contraintes

- **PDF par l'impression du navigateur** (CLAUDE.md, stack : « CSS `@media print` + impression navigateur, pas de service de rendu ») : même principe que `/projets/:id/imprimer` et `/simulateur-pret/imprimer`.
- **Documents figés** : le contenu d'une quittance émise est stocké côté serveur au moment de l'émission ; il ne se recalcule jamais.
- **Données personnelles** : le document contient le nom du locataire et l'adresse du logement ; il reste lié au compte (accès croisé 404), jamais dans les journaux ; l'identité du bailleur est la seule donnée nouvelle.
- **Migration `0002` pas encore appliquée en production** : `0003` s'applique à la suite ; même garde-fou (503 `GESTION_INDISPONIBLE` si une table manque).
- **Sessions parallèles nombreuses** : cinq fusions de `master` pendant G1a. Parade : fusionner `master` au début de chaque story web, pousser dès que la PR est prête, s'appuyer sur le check `verify` de la CI.
- Couverture 100 % : `packages/gestion`, `apps/comptes/src`, `apps/web/src/gestion`, textes.

## Risques

- **Unicité des paiements** : G1a refuse un second paiement du même mois (index unique). Le lever demande une migration SQLite (supprimer l'index) et une vérification de somme atomique côté serveur.
- **Numérotation** : un numéro par location et par mois (`AAAA-MM-<location>`), stable et sans compteur global à synchroniser ; un reçu puis une quittance du même mois ont des numéros distincts (suffixe).
- **Identité du bailleur absente** : bloquer la première quittance sans détour inutile (un seul écran, deux champs).
- **Taille de la session** : sept stories ; les P1 (fiche, fin de location, louer un bien vacant) peuvent passer en G1c si la session s'allonge, sans rien casser.

## Definition of Done

- [ ] Partiel puis complet : reçu puis quittance, numéros distincts, contenu figé (tests purs et d'API).
- [ ] Quittance conforme à l'art. 21 : loyer et charges distingués, gratuite, émise seulement quand le total est reçu.
- [ ] Deux clics pour un paiement partiel, un clic pour ouvrir une quittance (tests de rendu).
- [ ] Accès croisé 404 sur documents, identité, fin de location, export.
- [ ] Export JSON complet ; point ouvert de l'audit de G1a fermé.
- [ ] Écrans ajoutés à la spec des formats ; gates verts ; docs communes à jour ; PR fusionnée ; CI de `master` verte.

## Auto-revue (checkpoint validé par Claude, sur autorisation de Pierre)

- **G1b plutôt que G2 ?** G2 envoie des quittances : il faut d'abord les produire (G1b). La décision de Pierre (validation manuelle) rend G1b directement utile : c'est la quittance qu'il remettra lui-même.
- **Colocation repoussée en G1c** : elle change le modèle (plusieurs locataires, locations par chambre) et touche toutes les routes ; la mêler aux documents doublerait la session. Les biens en colocation créés depuis une analyse fonctionnent déjà comme une location unique au loyer total.
- **Pas de modification du loyer en G1b** : la règle « les documents émis ne changent pas » est garantie par le stockage figé ; la modification elle-même, avec le recalcul des loyers futurs, arrive avec la révision (G4) et G1c.
- **PDF par impression** : cohérent avec le reste de l'application et gratuit ; G2 devra produire le PDF côté serveur pour la pièce jointe (à trancher à son architecture).
- **Règles légales** : vérifiées sur Légifrance le jour même (articles 21 et 25-17), et non plus citées de mémoire ; l'erreur de citation de G1a est corrigée.
