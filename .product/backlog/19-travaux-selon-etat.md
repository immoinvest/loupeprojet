# 19 — Travaux estimés selon l'état du bien

Statut : `livrée` (15/09/2026, feature `travaux-etat`) · Discovery : [travaux-etat-discovery.md](../features/travaux-etat-discovery.md) · Specs : [travaux-etat-specs.md](../specs/travaux-etat-specs.md) · Architecture : [travaux-etat.md](../architecture/travaux-etat.md) · Notée le 14/09/2026 · Dépend de : 04 (travaux facultatifs, livrée), estimation-prix (état du bien, livrée) ; lien avec 13 (formulaire) et 17 (liens)

## La demande de Pierre

> Dans les hypothèses, je veux qu'en fonction de l'état du bien, il y ait un montant de travaux prédéfini selon des règles tirées des bonnes pratiques d'estimation des travaux ; l'utilisateur peut ensuite le changer si besoin.

## Ce qui a été livré

- Règles datées `travaux` (`packages/moteur/src/regles/2026-09.ts`), « à confirmer » : rénové 0 ; bon état 0 (jusqu'à 150 €/m²) ; à rafraîchir 400 €/m² (150 à 700) ; à rénover 1 200 €/m² (1 000 à 2 000) ; DPE F ou G : + 250 €/m² (200 à 500), moitié pour un bien à rénover ; arrondi à la centaine ; TTC, hors aides.
- Moteur : `estimerTravaux`, `recalerTravaux`, `choisirTravaux`, `achat.travauxChoix` facultatif (absent = saisi), `Resultats.travaux`, question de visite `TRAVAUX_ESTIMES_DEVIS`.
- Web : projet créé avec les travaux estimés, recalcul quand l'état, la surface ou le DPE changent, tuiles Bas · Estimé · Haut et « Revenir à l'estimation » (carte Achat), phrase sous l'état (onglet Estimation), « Travaux estimés » dans le coût total, section Méthode « Les travaux ».

## Décisions prises (questions ouvertes, propositions de la fiche)

1. Valeur par défaut : valeur du tableau, proche du bas de la fourchette.
2. Bon état : 0 €.
3. Prix et travaux : décote de l'estimation de prix **et** travaux, avec explication.
4. DPE F/G + à rénover : moitié du supplément.
5. Maison et région : même barème, mention seulement.
6. Projets existants : rien ne change ; la carte Achat propose l'estimation en un clic.
7. Mobilier : hors périmètre.

## Sources relevées (14 et 15/09/2026)

- Aucun barème officiel national au m² selon l'état (ANAH, ONRE, ADEME consultés).
- ANAH, bilan 2024 : 55 065 € de travaux en moyenne par rénovation d'ampleur MaPrimeRénov'.
- Fourchettes de professionnels : [Co'Building](https://www.co-building.fr/prix-renovation-appartement-m2-2026/), [Groupe R](https://groupe-r.fr/entreprise/prix-renovation-m2/), [Adora Économie](https://adora-economie.fr/prix-renovation-m2-2026.html), [La Maison Saint-Gobain](https://www.lamaisonsaintgobain.fr/guides-travaux/renovation-maison/quel-prix-pour-une-renovation-de-maison), [Renovation-artisan](https://www.renovation-artisan.com/prix-dune-renovation-au-m2/), [Renovbox](https://renovbox.fr/prix/renovation/appartement/).
- Rénovation énergétique (chiffres attribués à l'ADEME, publication d'origine non retrouvée) : [Travaux.com](https://www.travaux.com/energie-renouvelable-diagnostic/guide-des-prix/prix-dune-renovation-energetique), [Selectra](https://selectra.info/energie/renovation-energetique), [OneDPE](https://onedpe.fr/fr/blog/travaux-passer-f-g-a-d-scenarios).

## Reste à Pierre

Valider ou changer le barème « à confirmer » ; décider d'une fiche « mobilier estimé » et d'un coefficient maison ou région si une source apparaît.
