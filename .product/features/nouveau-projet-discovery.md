# Feature Discovery + Specs : Nouveau projet (`/projets/nouveau`)

## Demande

« L'écran où j'ajoute un nouveau projet, soit à partir d'un lien d'annonce, soit avec des données manuelles, mais en favorisant le lien d'annonce. » (Pierre, 13/09/2026)

## Analyse

- **Quoi** : l'écran « Coller » de la spec. Un champ lien en tête ; l'app reconnaît le portail et l'identifiant. Comme l'extension (ADR-002) n'existe pas encore, la lecture de la page passe par le **texte de l'annonce collé**, extrait localement par règles (aucun serveur, aucun LLM). Un formulaire « Vérifier » pré-rempli suit, avec les six valeurs que seul l'utilisateur connaît (loyer visé, apport, durée, TMI, mode, revenus). La **saisie manuelle** (prix, surface, ville) est le repli, visuellement second.
- **Pourquoi** : sans cet écran, l'app ne sait analyser que l'exemple. C'est la porte d'entrée du produit.
- **Où** : `apps/web` (`src/annonces/`, écran `NouveauProjet`), route `/projets/nouveau`. Les boutons « Nouveau projet » y mènent.

## Ce que le lien permet aujourd'hui, et demain

| Étape                                 | Aujourd'hui                                                                                                                          | Avec l'extension (feature `extension`)   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| Résoudre (portail, id, URL canonique) | oui, dans le navigateur                                                                                                              | idem                                     |
| Capturer la page                      | **texte collé** par l'utilisateur                                                                                                    | lecture automatique de la page ouverte   |
| Extraire                              | règles locales (prix, surface, pièces, chambres, étage, ascenseur, DPE, CP/ville, année, charges, taxe foncière, honoraires, meublé) | données structurées + LLM pour les trous |
| Enrichir (DVF, ANIL…)                 | non (feature `enrichissement-marche`) : le feu « prix » reste « inconnu »                                                            | oui                                      |

L'écran est conçu pour que l'extension remplace seulement l'étape « capturer », sans refonte.

## Stories

| Story | Titre                 | Gherkin (résumé)                                                                                                                                                                                                                                                                                                                                                                  |
| ----- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-1  | `annonces/resoudre`   | URL LeBonCoin / SeLoger / Bien'ici / PAP / Logic-Immo → `{portail, id, urlCanonique}` sans paramètres de suivi ; URL inconnue → `null` ; texte qui n'est pas une URL → `null`                                                                                                                                                                                                     |
| US-2  | `annonces/extraire`   | texte → champs trouvés avec provenance `annonce` ; prix = plus grand montant ≥ 20 000 € ; surface, pièces (« 3 pièces », « T3 »), chambres, étage (« 3e étage », « rez-de-chaussée »), ascenseur (sauf « sans ascenseur »), DPE, CP + ville (« 13005 Marseille », « Marseille (13005) »), année, charges mensuelles, taxe foncière, honoraires, meublé ; texte vide → aucun champ |
| US-3  | `annonces/construire` | saisie vérifiée → `ProjetEntree` : département déduit du CP (2A/2B, DOM), taux du mois selon la durée, défauts sourcés (TF = 1 mois de loyer si absente, copro 25 €/m²/an si absente, PNO 150, comptable 420 au réel meublé, CFE 180), régime = LMNP réel si meublé sinon nu réel, provenance par champ, nom du projet                                                            |
| US-4  | Écran Nouveau projet  | champ lien en tête + badge du portail ; zone « texte de l'annonce » + bouton « Lire le texte » ; formulaire Vérifier pré-rempli avec badges de provenance ; bascule « Je n'ai pas de lien » vers la saisie manuelle ; validation (prix, surface, CP, loyer) ; « Créer le projet » → rapport ; les boutons « Nouveau projet » mènent ici                                           |

## Périmètre

- **IN** : ce qui précède ; badges `annonce` / `estimé` / `à toi` sur le formulaire ; message honnête sur l'extension à venir.
- **OUT** : lecture automatique de la page (extension), LLM, estimations de marché (DVF, ANIL), géocodage, photos, sauvegarde du texte de l'annonce (il n'est jamais stocké, seulement l'URL et l'id).

## Auto-validation critique

- Le risque produit : l'utilisateur colle un lien et s'attend à ce que tout se remplisse. L'écran dit clairement, sous le champ lien, que la lecture automatique arrive avec l'extension et propose le copier-coller en une ligne.
- Le texte de l'annonce n'est pas conservé (vie privée, ADR-002) : seuls les champs extraits entrent dans le projet.
- Les défauts d'estimation (TF, copro) sont grossiers et marqués `estimé` ; ils seront remplacés par l'enrichissement de marché.
