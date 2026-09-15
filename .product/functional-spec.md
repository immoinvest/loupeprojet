# Deklic — Spécification fonctionnelle (résumé de travail)

Source de vérité : `reference/spec-produit-v1.html` (v1, 13/09/2026). Ce résumé sert aux skills ; en cas de doute, la spec HTML prime.

## Positionnement

« Tu as trouvé une annonce ? Colle-la ici. Deklic te dit si c'est cher, si ça s'autofinance, ce que tu paieras d'impôts et ce qu'il te restera à la revente — en deux minutes, gratuitement, et en t'expliquant chaque chiffre. »

Concurrents : Horiz.io (8–20 €/mois, complet, saisie manuelle), Lybox (9–49 €/mois, chasse intensive), IMMONAI/ImmoIA (IA, gratuit très limité), Rendify (gratuit, formulaire), Rentila (gestion, étape d'après). Trou : zéro friction + lecture automatique + analyse complète + gratuit sans quota visible.

## Persona

**Camille, 31 ans, salariée, 2 600 € net/mois**, jamais investi. Trois questions : _Est-ce que c'est cher ?_ (prix vs DVF), _Est-ce que ça s'autofinance ?_ (cash-flow après crédit, charges, vacance, impôt), _Qu'est-ce qu'il me restera ?_ (5/10/15 ans, revente).

## Cinq principes produit

1. Une seule entrée : le lien. Saisie manuelle (prix, surface, ville) seulement sans lien.
2. Jamais de case vide : défaut sourcé + badge de provenance. L'utilisateur corrige, il ne remplit pas.
3. Chaque chiffre s'explique en une phrase (textes écrits une fois, pas de LLM).
4. Gratuit et sans compte. Compte optionnel (Google, Apple ou code par e-mail) ; connecté, les projets sont enregistrés sur le compte et suivent la personne sur tous ses appareils.
5. L'IA lit, elle ne calcule pas. Calculs déterministes dans le navigateur.

## Parcours v1 (6 étapes)

1. **Coller le lien** — portail reconnu, id extrait ; extension / bookmarklet / lecture serveur / saisie manuelle. Depuis le 14/09/2026 (feature `lecture-serveur`, ADR-008) : sans extension ou si elle échoue, Deklic lit l'annonce par son serveur, à la demande, sans rien garder ; un écran d'attente (étape, progression estimée, temps écoulé, astuces, « Annuler ») s'affiche dès que le lien est reconnu et couvre les 5 à 75 s. En cas d'échec : « Réessayer la lecture » ou « Saisir à la main », le lien restant la source. La zone « coller le texte » a été retirée (14/09/2026) ; un texte partagé sans lien est lu à l'ouverture. Les photos et la fiche du bien (chauffage, état, étages, extérieurs, équipements, énergie, honoraires, vendeur, quartier) suivent le projet, carte « Le bien » dans le Rapport.
2. **Lire** — données structurées de la page, puis LLM (JSON strict) pour les champs manquants, repli regex. 0 ou 1 appel, ~2 s.
3. **Enrichir** — géocodage puis en parallèle : DVF 500 m, DPE ADEME, loyers ANIL, taux TF (REI), Géorisques, zonage ABC, population. Zéro LLM.
4. **Vérifier** — un écran, badges `annonce` / `donnée publique` / `estimé` / `à toi`. Seuls prix, surface, code postal et ville sont exigés (feature `hypotheses-optionnelles`, 14/09/2026) : apport à 10 % du coût total du projet (prix retenu, frais, travaux, mobilier ; arrondi à la centaine, recalculé à chaque frappe tant qu'il n'est pas saisi, sa part du coût total dite sous le champ, ici comme dans Hypothèses et Financement), durée 25 ans et tranche 30 % sont pré-remplis et marqués « estimé » ; un loyer vide est pris dans les loyers de marché ANIL de la commune, sinon le projet est créé sans loyer (loyer, loyer par chambre ou nuitée selon le type) ; les revenus ne sont jamais demandés. Sans loyer, le rapport est partiel : prix, financement, estimation et risques sont calculés ; cash-flow, impôts, revente, rendement et scénarios affichent « Il manque le loyer visé pour cette analyse » avec le champ sur place. Les feux rendement, cash-flow et couverture disent « loyer à indiquer » ; l'onglet Financement garde le crédit et attend le loyer pour la couverture. Depuis le 15/09/2026 (feature `formulaire-rapide`, fiches 13 et 20) : **le strict minimum d'abord** — seuls prix, surface, commune, type de location (s'il n'a pas été lu) et loyer visé sont ouverts ; le reste est replié en « Lu dans l'annonce : N informations », « Estimé pour vous » et « Préciser pour une analyse plus juste (facultatif) » (DPE et état en tête), et une erreur rouvre son groupe. Une commande par donnée : compteurs − / + (pièces, chambres, étage avec « RDC », lots, chambres louées), tuiles (type de bien, état, oui / non, période de construction « Avant 1949 », « 1949 à 1996 », « 1997 à 2011 », « 2012 et après » dont l'année du milieu est marquée « estimé », apport 0 · 10 · 20 % · Autre, durée 15 · 20 · 25 ans · Autre, tranche), échelles DPE et GES, montants espacés pendant la frappe, curseur des nuits louées. Un seul champ « Commune » : cinq chiffres choisissent la ville (plusieurs communes : une liste), un nom propose des communes ; sans réponse du Worker, « 69003 Lyon » suffit. Maison : ni étage, ni ascenseur, ni copropriété ; rez-de-chaussée : pas d'ascenseur ; chambres = pièces − 1 « estimé ». Chaque terme technique (DPE, GES, CFE, PNO, différé, vacance, prélèvements sociaux…) porte une icône ⓘ dans Vérifier et Hypothèses : définition courte, chiffres lus dans les règles, source.
5. **Le rapport** — verdict + cinq feux, puis l'autofinancement en carte principale (cascade loyer → après le crédit → après les charges → après l'impôt, part du loyer prise par le crédit, effort d'épargne ou excédent, loyer d'équilibre), le prix vs ventes réelles, les rendements brut · net · net-net, les leviers, la fiscalité (4 régimes) et la revente (multiple sur apport). Chaque titre et chaque repère porte une icône ⓘ qui ouvre une bulle chiffrée ; un lien « Voir … → » mène à l'onglet qui détaille (Estimation, Fiscalité, Revente). Tout modifiable dans Hypothèses, recalcul instantané. Après les leviers, la carte « Avant de faire une offre » : les points financiers (effort, durée du prêt, plafond du micro, loyer encadré, prélèvements sociaux à confirmer) et l'état de la visite. L'onglet **Visite** (livré le 14/09/2026, feature `visite-questions`, fiche 07) tire sa liste d'une base de 74 questions sourcées filtrée par le bien (copropriété, année de construction avec amiante avant 1997 et plomb avant 1949, DPE, étage sans ascenseur, mode d'exploitation, risques, travaux, prix), en sept groupes ; chaque réponse (à vérifier, OK, problème, sans objet) et chaque note sont conservées avec le projet ; neuf questions à valeur écrivent une hypothèse ; « Marquer la visite comme faite » retire l'onglet, le compte rendu reste dans le dossier imprimé et le lien de partage ; « J'ai déjà visité ce bien » à la création. L'onglet **Financement** règle le prêt et le lit : mensualité, TAEG, coût du crédit, tableau par année, bouton « Simuler un prêt ».
6. **Garder** — sauvegarde locale, PDF via impression, lien de partage (projet encodé dans l'URL), compte optionnel par Google, Apple ou code à 6 chiffres reçu par e-mail (livré le 13/09/2026, ADR-006). Synchronisation des projets livrée le 14/09/2026 (feature `sync-projets`) : l'appareil écrit d'abord chez lui, puis envoie au compte à la connexion, 1,5 s après une modification, au retour du réseau et sur l'onglet ; projet par projet, la dernière modification gagne ; le premier appareil connecté verse ses projets dans le compte (l'exemple jamais touché n'est pas recopié dans un compte qui a déjà des projets) ; se déconnecter retire de l'appareil les projets du compte (ceux pas encore envoyés restent) ; supprimer son compte efface les projets du compte mais laisse ceux de l'appareil ; Mes projets dit « sauvegardés sur votre compte · à jour » (ou envoi en cours, hors ligne, indisponible, limite de 200 projets, session expirée). Sans compte, aucune requête. Livré le 13/09/2026 (feature `garder`) : dossier imprimable `/projets/:id/imprimer`, lien `/partage#p=…` en lecture seule avec « Ajouter à mes projets », comparaison de 2 à 5 projets sans compte (`/comparer`, avancée de la v1.5) et page « Comment c'est calculé » (`/methode`).
7. **Simulateur de prêt** — livré le 14/09/2026 (feature `simulateur-pret`, fiche de backlog 08) : outil indépendant des projets (`/simulateur-pret`, rubrique « Outils »). Le projet financé (prix, honoraires, travaux, frais de notaire estimés par la formule des frais d'acquisition et modifiables, département, revenus facultatifs) et une ou deux offres (banque, apport, taux nominal, durée, assurance, frais de dossier et de garantie payés à la signature ou financés, différés). Pour chaque offre : montant emprunté, mensualité hors et avec assurance, TAEG hors et avec assurance (résolus numériquement, frais compris), totaux, coût total du crédit, échéancier par phase, alerte au-dessus du taux d'usure, taux d'endettement (mensualité ÷ revenus, distinct de l'effort HCSF). Comparaison sur neuf critères (la plus petite valeur est la meilleure ; durée et montant informatifs) avec une phrase de synthèse ; tableaux d'amortissement par année, chaque année dépliable en douze mois ; CSV mensuel par offre ; impression ; lien `#s=` (fragment validé par Zod, jamais envoyé au serveur) ; dernière simulation retrouvée. Mêmes formules que le rapport d'un projet (test de cohérence au centime).

8. **Accueil** — livré le 14/09/2026 (feature `accueil-menu`) : la racine `/`, rejointe par le lien « Accueil » en tête du menu et par le logo. Un bloc par section choisie dans « Mon menu » (Analyser et Gérer, Analyser seulement, Gérer seulement ; sans compte, les deux). Analyser sans projet à soi : appel à analyser une annonce, lien vers l'exemple ; avec des projets : nombre à l'étude, étapes (en analyse, visite prévue, offre faite, acheté), meilleur cash-flow, prochaine étape écrite par règles (acheté → le gérer si Gérer est affiché, offre → financement, visite prévue → questions de visite, en analyse → rapport). Gérer sans compte : se connecter ; sans bien : ajouter le premier ; avec des biens : loyers reçus du mois, montants, retards. Le menu Analyser s'ouvre sur une ligne « Mes projets · N » (la liste, où se trouve Comparer) avec son « + » (nouveau projet), puis trois projets ; le menu Gérer, sur « Mes biens · N » avec son « + » (ajouter un bien) — feature `coque-menus`, 15/09/2026. Le statut d'un projet se choisit dans une liste aux couleurs de Deklic : le parcours (En analyse, Visite prévue, Offre faite, Acheté) puis, à part, Scénario et Écarté ; sur téléphone, elle monte du bas de l'écran.

## Pipeline technique (9 étapes)

| #   | Étape      | Où                                                                       | Sortie                                   |
| --- | ---------- | ------------------------------------------------------------------------ | ---------------------------------------- |
| 1   | Résoudre   | Navigateur                                                               | `{portail, id, url_canonique}`           |
| 2   | Capturer   | Navigateur (extension/bookmarklet ; page rapportée par `/lecture` sinon) | champs structurés + texte + URLs photos  |
| 3   | Extraire   | Worker `/extract`                                                        | champs manquants + confiance             |
| 4   | Normaliser | Navigateur                                                               | schéma `Annonce` + provenance            |
| 5   | Géocoder   | Worker proxy → Géoplateforme                                             | lat/lon, INSEE, clé BAN, précision       |
| 6   | Enrichir   | Navigateur via proxy + cache KV                                          | bloc `marche`                            |
| 7   | Estimer    | Navigateur                                                               | hypothèses pré-remplies sourcées         |
| 8   | Vérifier   | Navigateur                                                               | contrôles de cohérence + 5 confirmations |
| 9   | Calculer   | Navigateur (`packages/moteur`)                                           | le rapport                               |

## Moteur de calcul — règles (septembre 2026)

### Financement

- **Prix retenu** : prix affiché × (1 − négociation), arrondi à l'euro (curseur 0 à −15 % par 0,5 % dans Hypothèses, jusqu'à 30 % au clavier ; défaut 0 : prix affiché tel quel) ; honoraires d'agence inchangés en euros ; tout le rapport (notaire, prêt, rendements, revente, estimation, feu prix, scénarios) se calcule sur le prix retenu. « Viser le prix estimé » règle le curseur sur le centre de l'estimation.
- **Frais d'acquisition calculés** (base = prix retenu hors honoraires d'agence) : DMTO 4,50 % ou 5 % selon département (jusqu'au 31/03/2028) + taxe communale 1,20 % + frais d'assiette 2,37 % du DMTO ; émoluments notaire par tranches 3,870 % / 1,596 % / 1,064 % / 0,799 % HT + TVA 20 % ; contribution de sécurité immobilière 0,10 % ; débours ~0,4 %. Ancien : 7 à 8,5 %.
- **Mensualité** PMT, tableau d'amortissement complet ; assurance en % du capital initial (0,10–0,35 %).
- **TAEG** par résolution du taux interne, frais de dossier + garantie inclus.
- **Taux d'effort HCSF** : mensualité assurance comprise ÷ (revenus + 70 % des loyers). Seuil 35 %, 25 ans (27 si travaux ≥ 10 %). Depuis la feature `hypotheses-financement` (14/09/2026), Deklic ne demande plus les revenus : l'effort n'est calculé que pour les projets anciens qui en portent ; la durée maximale reste vérifiée.
- **Couverture** : mensualité assurance comprise ÷ loyer hors charges du régime retenu. Bon jusqu'à 70 % (part des loyers que le HCSF retient comme revenu), à surveiller jusqu'à 100 %, problème au-delà ; inconnu sans loyer. C'est le cinquième feu du verdict.
- **IRA** = min(6 mois d'intérêts, 3 % du CRD).
- **Taux par défaut** août 2026 : 3,14 % (15 ans), 3,27 % (20), 3,35 % (25) ; bornés par le taux d'usure (5,29 % à ≥ 20 ans).

### Cash-flow

- Cinq types d'exploitation (feature `location-types`, fiche 05), choisis en tête de la carte « La location » :
  - **Nue** : loyer × 12 − vacance (3 semaines).
  - **Meublée longue durée** : loyer × 12 − vacance (3 semaines ; 8 à 10 pour un logement étudiant, à saisir) ; loyer nu déduit par ÷ 1,15 pour comparer les régimes nus.
  - **Colocation** : chambres louées × loyer par chambre × 12 + forfait de charges par chambre ; vacance par chambre (4 semaines) ; énergie et internet payés par le propriétaire. Décence : 9 m² et 20 m³ par chambre en baux individuels (loi 89-462 art. 8-1, décret 2002-120).
  - **Courte durée** : nuitée × nuits louées par mois × 12 + ménage facturé par séjour ; séjours = nuits ÷ durée moyenne d'un séjour ; ménage payé par séjour, commission de plateforme (3 %, Airbnb, à confirmer) et conciergerie en charges. Changement d'usage, enregistrement et DPE des meublés de tourisme (loi Le Meur du 19/11/2024) en points de vigilance.
  - **Moyenne durée** (bail mobilité, 1 à 10 mois, loi ELAN) : loyer et forfait de charges × 12, vacance entre deux séjours (4 semaines, à confirmer), ménage par séjour.
- Valeurs de départ par type dans `regles/2026-09.ts` (`exploitation.parType`), badgées « estimé » ; celles qui viennent de l'Excel « Projet 92K » ou d'un choix Deklic sont « à confirmer ».
- Sorties : crédit, assurance, TF, copro, PNO, énergie/internet payés par le propriétaire, CFE, comptable, gestion (%), conciergerie et plateforme (% des recettes), ménage par séjour, **vacance**, **entretien** (0,5 %/an du prix retenu). Forfaits de charges et ménage facturé sont des recettes (imposables).
- Résultats : cash-flow mensuel, effort d'épargne, point mort (loyer d'équilibre), taux de couverture.

### Fiscalité — quatre régimes côte à côte

| Régime           | Base                                           | PS                                | Règles                                                                                                                                                                                                                       |
| ---------------- | ---------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Meublé micro-BIC | 50 % des recettes (30 % tourisme non classé)   | 18,6 % _(LFSS 2026, à confirmer)_ | plafond 77 700 € (2025) puis 83 600 € (2026-28) ; 15 000 € tourisme non classé                                                                                                                                               |
| Meublé réel LMNP | recettes − charges − intérêts − amortissements | 18,6 % _(idem)_                   | terrain non amorti (15 %) ; composants : gros œuvre 50 ans, second œuvre 20, mobilier 7, travaux 10 ; **art. 39 C** : l'amortissement ne crée pas de déficit, report illimité ; déficit hors amortissement reportable 10 ans |
| Nu micro-foncier | 70 % des loyers                                | 17,2 %                            | plafond 15 000 € ; pas de déficit                                                                                                                                                                                            |
| Nu réel          | loyers − charges − intérêts                    | 17,2 %                            | déficit foncier imputable sur le revenu global ≤ 10 700 €/an (21 400 € rénovation énergétique jusqu'au 31/12/2027) ; intérêts reportables 10 ans                                                                             |

Projection année par année sur la durée de détention avec stocks de déficits/amortissements ; afficher **l'année où l'on commence à payer**.

Régimes compatibles avec le type : nue et meublée comparent les quatre régimes ; colocation, courte et moyenne durée n'ont que les deux régimes du meublé (le moteur projette toujours les quatre, `ResultatFiscalite.compatibles` guide l'affichage et le choix du meilleur ; un régime incompatible est refusé). Micro-BIC d'un meublé de tourisme non classé : abattement 30 %, plafond 15 000 € ; classé : 50 %, plafond général.

### Revente

- Prix = valeur × (1 + évolution)^n − agence − diagnostics − IRA − CRD → **cash net vendeur**.
- Plus-value = prix − (achat + frais réels ou forfait 7,5 % + travaux justifiés ou forfait 15 % après 5 ans). **LMNP réel depuis 15/02/2025 : réintégration des amortissements de l'immeuble** (mobilier exclu).
- Abattements : IR 6 %/an de la 6ᵉ à la 21ᵉ, 4 % la 22ᵉ ; PS 1,65 %/an (6ᵉ–21ᵉ), 1,60 % (22ᵉ), 9 %/an (23ᵉ–30ᵉ). Taux 19 % + 17,2 %. Surtaxe 2–6 % au-delà de 50 000 €.

### Rendement, TRI, verdict

- Brut, net de charges, net-net, sur prix + travaux + frais d'acquisition.
- **TRI réel** sur flux annuels (apport + mobilier en année 0, cash-flows après impôt, cash net de revente en N).
- Enrichissement = capital remboursé + plus-value nette + cash-flows cumulés − apport.
- **Verdict cinq feux** (bon / à surveiller / problème) : prix vs DVF, rendement net, cash-flow, couverture (crédit ÷ loyer), risques (DPE F/G, copro en procédure, zone à risque). Pas de note globale.
- **Scénarios** : négocier (prix cible pour cash-flow 0, net 6 %, brut 8 % ; à défaut −10 % du prix retenu), « et si je passais en colocation » (chambres du bien, loyer meublé de référence × 1,35 ÷ chambres, forfait et abonnements ; absent pour une colocation), durée, taux +0,5 pt, nu ou meublé (depuis colocation, courte ou moyenne durée : meublé longue durée au loyer de référence), vacance (8 semaines ; en courte durée, deux mois de nuits en moins).

## Cas de référence : « Ton Excel → Loupe » (projet 92K, prix 155 000 €)

Colocation meublée 4 × 460 €, 25 ans à 3,30 %, apport 14 725 €, LMNP réel, revente à 5 ans. Entrées relevées dans l'Excel le 15/09/2026 (`packages/moteur/src/exemples/projet-92k.ts`), vérifiées par `packages/moteur/tests/reference/projet-92k.test.ts`. Détail, sources et verdicts : `.product/audit/excel-92k.md` et `.product/audit/calculs-2026-09.md`.

| Indicateur                       | Excel    | Deklic   | Pourquoi                                                                            |
| -------------------------------- | -------- | -------- | ----------------------------------------------------------------------------------- |
| Frais d'acquisition              | 14 725 € | 11 832 € | formule réelle (DMTO 5 %, hors agence) vs 9,5 % du FAI                              |
| Mensualité assurance comprise    | 813 €    | 807 €    | PMT au taux nominal (l'Excel prend 3,37 %)                                          |
| TAEG assurance incluse           | 3,74 %   | 4,13 %   | taux actuariel résolu                                                               |
| Taux d'effort                    | 38,7 %   | 23,8 %   | HCSF, loyers à 70 %                                                                 |
| Cash-flow mensuel                | +497 €   | +583 €   | pas de ligne « Autre » (80 €) au moteur, mensualité au taux nominal                 |
| Impôt micro-BIC année 1          | 5 211 €  | 5 365 €  | PS 18,6 %                                                                           |
| Impôt réel année 1               | 0 €      | 0 €      | déficit 12 627 € (10 ans) + 5 300 € d'amortissements différés (art. 39 C)           |
| Première année imposable au réel | 4,2      | 4        | projection annuelle (168 € de base en année 4)                                      |
| Plus-value taxable (5 ans)       | 27 579 € | 0 €      | ni IRA ni mobilier dans le calcul, réintégration du bâti seul, forfait travaux 15 % |
| IRA (5 ans)                      | 4 083 €  | 2 199 €  | min des deux plafonds                                                               |
| TRI (5 ans)                      | 50,9 %   | 31,2 %   | vrai TRI (l'Excel divise le multiple sur apport par les années)                     |

Corrections au modèle Excel : travaux soit en charge soit amortis, jamais les deux ; PS BIC 18,6 % (LFSS 2026), fonciers et plus-values 17,2 %.

## Estimations

- **Prix** : médiane €/m² DVF 500 m / 24 mois, ±10 % selon surface ; fourchette Q1–Q3. Depuis `estimation-confiance` : une **note de confiance sur 100** accompagne l'estimation (localisation du repère 35, dispersion des prix 30, ventes comparables 20, ancienneté des ventes 15 ; cinq niveaux, marge de la fourchette de ±5 % à ±15 % selon le niveau), affichée en tête de l'onglet avec ses raisons ; sans adresse, le repère de commune ou d'arrondissement est montré tel quel (« moins précis »).
- **Loyer** : ANIL commune par type, −8 % HC, +15–25 % meublé, +30–45 % colocation ; plafonné par l'encadrement.
- **Travaux** (feature `travaux-etat`, fiche 19) : selon l'état du bien, surface × coût au m² — rénové 0 ; bon état 0 (jusqu'à 150 €/m²) ; à rafraîchir 400 €/m² (150 à 700) ; à rénover 1 200 €/m² (1 000 à 2 000) ; DPE F ou G : + 250 €/m² de rénovation énergétique (200 à 500), moitié pour un bien à rénover ; arrondi à la centaine, TTC, hors aides, sans coefficient maison ni région ; barème « à confirmer » (aucun barème officiel : fourchettes de professionnels, ANAH 55 065 € par rénovation d'ampleur en 2024). Le montant suit l'état, la surface et le DPE tant qu'il n'est pas saisi ; bas, estimé ou haut en un clic ; projets d'avant inchangés. Rappel des interdictions de louer (G 2025, F 2028, E 2034) dans la visite.
- **Taxe foncière** : taux REI × VL estimée, croisé avec 0,8–1,2 mois de loyer ; « estimation, demander l'avis ».

## Sources de données (remplissage automatique)

Page de l'annonce (structuré) · texte (LLM) · Géoplateforme (géocodage) · DVF géolocalisées (CSV commune) · ADEME `dpe03existant` · Carte des loyers ANIL 2025 · REI/OFGL (taux TF) · Géorisques · zonage ABC · geo.api.gouv.fr · BDNB Open · seuils de l'usure · barèmes intégrés (notaire, assurance, CFE, comptable, PNO).

## Modèle de données (projet)

```json
{ "id": "prj_…", "version_regles": "2026-09",
  "source": { "portail", "id", "url", "capture": { "mode", "regles", "date" }, "texte_hash" },
  "bien": { "adresse", "ban_id", "insee", "lat", "lon", "type", "surface", "pieces", "etage", "ascenseur", "annee", "dpe", "ges", "copro": { "lots", "charges_mois", "procedure" } },
  "marche": { "dvf": { "median_m2", "q1", "q3", "n", "rayon" }, "loyer_anil_m2", "tf_taux_cumule", "zone_abc", "risques" },
  "hyp": { "prix", "agence", "travaux", "mobilier", "apport", "taux", "duree", "assurance", "frais_dossier", "garantie", "mode", "loyer_hc", "charges_locataire", "vacance_sem", "tf", "copro", "pno", "comptable", "cfe", "entretien", "tmi", "ps_bic", "regime", "revente": { "annees", "evolution", "agence" } },
  "provenance": { "<champ>": "annonce | ademe | anil | estime | usure | utilisateur | llm:0.xx" },
  "resultats": "calculés à la volée, jamais stockés" }
```

## Roadmap

- **v1 (8–10 sem.)** : extension + bookmarklet (LBC, SeLoger, Bien'ici, PAP, Logic-Immo) ; pipeline complet ; saisie manuelle ; 5 volets, verdict, scénarios ; sauvegarde locale, PDF, partage ; test réel Marseille/Lyon/Aix.
- **v1.5 (+4)** : compte (livré : code e-mail, Google, Apple), sync (livrée : projets sur le compte) ; comparaison 2–5 projets, statuts ; Safari iOS, partage mobile (livré en avance : application installable et hors ligne, « Partager → Deklic » sur Android, partage natif d'un projet ; iPhone : installation par Safari, sans cible de partage) ; portails supplémentaires.
- **v2 (+6)** : historique de prix (extension), loyers infra-communaux, registre copro, DPE PDF, photos → travaux (option).
- **Gérer (gestion locative après l'achat, épic G1 à G5, `specs/gestion-locative-specs.md`)** : commencé le 14/09/2026 avec le socle G1a (menu Analyser et Gérer, « Mon menu », biens, locataires, locations, loyers du mois, « Ajouter à la main » et « J'ai acheté ce bien » en deux clics, compte requis) ; puis G1b `quittances-fiches` (paiement en partie, quittance et reçu figés et imprimables selon l'art. 21 de la loi du 6 juillet 1989, identité du bailleur demandée une fois, page Loyers mois par mois, fiche d'un bien et fin de location, louer un bien vacant ou une autre chambre, plusieurs locataires par bien, export JSON ; paiements confirmés à la main en attendant la banque) ; puis G1c `gerer-biens` (pages Mes biens et Mes locataires, loyer modifié à partir d'un mois non payé, suppression d'un bien confirmée par son nom, APL versée au bailleur sur la ligne du loyer et la quittance, nom et e-mail du locataire corrigés) ; ensuite G3 banque (détection des virements de loyer par les API bancaires, comme Rentila), G2 quittances automatiques, G4 vie du bail, G5 bilan et déclaration.
- **v3** : liasse LMNP, monétisation (affiliation, export premium).
- **Pas en v1** : recherche/alertes d'annonces, chat IA, SCI IS, carte au-delà des DVF, app native.

## Risques

Annonces (jurisprudence, maquettes qui changent) · fiscalité mouvante (PS 18,6 % peu documenté) · encadrement des loyers (expérimentation expire 11/2026) · qualité des données (plusieurs DPE, ANIL = CC) · API publiques fragiles (api-adresse fermée, DVF Cerema en preprod) · responsabilité (verdict pris pour un conseil) · monétisation (gratuit = pas de plan, coût marginal quasi nul).

## Prochaines étapes de dérisquage (spec)

1. **Porter le moteur** en TS pur avec tests reproduisant l'Excel ← _feature en cours_
2. Sonder les API publiques sur 20 adresses (Aix, Marseille, Lyon).
3. Prototyper la capture bookmarklet sur 30 annonces réelles.
4. Tester l'extraction sur 50 annonces : Ministral vs Mistral Small vs regex.
5. Choisir le nom, vérifier domaine et marque.
6. Montrer la maquette à cinq personnes.
