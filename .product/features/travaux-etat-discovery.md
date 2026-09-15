# Discovery — `travaux-etat` (fiche de backlog 19)

Date : 15/09/2026 (session de nuit S5, auto-validée). Fiche : `.product/backlog/19-travaux-selon-etat.md`.

## Demande

Dès que l'état du bien est connu, Deklic propose un montant de travaux tiré d'un barème au m² (plus un supplément de rénovation énergétique pour un DPE F ou G), avec une fourchette bas / estimé / haut. La personne garde l'estimation, choisit bas ou haut en un clic, ou saisit son montant ; « Revenir à l'estimation » remet le calcul. Les projets existants ne changent pas.

## Résultats attendus (outcomes)

- Un premier investisseur ne laisse plus « 0 € de travaux » sur un bien à rafraîchir ou à rénover : coût total, prêt, rendement, fiscalité et revente en tiennent compte.
- Le montant est présenté comme un ordre de grandeur « hors aides, à confirmer par devis », jamais comme un devis.

## Livrables (outputs)

1. Règles datées `travaux` (`packages/moteur/src/regles/2026-09.ts`), drapeau « à confirmer », sources en commentaire et dans Méthode.
2. Moteur : `estimerTravaux`, `montantSelonChoix`, `recalerTravaux`, `choisirTravaux` ; `achat.travauxChoix` facultatif ; `Resultats.travaux` ; question de visite `TRAVAUX_ESTIMES_DEVIS`.
3. Web : recalcul dans `appliquerSaisie` et au choix de l'état dans l'onglet Estimation ; création d'un projet avec travaux estimés si l'état est connu ; carte Achat (détail, tuiles Bas · Estimé · Haut, saisie → « à toi », « Revenir à l'estimation ») ; formulaire Vérifier (travaux estimés dans le résumé « Estimé pour vous ») ; phrase sous l'état dans Estimation ; « dont travaux estimés » dans le coût total ; section Méthode « Les travaux ».

## Recherche de sources (discovery)

- **Aucun barème public officiel** du coût des travaux au m² selon l'état n'existe (ANAH, ONRE, ADEME consultés le 15/09/2026).
- ANAH, bilan 2024 : une rénovation d'ampleur MaPrimeRénov' coûte en moyenne **55 065 €** (aide moyenne 36 271 €), sans chiffre au m² ni surface : utile comme ordre de grandeur, pas comme barème.
- La fourchette « 200 à 450 €/m² » de rénovation énergétique attribuée à l'ADEME n'est citée que par des sites commerciaux (Travaux.com, Pretto, Sonergia) ; la publication d'origine n'a pas été retrouvée.
- ONRE (mai 2021) : 9 100 € de dépense moyenne par ménage entre 2016 et 2019, sans barème au m².
- Fourchettes de professionnels 2026 (Co'Building, Groupe R, Renovbox, Adora Économie) : rafraîchissement 150/220 – 700 €/m², rénovation complète 700/1 000 – 2 000 €/m².
- **Conclusion** : barème de la fiche retenu tel quel, « à confirmer », sources listées. Aucun chiffre inventé.

## Décisions (questions ouvertes de la fiche, propositions appliquées)

1. Valeur par défaut : la valeur du tableau (proche du bas) — à rafraîchir 400 €/m², à rénover 1 200 €/m², rénovation énergétique 250 €/m². Bas et haut = bornes relevées (150–700, 1 000–2 000, 200–500).
2. Bon état : 0 € estimé (haut de fourchette 150 €/m²).
3. Prix et travaux : on garde la décote de l'estimation de prix **et** les travaux ; vérifié : `estimerPrix` ne retire aucun montant de travaux (il place seulement le bien au premier quartile pour « à rénover »). Le texte l'explique.
4. DPE F/G + à rénover : moitié du supplément (`partSiARenover: 0.5`).
5. Maison et région : même barème, pas de coefficient ; mention dans Méthode.
6. Projets existants : rien ne change (`travauxChoix` absent = saisi) ; les tuiles de la carte Achat permettent d'adopter l'estimation en un clic.
7. Mobilier : hors périmètre (fiche à part si Pierre le souhaite).

## Contraintes

- Moteur pur, 100 % couvert ; aucun appel réseau ; TTC, hors aides ; arrondi à la centaine.
- `hypotheses.achat.travaux` reste la seule valeur lue par les calculs : aucun module de calcul ne change.
- Session parallèle : formulaire Vérifier livré par S3 (`formulaire-rapide`), onglet Estimation réécrit par S7 (une phrase seulement ici), Fiscalité par S4.

## Risques

- Barème faux → rendement, prêt et verdict faussés. Parades : « à confirmer », fourchette toujours visible, « à confirmer par devis », modifiable en un clic.
- Juridique : outil d'aide à la décision ; jamais présenté comme un devis.

## Auto-revue critique

- Le « même mécanisme que l'apport » de la fiche est inexact : l'apport n'est calculé qu'à la création. Ici le recalcul est réellement continu (`recalerTravaux`), ce qui répond mieux à la demande (« changer l'état change les travaux »).
- La surface est `bien.surface` (le projet ne distingue pas Carrez et habitable) : acceptable, dit dans Méthode.
- Risque de double compte prix/travaux assumé et expliqué (décision 3).
