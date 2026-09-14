# Discovery — location-types : choisir le type d'exploitation, puis seulement ses champs

Fiche de backlog : `.product/backlog/05-location-types-exploitation.md` (Pierre, 14/09/2026). Discovery rédigée le 14/09/2026, session `feat/location-types`.

## 1. La demande

Pierre veut que le **type d'exploitation** soit la première question de la carte « La location » (Hypothèses) et de l'écran Vérifier, en boutons, et que seuls les champs du type apparaissent : loyer par chambre × chambres en colocation, nuitée × nuitées par mois en courte durée, avec des défauts propres à chaque type (vacance, gestion, charges). Son Excel « Projet 92K » met déjà côte à côte une colocation meublée (460 € × 4 chambres) et une courte durée (nuitée 50 €, 10 / 15 / 20 nuits par mois avec 3 / 4 / 5 séjours, ménage 27 € par séjour, énergie 190 €/mois et internet 30 €/mois à la charge du propriétaire).

## 2. Ce qui existe

- Moteur : `ModeLocationSchema` = `meuble_lld` | `nu` | `courte_duree` ; courte durée dans un sous-objet `courteDuree` (nuitée, **taux d'occupation**, ménage **par nuit**, conciergerie, tourisme classé). La conciergerie et le ménage sont retranchés des recettes (donc de la base micro-BIC, ce qui sous-estime cet impôt). `chargesLocataire` n'est utilisé nulle part dans les calculs.
- Quatre régimes projetés pour tout projet ; les régimes nus d'un bien meublé prennent `loyerHcNu` ou loyer ÷ 1,15.
- Colocation = scénario « Levier 2 » seulement (loyer total +35 %, 4 semaines de vacance, meublé).
- Vigilance : rien de propre au type de location.
- Web : mode en liste déroulante au milieu de la carte « La location », champ « Mode de location » dans la carte « Vous » de Vérifier ; la lecture d'une annonce lit un booléen `meuble` (règles, IA, portails) qui n'est **pas** relié au mode du formulaire.

## 3. Résultats attendus

1. Cinq types d'exploitation, chacun avec ses seuls champs : **nue**, **meublée** (longue durée), **colocation**, **courte durée**, **moyenne durée** (bail mobilité).
2. Recettes, charges, fiscalité, scénarios, verdict et vigilance suivent le type.
3. Les projets déjà enregistrés (et les liens de partage) continuent de se charger : migration silencieuse.
4. Aucun chiffre inventé : chaque défaut et chaque règle sont sourcés et datés dans `regles/2026-09.ts` ou marqués « à confirmer », visibles dans la Méthode.

## 4. Décisions de périmètre (questions ouvertes de la fiche)

| #   | Question     | Décision (recommandation appliquée, à trancher par Pierre)                                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Types v1     | Les cinq du tableau. Pas de type « meublée étudiante » : c'est une meublée avec plus de vacance (8 à 10 semaines) ; la Méthode le dit, la vacance se saisit.                                                                                                                                                                                                                                                   |
| 2   | Courte durée | **Nuitées par mois** + **durée moyenne d'un séjour** (nuits) → nombre de séjours ; frais de ménage **par séjour**, facturés au voyageur (recette) et payés au prestataire (charge). Le taux d'occupation n'est plus saisi : il est affiché en lecture dérivée (nuitées ÷ 30,4). Pas de profil saisonnier en v1 : une moyenne mensuelle.                                                                        |
| 3   | Colocation   | Un **loyer par chambre unique** × nombre de chambres louées, un **forfait de charges comprises par chambre** (recette), et des **charges propriétaire** (énergie, internet, en €/mois) proposées d'office en colocation, courte et moyenne durée, à 0 ailleurs.                                                                                                                                                |
| 4   | Régimes      | Onglet Fiscalité limité aux régimes **compatibles** : nue et meublée gardent les quatre (la comparaison « et si je louais nu / meublé » a un sens) ; colocation, courte et moyenne durée n'ont que micro-BIC et réel LMNP. « Loyer si loué nu » n'existe qu'en meublée. Le moteur calcule toujours les quatre (contrat de sortie inchangé) mais expose `compatibles`, et refuse un régime retenu incompatible. |
| 5   | Loyer ANIL   | Par m² en nue, meublée et moyenne durée (prime meublé +15 %) ; en colocation, loyer meublé × (1 + prime colocation 35 %, règle existante) ÷ chambres ; en courte durée, rien (pas de donnée publique).                                                                                                                                                                                                         |
| 6   | Levier 2     | Devient « Et si je passais en colocation » construit avec les nouveaux champs (loyer par chambre, vacance, charges propriétaire) ; disparaît quand le projet est déjà une colocation.                                                                                                                                                                                                                          |

## 5. Sources vérifiées (14/09/2026)

| Règle                                              | Source                                                                                                                  | Ce qu'on en retient                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Micro-BIC des meublés de tourisme                  | Loi n° 2024-1039 du 19/11/2024 (« Le Meur »), CGI art. 50-0 ; economie.gouv.fr                                          | Non classé : abattement 30 %, plafond 15 000 € ; classé : 50 %, plafond 77 700 € (revenus 2025) puis 83 600 € (2026-2028). Déjà dans les règles (`microBic`), inchangé.                                                                                                                                                  |
| Changement d'usage                                 | CCH art. L. 631-7 ; loi Le Meur                                                                                         | Autorisation obligatoire dans les communes de plus de 200 000 habitants et les Hauts-de-Seine, Seine-Saint-Denis, Val-de-Marne ; toute commune peut l'instaurer par délibération ; enregistrement national obligatoire ; résidence principale limitée à 120 jours (90 sur décision de la commune). → point de vigilance. |
| DPE des meublés de tourisme                        | Loi Le Meur                                                                                                             | Classe E au moins pour une nouvelle autorisation de changement d'usage, D pour tous les meublés de tourisme au 1er janvier 2034. → point de vigilance quand le DPE est E, F ou G.                                                                                                                                        |
| Bail mobilité                                      | Loi n° 89-462, art. 25-12 à 25-18 (loi ELAN du 23/11/2018)                                                              | Meublé, 1 à 10 mois, non renouvelable, locataire en études, formation, stage, service civique, mutation ou mission ; pas de dépôt de garantie ; **charges au forfait**. Fiscalité BIC classique. → point de vigilance + forfait de charges dans le modèle.                                                               |
| Décence en colocation                              | Loi n° 89-462, art. 8-1 (ALUR, ELAN) ; décret n° 2002-120                                                               | Baux individuels : chaque chambre 9 m² et 20 m³ au moins. → point de vigilance avec la surface moyenne par chambre.                                                                                                                                                                                                      |
| Commission de plateforme                           | Airbnb, centre d'aide, article 1857 (lu le 14/09/2026)                                                                  | Frais partagés : 3 % pour l'hôte ; frais uniques : 15,5 % (14 à 16 %). Défaut 3 %, marqué « à confirmer » (bascule vers les frais uniques annoncée par des tiers, non confirmée sur la page officielle).                                                                                                                 |
| Prime colocation, vacance colocation, prime meublé | Règles existantes (`exploitation.primeColocation` 35 %, `vacanceSemainesColocation` 4, `primeMeuble` 15 %), spec Deklic | Réutilisées telles quelles.                                                                                                                                                                                                                                                                                              |
| Nuitées, séjours, ménage, énergie, internet        | Excel « Projet 92K » de Pierre (feuille « Calcul de l'autofinancement »)                                                | 15 nuits par mois, 4 séjours (≈ 4 nuits par séjour), ménage 27 € par séjour, énergie 190 €/mois, internet 30 €/mois. Marqués « à confirmer » (valeurs d'un projet, pas d'une statistique).                                                                                                                               |
| Vacance et durée de séjour en moyenne durée        | Aucune source publique                                                                                                  | Choix Deklic : 4 semaines par an, séjours de 4 mois (milieu de 1 à 10). Marqués « à confirmer ».                                                                                                                                                                                                                         |
| Conciergerie, gestion déléguée                     | —                                                                                                                       | Défaut 0 (auto-gestion), comme la gestion aujourd'hui ; la fourchette de marché (15 à 25 % conciergerie, 6 à 10 % gestion) est citée dans la Méthode sans être appliquée.                                                                                                                                                |

Les prélèvements sociaux et abattements existants ne changent pas.

## 6. Modèle cible (résumé, détail dans l'architecture)

- `LocationSchema` = union discriminée par `mode` : `nu` (loyerHc, chargesLocataire, vacanceSemaines, gestionTaux), `meuble` (+ loyerHcNu), `colocation` (chambres, loyerChambre, forfaitChargesChambre, vacanceSemaines par chambre, gestionTaux), `courte_duree` (nuitee, nuiteesParMois, dureeSejourNuits, menageFactureParSejour, menageCoutParSejour, plateformeTaux, conciergerieTaux, tourismeClasse), `moyenne_duree` (loyerHc, forfaitCharges, dureeSejourMois, vacanceSemaines, menageCoutParSejour, plateformeTaux, gestionTaux).
- `ChargesSchema` + `energieMensuel`, `internetMensuel` (charges propriétaire, 0 par défaut).
- Recettes : `loyersBruts` (hors charges, base du rendement brut), `chargesRecuperees` (forfaits et ménage facturé, imposables), `vacance`, `loyersNets` = (bruts + récupérées) − vacance ; `nuitees`, `sejours`.
- Charges d'exploitation : lignes `plateforme`, `conciergerie`, `menage`, `energie`, `internet` en plus des existantes (déductibles au réel seulement : le micro-BIC est ainsi calculé sur les recettes brutes, comme le veut le CGI).
- `regimesCompatibles(mode)` ; `ResultatFiscalite.compatibles` ; `meilleur` choisi parmi eux.
- `migrerProjet(brut)` : `meuble_lld` → `meuble` ; `courteDuree.tauxOccupation` → `nuiteesParMois` = occupation × 365 ÷ 12 ; ménage par nuit → coût par séjour (× durée de séjour par défaut) ; idempotent ; appliqué par le web à la lecture du stockage et des liens de partage.
- Vigilance : `CHANGEMENT_USAGE_COURTE_DUREE`, `REGLEMENT_COPRO_LOCATION` (courte durée ou colocation en copropriété), `DPE_MEUBLE_TOURISME`, `SURFACE_CHAMBRES_COLOCATION`, `BAIL_MOBILITE_CONDITIONS`.

## 7. Découpage en deux PR

1. **PR 1 — moteur** : schéma, migration, règles, recettes et charges par type, fiscalité (compatibilité), scénarios, vigilance, `locationParDefaut`, tests à 100 %, « Projet 92K » inchangé ; le web est adapté au strict minimum pour compiler et passer ses tests (nouveaux noms de mode, migration à la lecture).
2. **PR 2 — écrans** : sélecteur de type (Hypothèses, Vérifier), descripteurs par type, `construireProjet` avec défauts par type badgés « estimé », « Estimer le loyer » par type, prompt `/extract` v3 et ses tests, Méthode (une section par type), Comparer, Rapport (Levier 2), Visite (phrases), e2e, Worker redéployé, docs communes.

## 8. Risques et points d'attention

- **Sessions parallèles** (fiches 01-04) touchent `HypothesesSchema` et Vérifier : fusionner `origin/master` souvent, garder les deux côtés.
- **Migration** : un projet enregistré avec un mode inconnu ou une courte durée incomplète doit encore se charger (défauts) ; test dédié sur un JSON figé de l'ancien format.
- **Contrat de sortie** (`ResultatsSchema` strict) : les nouvelles lignes de charges et de recettes sont déclarées ; l'app relit tout le rapport par ce schéma en test.
- **Cache `/extract`** : la version du prompt passe à 3, les réponses en cache (30 jours) de la v2 restent valides pour le web (nouveau champ optionnel).
- **Coût** : aucun appel réseau nouveau.

## 9. Hors périmètre

Immeuble de rapport, local commercial, parking, résidence de services, profil saisonnier à 12 mois, meublé étudiant comme type distinct, encadrement des loyers par chambre, TVA para-hôtelière.
