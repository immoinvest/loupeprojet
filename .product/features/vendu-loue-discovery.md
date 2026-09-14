# Discovery — vendu-loue

Date : 2026-09-14. Origine : analyse du dépôt `senegal972/fidi-etude-marche-app` (proposition 2 retenue par Pierre : « fais seulement le 2 »). Rien du code de FIDI n'est repris (dépôt sans licence) : seule l'idée d'une décote d'occupation.

## Le problème

Beaucoup d'annonces d'investissement vendent un bien **loué** (« vendu loué », « locataire en place », « bail en cours »). Les ventes DVF qui font notre estimation sont en grande majorité des biens **libres**, et DVF ne dit pas si le bien était occupé. Un bien loué se vend moins cher qu'un bien libre : l'acheteur ne peut ni l'habiter ni choisir son locataire ni fixer le loyer avant la fin du bail. Aujourd'hui l'estimation l'ignore : le feu « prix » juge trop sévèrement un prix affiché qui intègre déjà cette décote.

## Ce que l'utilisateur obtient

- **Lecture de l'annonce** : « vendu loué », « locataire en place », « bail en cours », « actuellement loué » cochent **Vendu loué : oui** (badge « annonce ») ; « vendu libre », « libre à la vente », « libre de toute occupation » cochent **non**. Quand l'IA lit l'annonce, un loyer actuel trouvé (`loyerActuel`, déjà renvoyé par le Worker) vaut aussi « oui ».
- **Formulaire Vérifier** et **Hypothèses** (carte « Le bien ») : champ **Vendu loué** oui / non, facultatif.
- **Onglet Estimation** : une ligne de correction **« Vendu loué » −10 %**, sa raison (« Locataire en place : un bien occupé se vend moins cher qu'un bien libre. »), sa source, et la case « Compter » pour l'ignorer, comme les autres corrections.
- **Rapport** : l'écart au prix estimé et le feu prix tiennent compte de la décote, sans rien de nouveau à lire.
- **Méthode** : la constante « Vendu loué », sa source et le drapeau « à confirmer ».

## Règle (datée, `regles/2026-09.ts`, à confirmer)

- Décote de **−10 %** du prix de marché, additionnée aux autres corrections (DPE, étage, extérieur).
- Sources :
  - DGFiP, fiche « L'évaluation des immeubles bâtis » (impots.gouv.fr) : l'état d'occupation est « le facteur juridique le plus important » ; une moins-value de taux variable affecte les immeubles occupés ; à défaut de ventes de biens occupés comparables, on applique un abattement sur la valeur du bien supposé libre ; pour une maison, cet abattement « ne paraît pas devoir excéder 40 % ».
  - Pratique des notaires et des professionnels : 10 à 20 % pour un bail d'habitation en cours, moins si le bail finit bientôt, plus si le loyer est bas ou le locataire protégé ; peu ou pas de décote sur les petites surfaces recherchées par les investisseurs.
- **−10 %** = bas de la fourchette courante (choix Deklic) : Camille achète en investisseur, souvent un petit logement, et la décote reste désactivable.

## Hors périmètre

- Décote modulée par la durée restante du bail, l'écart du loyer au marché, l'âge du locataire ou la surface (aucune source chiffrée).
- Pré-remplir le loyer du projet avec le loyer actuel lu dans l'annonce.
- Revente « libre » après départ du locataire (le module Revente ne change pas).
- Changement du Worker : le prompt et le contrat de `/extract` restent en version 3, aucun redéploiement.

## Contraintes et risques

- Taux unique « à confirmer », affiché avec sa source et désactivable (principes 4 et 5).
- Faux positifs de lecture (« idéal investisseur, possibilité de louer ») : les motifs restent stricts ; l'utilisateur voit et corrige le champ dans Vérifier.
- Aucun coût : aucun appel réseau nouveau, aucune donnée persistée en plus du booléen du bien.
