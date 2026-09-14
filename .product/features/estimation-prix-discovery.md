# Discovery — estimation-prix

Date : 2026-09-14. Demande de Pierre :

> « Active la prochaine étape, également sur les prix DVF. Tu dois considérer l'état du bien, donc la fourchette haute correspond à rénové, la fourchette basse à rénover, et également la date en prenant en compte l'évolution du marché qui baisse ou qui monte en fonction des années. Enfin, donne une estimation, une fourchette d'estimation pour le bien qui prend en compte d'autres éléments tels que les charges, si elles sont élevées ou pas, est-ce que c'est un rez-de-chaussée, est-ce qu'il y a un ascenseur… Tu peux prendre comme exemple les simulateurs estimateurs de prix, mais en étant très transparent sur la data dont les DVF, ce qui n'est pas le cas pour ces applications. »

## Découpage

La demande couvre deux features. Elles sont livrées l'une après l'autre, chacune dans sa PR :

1. **`estimation-prix`** (ce document) : tendance du marché mesurée sur les DVF, état du bien, corrections chiffrées et sourcées, fourchette d'estimation, indice de confiance.
2. **`marche-complet`** (ensuite) : loyer visé ANIL, DPE ADEME retrouvé par l'adresse, risques Géorisques, communes limitrophes. Le DPE qu'elle ramènera nourrira directement l'estimation.

## Ce que l'utilisateur obtient

Dans l'onglet « Adresse » (renommé « Estimation »), et en résumé dans le Rapport :

- **Une fourchette de marché** : bas = bien à rénover, haut = bien rénové, lus sur les ventes comparables.
- **Des prix remis à la date du jour** : chaque vente passée est actualisée par l'évolution des prix mesurée localement sur 5 ans de DVF. Une courbe montre si le marché monte ou baisse.
- **Une estimation du bien** : la position dans la fourchette selon l'état, puis des corrections listées une par une, chacune avec son pourcentage, sa raison et sa source.
- **Une fourchette d'estimation et un indice de confiance** : plus il y a de ventes proches et récentes, plus la fourchette est serrée.
- **Le prix affiché comparé à l'estimation** : le feu « prix » du verdict compare au prix estimé du bien, et non plus à la seule médiane.

## Transparence (ce que les estimateurs ne montrent pas)

- Nombre de ventes utilisées, leur distance, leur date, leur prix brut et leur prix actualisé.
- Période de référence de l'actualisation et zone de la tendance (commune ou département).
- Chaque correction : coefficient, source, date de l'étude, drapeau « à confirmer » quand la source est ancienne ou partielle.
- Ce que les DVF ne disent pas (état, étage, ascenseur, DPE) est écrit noir sur blanc.

## Sources relevées (septembre 2026)

| Correction                      | Valeur retenue                                                                                                             | Source                                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Tendance du marché              | Médiane €/m² par semestre, 2021-2025                                                                                       | DVF géolocalisées (Etalab), calcul Deklic                                                               |
| État du bien                    | Rénover = 1er quartile, rafraîchir = entre 1er quartile et médiane, bon état = médiane, rénové = 3e quartile               | Choix Deklic (DVF ne connaît pas l'état), conforme à la demande de Pierre                               |
| DPE, appartements               | A +16 %, B +12 %, C +6 %, D 0, E −4 %, F et G −12 % par rapport à D (F n'est pas publiée à part : l'écart de G est repris) | Notaires de France, « La valeur verte des logements en France sur les transactions 2024 », janvier 2026 |
| DPE, maisons                    | F et G −25 % par rapport à D (F reprend G) ; autres classes non publiées, sans correction                                  | Même étude                                                                                              |
| Étage, province, avec ascenseur | Référence 2e étage ; RDC −9,9 % ; 4e +4 %                                                                                  | MeilleursAgents, juin 2017, relayé par SeLoger                                                          |
| Étage, province, sans ascenseur | Référence 2e étage ; RDC −9,6 % ; 3e −0,9 %                                                                                | Même étude                                                                                              |
| Balcon ou terrasse              | +8,8 % (11 plus grandes villes) ; Marseille +15,9 %                                                                        | MeilleursAgents, mai 2020                                                                               |
| Charges de copropriété          | Repère 26 €/m²/an (France), 29 €/m²/an (PACA), 26 €/m²/an (Marseille)                                                      | Observatoire ARC/UNARC relayé par Le Comptoir de la copropriété, 2024                                   |

Les coefficients viennent d'études d'économétrie hédonique (prix toutes choses égales par ailleurs). Ils sont versionnés dans les règles du moteur et affichés dans la page Méthode.

## Charges : comment elles jouent

Un excédent de charges est un coût annuel permanent pour l'acheteur. L'estimation le capitalise au rendement locatif brut local (loyer ANIL ou loyer du projet, rapporté au prix au m² du marché) :

décote = (charges annuelles du bien − repère × surface) ÷ rendement brut local

La correction est bornée à ±15 % du prix, par prudence (choix Deklic affiché).

## Hors périmètre

- Pas de modèle de langage pour estimer (principe 1 : le LLM lit, il ne calcule jamais).
- Pas de coefficients modifiables par l'utilisateur en v1. Il modifie les caractéristiques du bien : état, étage, ascenseur, DPE, extérieur, charges.
- Pas de régression locale sur la surface : les comparables restent filtrés à ±40 % de surface.
- Les champs lus dans l'annonce gagnent l'état et l'extérieur (règles et IA).

## Risques

- **Double compte état / DPE** : un bien rénové a souvent un meilleur DPE. Le texte le signale et chaque correction peut être désactivée pour ce projet.
- **Effet de composition** : la médiane par semestre bouge aussi quand le type de biens vendus change. Seuils de ventes par semestre, repli sur le département, nombre de ventes affiché.
- **Coût** : aucun appel payant. Les données publiées doublent de volume (5 ans lus au lieu de 3 pour la tendance) mais restent sous le quota gratuit R2.
