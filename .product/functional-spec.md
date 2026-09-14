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
4. Gratuit et sans compte. Compte optionnel (Google, Apple ou code par e-mail) ; la synchronisation des projets suivra.
5. L'IA lit, elle ne calcule pas. Calculs déterministes dans le navigateur.

## Parcours v1 (6 étapes)

1. **Coller le lien** — portail reconnu, id extrait ; extension / bookmarklet / texte collé / saisie manuelle.
2. **Lire** — données structurées de la page, puis LLM (JSON strict) pour les champs manquants, repli regex. 0 ou 1 appel, ~2 s.
3. **Enrichir** — géocodage puis en parallèle : DVF 500 m, DPE ADEME, loyers ANIL, taux TF (REI), Géorisques, zonage ABC, population. Zéro LLM.
4. **Vérifier** — un écran, quatre blocs (bien, financement, location, fiscalité), badges `annonce` / `donnée publique` / `estimé` / `à toi`. Cinq confirmations max : loyer visé, apport, durée, TMI, mode de location.
5. **Le rapport** — verdict + cinq feux, puis l'autofinancement en carte principale (cascade loyer → après le crédit → après les charges → après l'impôt, part du loyer prise par le crédit, effort d'épargne ou excédent, loyer d'équilibre), le prix vs ventes réelles, les rendements brut · net · net-net, les leviers, la fiscalité (4 régimes) et la revente (multiple sur apport). Chaque titre et chaque repère porte une icône ⓘ qui ouvre une bulle chiffrée ; un lien « Voir … → » mène à l'onglet qui détaille (Estimation, Fiscalité, Revente). Tout modifiable dans Hypothèses, recalcul instantané. L'onglet **Financement** règle le prêt et le lit : mensualité, TAEG, coût du crédit, tableau par année, bouton « Simuler un prêt ».
6. **Garder** — sauvegarde locale, PDF via impression, lien de partage (projet encodé dans l'URL), compte optionnel par Google, Apple ou code à 6 chiffres reçu par e-mail (livré le 13/09/2026, ADR-006 ; synchronisation des projets à venir). Livré le 13/09/2026 (feature `garder`) : dossier imprimable `/projets/:id/imprimer`, lien `/partage#p=…` en lecture seule avec « Ajouter à mes projets », comparaison de 2 à 5 projets sans compte (`/comparer`, avancée de la v1.5) et page « Comment c'est calculé » (`/methode`).

## Pipeline technique (9 étapes)

| #   | Étape      | Où                                 | Sortie                                   |
| --- | ---------- | ---------------------------------- | ---------------------------------------- |
| 1   | Résoudre   | Navigateur                         | `{portail, id, url_canonique}`           |
| 2   | Capturer   | Navigateur (extension/bookmarklet) | champs structurés + texte + URLs photos  |
| 3   | Extraire   | Worker `/extract`                  | champs manquants + confiance             |
| 4   | Normaliser | Navigateur                         | schéma `Annonce` + provenance            |
| 5   | Géocoder   | Worker proxy → Géoplateforme       | lat/lon, INSEE, clé BAN, précision       |
| 6   | Enrichir   | Navigateur via proxy + cache KV    | bloc `marche`                            |
| 7   | Estimer    | Navigateur                         | hypothèses pré-remplies sourcées         |
| 8   | Vérifier   | Navigateur                         | contrôles de cohérence + 5 confirmations |
| 9   | Calculer   | Navigateur (`packages/moteur`)     | le rapport                               |

## Moteur de calcul — règles (septembre 2026)

### Financement

- **Frais d'acquisition calculés** (base = prix hors honoraires d'agence) : DMTO 4,50 % ou 5 % selon département (jusqu'au 31/03/2028) + taxe communale 1,20 % + frais d'assiette 2,37 % du DMTO ; émoluments notaire par tranches 3,870 % / 1,596 % / 1,064 % / 0,799 % HT + TVA 20 % ; contribution de sécurité immobilière 0,10 % ; débours ~0,4 %. Ancien : 7 à 8,5 %.
- **Mensualité** PMT, tableau d'amortissement complet ; assurance en % du capital initial (0,10–0,35 %).
- **TAEG** par résolution du taux interne, frais de dossier + garantie inclus.
- **Taux d'effort HCSF** : mensualité assurance comprise ÷ (revenus + 70 % des loyers). Seuil 35 %, 25 ans (27 si travaux ≥ 10 %). Depuis la feature `hypotheses-financement` (14/09/2026), Deklic ne demande plus les revenus : l'effort n'est calculé que pour les projets anciens qui en portent ; la durée maximale reste vérifiée.
- **Couverture** : mensualité assurance comprise ÷ loyer hors charges du régime retenu. Bon jusqu'à 70 % (part des loyers que le HCSF retient comme revenu), à surveiller jusqu'à 100 %, problème au-delà ; inconnu sans loyer. C'est le cinquième feu du verdict.
- **IRA** = min(6 mois d'intérêts, 3 % du CRD).
- **Taux par défaut** août 2026 : 3,14 % (15 ans), 3,27 % (20), 3,35 % (25) ; bornés par le taux d'usure (5,29 % à ≥ 20 ans).

### Cash-flow

- Trois modes : meublé longue durée, nu, courte durée (nuitée × occupation − ménage/conciergerie).
- Sorties : crédit, assurance, TF, copro, PNO, énergie/internet si inclus, CFE, comptable, gestion (%), **vacance** (3 sem/an LLD, 1 mois colocation), **entretien** (0,5 %/an du prix).
- Résultats : cash-flow mensuel, effort d'épargne, point mort (loyer d'équilibre), taux de couverture.

### Fiscalité — quatre régimes côte à côte

| Régime           | Base                                           | PS                                | Règles                                                                                                                                                                                                                       |
| ---------------- | ---------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Meublé micro-BIC | 50 % des recettes (30 % tourisme non classé)   | 18,6 % _(LFSS 2026, à confirmer)_ | plafond 77 700 € (2025) puis 83 600 € (2026-28) ; 15 000 € tourisme non classé                                                                                                                                               |
| Meublé réel LMNP | recettes − charges − intérêts − amortissements | 18,6 % _(idem)_                   | terrain non amorti (15 %) ; composants : gros œuvre 50 ans, second œuvre 20, mobilier 7, travaux 10 ; **art. 39 C** : l'amortissement ne crée pas de déficit, report illimité ; déficit hors amortissement reportable 10 ans |
| Nu micro-foncier | 70 % des loyers                                | 17,2 %                            | plafond 15 000 € ; pas de déficit                                                                                                                                                                                            |
| Nu réel          | loyers − charges − intérêts                    | 17,2 %                            | déficit foncier imputable sur le revenu global ≤ 10 700 €/an (21 400 € rénovation énergétique jusqu'au 31/12/2027) ; intérêts reportables 10 ans                                                                             |

Projection année par année sur la durée de détention avec stocks de déficits/amortissements ; afficher **l'année où l'on commence à payer**.

### Revente

- Prix = valeur × (1 + évolution)^n − agence − diagnostics − IRA − CRD → **cash net vendeur**.
- Plus-value = prix − (achat + frais réels ou forfait 7,5 % + travaux justifiés ou forfait 15 % après 5 ans). **LMNP réel depuis 15/02/2025 : réintégration des amortissements de l'immeuble** (mobilier exclu).
- Abattements : IR 6 %/an de la 6ᵉ à la 21ᵉ, 4 % la 22ᵉ ; PS 1,65 %/an (6ᵉ–21ᵉ), 1,60 % (22ᵉ), 9 %/an (23ᵉ–30ᵉ). Taux 19 % + 17,2 %. Surtaxe 2–6 % au-delà de 50 000 €.

### Rendement, TRI, verdict

- Brut, net de charges, net-net, sur prix + travaux + frais d'acquisition.
- **TRI réel** sur flux annuels (apport + mobilier en année 0, cash-flows après impôt, cash net de revente en N).
- Enrichissement = capital remboursé + plus-value nette + cash-flows cumulés − apport.
- **Verdict cinq feux** (bon / à surveiller / problème) : prix vs DVF, rendement net, cash-flow, couverture (crédit ÷ loyer), risques (DPE F/G, copro en procédure, zone à risque). Pas de note globale.
- **Scénarios** : négocier (prix cible pour cash-flow 0, net 6 %, brut 8 %), colocation, durée, taux +0,5 pt, nu, vacance.

## Cas de référence : « Ton Excel → Loupe » (projet 92K, prix 155 000 €)

| Indicateur                       | Excel    | Loupe attendu | Pourquoi                                                                |
| -------------------------------- | -------- | ------------- | ----------------------------------------------------------------------- |
| Frais d'acquisition              | 14 725 € | 11 832 €      | formule réelle (DMTO 5 %, hors agence) vs 9,5 %                         |
| Mensualité assurance comprise    | 813 €    | 807 €         | PMT sur taux nominal                                                    |
| TAEG assurance incluse           | 3,74 %   | 4,13 %        | résolution exacte                                                       |
| Taux d'effort                    | 38,7 %   | 23,8 %        | HCSF, loyers à 70 %                                                     |
| Cash-flow mensuel                | +497 €   | +349 €        | vacance 1 mois/an                                                       |
| Impôt micro-BIC année 1          | 5 211 €  | 5 365 €       | PS 18,6 %                                                               |
| Impôt réel année 1               | 0 €      | 0 €           | déficit scindé : 13 589 € (10 ans) + 6 250 € d'amortissement (illimité) |
| Première année imposable au réel | 4,2      | 6             | projection annuelle                                                     |
| Plus-value taxable (5 ans)       | 27 579 € | 23 971 €      | réintégration immeuble seulement                                        |
| IRA                              | 4 083 €  | 2 183 €       | min des deux plafonds                                                   |
| TRI                              | 50,9 %   | 18,9 %        | vrai TRI (apport 22 682, 4 × 4 193, sortie 27 588)                      |

**Manque pour en faire des tests** : les entrées complètes de l'Excel (apport, durée, taux, loyer, charges, TMI, travaux, mobilier, département). À récupérer auprès de Pierre.

Corrections au modèle Excel : travaux soit en charge soit amortis, jamais les deux ; PS BIC 18,6 % (LFSS 2026), fonciers et plus-values 17,2 %.

## Estimations

- **Prix** : médiane €/m² DVF 500 m / 24 mois, ±10 % selon surface ; fourchette Q1–Q3. Depuis `estimation-confiance` : une **note de confiance sur 100** accompagne l'estimation (localisation du repère 35, dispersion des prix 30, ventes comparables 20, ancienneté des ventes 15 ; cinq niveaux, marge de la fourchette de ±5 % à ±15 % selon le niveau), affichée en tête de l'onglet avec ses raisons ; sans adresse, le repère de commune ou d'arrondissement est montré tel quel (« moins précis »).
- **Loyer** : ANIL commune par type, −8 % HC, +15–25 % meublé, +30–45 % colocation ; plafonné par l'encadrement.
- **Travaux** : rafraîchissement 150–300 €/m², moyen 500–800, lourd 1 000–1 500 ; DPE F/G → rénovation énergétique + rappel interdictions (G 2025, F 2028, E 2034).
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

- **v1 (8–10 sem.)** : extension + bookmarklet (LBC, SeLoger, Bien'ici, PAP, Logic-Immo) ; pipeline complet ; texte collé et saisie manuelle ; 5 volets, verdict, scénarios ; sauvegarde locale, PDF, partage ; test réel Marseille/Lyon/Aix.
- **v1.5 (+4)** : compte (livré : code e-mail, Google, Apple), sync ; comparaison 2–5 projets, statuts ; Safari iOS, partage mobile (livré en avance : application installable et hors ligne, « Partager → Deklic » sur Android, partage natif d'un projet ; iPhone : installation par Safari, sans cible de partage) ; portails supplémentaires.
- **v2 (+6)** : historique de prix (extension), loyers infra-communaux, registre copro, DPE PDF, photos → travaux (option).
- **v3** : suivi après achat, liasse LMNP, monétisation (affiliation, export premium).
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
