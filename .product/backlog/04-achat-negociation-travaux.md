# 04 — Achat : curseur de négociation, « rénovation énergétique », travaux facultatifs

Statut : `livrée` (feature `achat-negociation`, 14/09/2026, PR `feat/achat-negociation` ; discovery `../features/achat-negociation-discovery.md`, specs `../specs/achat-negociation-specs.md`, architecture `../architecture/achat-negociation.md`) · Notée le 14/09/2026 · Dépend de : rien (la fiche 02 reprend la partie « travaux facultatifs »)

Décisions prises : le **taux** de négociation est stocké (`achat.negociationTaux`, 0 à 30 %, défaut 0), le montant et le prix retenu sont affichés ; la négociation porte sur le prix total affiché, les honoraires d'agence restent en euros ; curseur 0 à −15 % par pas de 0,5 % avec un champ % à côté (jusqu'à 30 %), pas de surenchère ; « Viser le prix estimé » règle le curseur (arrondi au pas, plafond 15 %) et disparaît si le prix affiché est déjà sous l'estimation ; le prix retenu remplace le prix affiché dans tout le moteur et dans l'en-tête, Mes projets, Comparer (indicateur « Négociation »), Revente, Adresse et le document ; la règle « rénovation énergétique » reste dans le moteur, la case n'apparaît qu'en location nue avec des travaux ; travaux et mobilier repliés derrière « + Ajouter des travaux » (Hypothèses et Vérifier) ; pas de curseur à la création ; migration douce (champ absent = 0).

## La demande de Pierre

> Sur l'achat, le prix affiché peut être négocié. J'aimerais un curseur qui monte le prix affiché, avec la possibilité de diminuer par rapport à la négociation qui a été faite. Ensuite, je ne sais pas à quoi sert la rénovation énergétique : enlève-la, ou explique-moi si c'est un intérêt. Enfin, les travaux sont optionnels et par défaut mis à zéro.

## Ce qui existe aujourd'hui

- Carte « L'achat » de l'onglet Hypothèses (`GROUPE_ACHAT`, `apps/web/src/hypotheses/groupes-bien.ts`) : prix affiché, honoraires d'agence, honoraires à la charge de l'acquéreur, travaux, rénovation énergétique (oui/non), mobilier.
- Le moteur (`packages/moteur/src/schema/hypotheses.ts`, `AchatSchema`) n'a **qu'un seul prix** : `achat.prix`, « prix affiché, honoraires inclus s'ils sont à la charge de l'acquéreur ». Tout en découle : frais d'acquisition (DMTO), montant emprunté, rendements, plus-value, feu prix.
- La négociation existe déjà comme **scénario** : « Levier 1 · Négocier » dans le Rapport (`r.scenarios`, code `negocier`) montre le cash-flow et le TRI à un prix négocié calculé par le moteur, sans que l'utilisateur puisse choisir le montant.
- `travaux` a déjà un défaut à 0 dans le schéma et le champ « Travaux prévus » de Vérifier n'est pas obligatoire (`FormulaireProjet.tsx`, ligne 101). Dans Hypothèses, la case affiche « 0 ». L'onglet Estimation demande l'**état** du bien (à rénover… rénové), indépendant du montant des travaux.
- `travauxRenovationEnergetique` (`AchatSchema`, ligne 12) ne sert qu'à **une** chose : en **location nue au réel**, quand l'année 1 est déficitaire, le déficit foncier imputable sur le revenu global passe de **10 700 € à 21 400 €** si les travaux sont une rénovation énergétique qui fait sortir le logement des classes E, F ou G (`packages/moteur/src/fiscalite/nu-reel.ts`, lignes 45-47 ; règle `deficitFoncier.plafondRenovationEnergetique` dans `regles/2026-09.ts`, notée « jusqu'au 31/12/2027 »). Hors de ce cas précis (meublé, micro-foncier, ou pas de déficit, ou travaux < 10 700 €), la case n'a aucun effet.

## Ce que ça changerait pour l'utilisateur

- Sous le prix affiché, un curseur « Négociation » (0 à −15 %, ou un montant en euros) : le prix retenu se met à jour et tout le rapport suit (frais de notaire, prêt, rendement, feu prix, plus-value). Le Rapport dit « Prix affiché 92 000 € · retenu 87 400 € (−5 %) ».
- La case « Rénovation énergétique » disparaît de la vue courante et n'apparaît que quand elle peut jouer (nu, avec des travaux), sous un libellé compréhensible.
- Les travaux restent à 0 par défaut, sans rien à faire ; on les ajoute seulement si on en prévoit.

## Questions ouvertes

1. **Que stocke-t-on ?** Le taux de négociation (proposition, `achat.negociationTaux`) ou le prix négocié en euros ? Le taux survit à une mise à jour du prix affiché par l'annonce et se compare d'une annonce à l'autre ; le montant est plus parlant. Proposition : stocker le **taux**, afficher les deux, accepter la saisie des deux (on convertit).
2. **Le prix affiché devient-il non modifiable** (il vient de l'annonce, badge « annonce ») ou reste-t-il éditable pour la saisie manuelle ? Proposition : éditable, badge de provenance inchangé.
3. **Bornes du curseur** : 0 à −15 % par pas de 0,5 % ? Une négociation au-dessus du prix affiché (surenchère) est-elle utile ? Proposition : non.
4. **Lien avec Estimation** : bouton « Viser le prix estimé » qui règle le curseur pour atteindre le centre de l'estimation ; et le Levier 1 « Négocier » du Rapport pourrait devenir « appliquer cette négociation ». À inclure ?
5. **Rénovation énergétique** : garder la règle dans le moteur (elle est juste et datée) et ne l'afficher que si `location.mode = nu` **et** `travaux > 0`, libellé « Ces travaux font sortir le logement des classes E, F, G (déficit foncier doublé) » — ou la retirer tout à fait ? Recommandation : la garder cachée ; elle vaut 10 700 € × TMI d'impôt en moins l'année 1 pour le bon profil.
6. **Travaux** : le comportement demandé (facultatif, 0 par défaut) est déjà celui du code ; qu'est-ce qui gêne concrètement ? La case visible avec « 0 » dans Hypothèses ? Proposition : la replier derrière « + Ajouter des travaux » avec le mobilier, dans le même esprit que la fiche 02.

## Pistes techniques et impact

- **Moteur** : `AchatSchema.negociationTaux` (0 à 0,3, défaut 0) ; une fonction `prixRetenu(achat)` utilisée partout où `achat.prix` l'est aujourd'hui (acquisition, financement, rendement, plus-value, estimation, feu prix, scénarios) ; `Resultats` expose `achat.prixAffiche`, `achat.prixRetenu`, `achat.negociation`. Tests : cas « Projet 92K » à négociation 0 inchangé au centime ; cas négocié vérifié à la main (DMTO sur le prix négocié, honoraires inchangés en euros).
- **Web** : type de champ `curseur` dans `hypotheses/conversion.ts` et `ChampHypothese` (`<input type="range">` + saisie), Rapport (CartePrix : affiché → retenu), Vérifier (pas de curseur à la création ; ou si, sous le prix ?), Méthode (section acquisition), Comparer (indicateur « négociation »).
- **Attention** : le prix affiché « honoraires inclus » — la négociation porte sur le prix net vendeur ou sur le total ? Proposition : sur le total affiché, honoraires en euros inchangés (à confirmer par Pierre, c'est ce que fait un acquéreur en pratique : il négocie le prix, l'agence garde ses honoraires… ou pas).
- **Coût** : aucun appel réseau.
