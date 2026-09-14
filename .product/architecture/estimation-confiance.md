# Architecture — estimation-confiance

Voir la discovery : `.product/features/estimation-confiance-discovery.md` ; les specs : `.product/specs/estimation-confiance-specs.md`.

## Vue d'ensemble (PR 1)

```
data (Action Référentiels)        worker                                  moteur (navigateur)                    web
index DVF + dateMediane ──▶ /marche : dateMediane, ancienneté ──▶ marche.dvf { precision, anciennete, ──▶ confianceEstimation ──▶ carte Confiance (tête d'onglet)
CSV DVF (dates) ─────────▶ /marche/adresse : reference.periode,      periode, lieu }                    (note, niveau,          carte « Le repère utilisé »
                                     dateMediane, anciennete                                              composantes)          Rapport, Méthode
```

La note est calculée dans le moteur, pur, à chaque recalcul du projet. Le Worker ne fait que mesurer les dates ; le web ne fait que ranger les valeurs dans `marche.dvf` et les écrire en clair.

## US-1 — moteur

Fichiers :

- `packages/moteur/src/regles/types.ts` : `NiveauConfiance` à cinq valeurs ; `PrecisionDvf` ; `Palier { valeur, points }`, `PalierRayon { jusquaMetres: number | null, points }`, `SeuilNiveau { des, niveau }` ; `estimation.confiance = { localisation: { immeuble, rue, quartier: PalierRayon[], commune }, comparables: Palier[], dispersion: Palier[], anciennete: Palier[], ancienneteSupposeeMois, niveaux: SeuilNiveau[] }` ; `estimation.marges: Record<NiveauConfiance, number>`.
- `packages/moteur/src/regles/2026-09.ts` : valeurs de la discovery, commentaire daté « Choix Deklic, 14/09/2026 ».
- `packages/moteur/src/schema/marche.ts` : `PrecisionDvfSchema`, `DvfSchema` + `precision?`, `ancienneteMedianeMois?` (entier ≥ 0), `periode?` (`{ debut, fin }` au format `AAAA-MM-JJ`), `lieu?` (1 à 120 caractères).
- `packages/moteur/src/estimation/confiance.ts` (nouveau, < 150 lignes) :
  - `interpolerPaliers(paliers, valeur)` : paliers triés par valeur croissante ; en deçà du premier, ses points ; au-delà du dernier, ses points ; entre deux, interpolation linéaire. Sert aussi bien à un barème croissant (comparables) que décroissant (dispersion, ancienneté).
  - `precisionDe(dvf)` : `dvf.precision`, sinon `quartier` si `rayonMetres` est connu, sinon `commune`.
  - `dispersionDe(dvf)` : `(q3 − q1) ÷ médiane`, `null` sans les deux quartiles.
  - `pointsLocalisation(precision, rayonMetres, regles)` : table ; pour `quartier`, premier palier dont `jusquaMetres` est `null` ou ≥ rayon (rayon inconnu = dernier palier).
  - `confianceEstimation(dvf, regles)` : quatre composantes `{ code, valeur, points (entier), maximum, supposee }` ; `note` = somme ; `niveau` = premier seuil atteint. Maxima = valeur la plus haute de chaque barème.
- `packages/moteur/src/estimation/index.ts` : `EstimationPrix.confiance: ConfianceEstimation` ; `marge = regles.estimation.marges[confiance.niveau]` ; `niveauConfiance` supprimée ; exports de `confiance.ts`.
- `packages/moteur/src/schema/resultats.ts` : `confiance` en objet strict (`note`, `niveau`, `precision`, `composantes[]`).

Tests : `tests/estimation/confiance.test.ts` (paliers, précision déduite, dispersion, cas de Pierre, cinq niveaux, ancienneté supposée, maxima = 100), `tests/estimation/estimation.test.ts` (objets de confiance et marges attendues), `tests/regles/regles.test.ts` (barèmes cohérents : paliers croissants, niveaux décroissants, marges croissantes quand la confiance baisse), schéma de sortie.

## US-2 — data et worker

Data :

- `data/src/schemas/dvf.ts` : `StatistiquesTypeSchema` + `dateMediane: z.iso.date().optional()` (absente des index publiés avant le 14/09/2026).
- `data/src/sources/dvf/statistiques.ts` : `dateMedianeDesVentes(ventes)` = dates triées, élément d'indice `⌊(n − 1) ÷ 2⌋` ; `statistiquesDesVentes` l'ajoute.

Worker :

- `apps/worker/src/donnees/anciennete.ts` (nouveau) : `moisEntre(dateIso, maintenant)` = mois entiers écoulés (30,4375 jours), jamais négatif ; `milieuDePeriode(debut, fin)` ; `ancienneteMois(dateMediane | null, periode, maintenant)`.
- `apps/worker/src/marche/fichiers.ts` : `StatistiquesSchema` + `dateMediane` optionnelle.
- `apps/worker/src/marche/assembler.ts` : `DvfMarche` + `dateMediane: string | null`, `ancienneteMedianeMois: number` ; `assemblerMarche(parametres, departement, fichiers, maintenant)`.
- `apps/worker/src/marche/route.ts` : `VERSION_CONTRAT = 2`, passe `deps.maintenant()`.
- `apps/worker/src/adresse/analyse.ts` : `Groupe` + `dateMediane: string | null`, `periode: { debut, fin } | null` (comparables du groupe) ; `Reference` les reprend.
- `apps/worker/src/adresse/route.ts` : `VERSION_CONTRAT = 4` ; `reference` enrichie de `ancienneteMedianeMois`.
- `apps/worker/src/app.ts` : `VERSION_WORKER = '0.7.0'`.

Tests : `data/tests/sources/dvf/statistiques.test.ts`, `source.test.ts` (index attendu avec `dateMediane`), `data/tests/schemas/schemas.test.ts` ; `apps/worker/tests/marche.test.ts` (date médiane, ancienneté, milieu de fenêtre, clé de cache v2), `adresse.test.ts` (période et date médiane du repère et des groupes, ancienneté, v4), `anciennete.test.ts`.

## US-3 — web : enrichissement

- `apps/web/src/enrichissement/contrat.ts` : `/marche` `dvf` + `fenetre?`, `dateMediane?` (nullable), `ancienneteMedianeMois?` ; `/marche/adresse` `reference` + `dateMediane?`, `periode?`, `ancienneteMedianeMois?` (tous optionnels : ancien Worker toléré).
- `apps/web/src/enrichissement/marche.ts` : `marcheDepuisReponse` écrit `precision: 'commune'`, `lieu` (si la commune est connue), `periode` (= fenêtre), `ancienneteMedianeMois` ; provenance `dvf` sur les champs chiffrés.
- `apps/web/src/enrichissement/adresse.ts` : `precisionDuGroupe(code)` (`meme_parcelle`, `parcelles_voisines` → immeuble ; `meme_cote`, `en_face` → rue ; `rayon_*` → quartier) ; `marcheDepuisReference` écrit `precision`, `periode`, `ancienneteMedianeMois`.

Tests : `tests/enrichissement.test.ts`, `tests/adresse.test.ts`.

## US-4, US-5, US-6 — web : écrans et textes

- `apps/web/src/textes/confiance.ts` (nouveau) : `LIBELLES_CONFIANCE` (cinq), `TON_CONFIANCE`, `LIBELLES_COMPOSANTES`, `phraseNote(confiance)` (« Confiance bonne · 72 sur 100 »), `raisonComposante(composante, dvf)` (les phrases de la discovery), `PHRASES_CONFIANCE` (sans repère, invitation à l'adresse, ancienneté supposée), `libellePeriode(periode)` (« entre janvier 2024 et décembre 2025 »), `phraseRepere(dvf, type)`.
- `apps/web/src/textes/estimation.ts` : `LIBELLES_CONFIANCE` déplacée vers `confiance.ts` (réexportée).
- `apps/web/src/ecrans/adresse/Confiance.tsx` : `CarteConfiance` (pastille de niveau, note, liste `<ul>` des composantes avec points « 22/35 », phrase d'invitation quand la précision est `commune`).
- `apps/web/src/ecrans/adresse/Repere.tsx` : `CarteRepere` (repère du projet : lieu, ventes, période, médiane, quartiles, ancienneté, pastille « Moins précis : repère de commune », badge de provenance ; sans repère : phrase).
- `apps/web/src/ecrans/Adresse.tsx` : `<CarteConfiance />` après le titre ; `<CarteRepere />` quand l'étape n'est pas `resultat`.
- `apps/web/src/ecrans/adresse/Estimation.tsx` : la pastille de confiance reprend le nouveau libellé.
- `apps/web/src/ecrans/rapport/CartePrix.tsx` : « · confiance bonne (72/100) ».
- `apps/web/src/textes/methode-estimation.ts` : étape « Confiance » et constantes des barèmes.
- `apps/web/e2e/reponses-worker.ts` : champs ajoutés ; `apps/web/e2e/formats.ts` : écran « Estimation sans adresse » (projet d'exemple).

Tests : `tests/confiance-textes.test.ts`, `tests/confiance-ecran.test.tsx` (US-4, US-5 : projet d'exemple, après « Utiliser ce repère », sans repère, provenance « à toi »), `tests/estimation-ecran.test.tsx` et `adresse-ecran.test.tsx` mis à jour, `tests/methode.test.ts`, test du Rapport.

## Décisions

- **La note vit dans le moteur**, pas dans le Worker : elle dépend du repère choisi par l'utilisateur (commune à la création, adresse sur clic, saisie dans Hypothèses) et se recalcule sans réseau.
- **L'ancienneté est mesurée par le Worker** à la date de la réponse et rangée en mois dans le projet ; l'onglet Estimation réanalyse l'adresse à chaque ouverture, ce qui la rafraîchit. Le repère de commune posé à la création n'est pas rafraîchi (comme avant).
- **Champs optionnels partout** : projets enregistrés et ancien Worker restent valides ; les manques sont dits (ancienneté « supposée »).
- **Barèmes en paliers interpolés** plutôt qu'en marches : pas d'effet de seuil entre 9 et 10 ventes, et une règle qui s'écrit en une ligne dans la Méthode.
- **Cinq niveaux** : Pierre demande une confiance « basse » sans adresse et « haute » avec beaucoup de ventes proches ; trois niveaux ne séparaient pas « repère de commune dispersé » de « repère de commune homogène ».

- **Rue limitée par la distance** (demande de Pierre, 14/09/2026) : règle `localisation.rue = { points: 30, jusquaMetres: 150 }` ; au-delà de 150 m, `pointsLocalisation` rend les points du cercle correspondant, jamais plus que ceux d'une rue. La raison affichée donne l'étendue de la rue.
- **Aucun lien vers d'autres estimateurs** (décision de Pierre, 14/09/2026).

## PR 2 — carte des ventes

Décision de Pierre du 14/09/2026 : fond **Plan IGN** de la Géoplateforme. Vérifié le même jour sur le service réel : couche `GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2` publiée dans les capacités WMTS, tuile PNG sans clé, en-tête CORS ouvert.

### Worker (0.8.0, contrat `/marche/adresse` v6)

- `apps/worker/src/adresse/carte.ts` (nouveau) : `ventesSurCarte(situees, estComparable)` rend les ventes comparables géolocalisées à 300 m au plus (`RAYON_CARTE_METRES`), les plus proches d'abord, plafonnées à 300 (`MAX_VENTES_CARTE`). Champs : `lat`, `lon` (au millionième), `date`, `prix`, `surface`, `prixM2Corrige`, `distanceMetres`, `groupes`.
- `apps/worker/src/adresse/analyse.ts` : chaque vente située porte `position` (`{ point, distance }` ou `null`) ; `AnalyseAdresse.ventesCarte`. Même règle de comparable que les ventes proches.
- Pas de nouvel appel réseau : les coordonnées viennent des CSV DVF déjà publiés.

### Web

- `apps/web/src/enrichissement/carte.ts` (pur, couverture 100 %) : `URL_TUILES_IGN` (WMTS, `TILEMATRIXSET=PM`), `ATTRIBUTION_IGN`, `ZOOM_MAX_IGN` (19), `RAYONS_CARTE_METRES` ; `repereCarte(analyse)` (quartiles du repère, sinon du cercle de 300 m) ; `classePrix` (`bas` sous le premier quartile, `haut` au-dessus du troisième, `milieu` sinon) ; `donneesCarte(analyse)`, `null` sans vente géolocalisée ou avec un Worker d'avant la carte.
- `apps/web/src/textes/carte.ts` : titre, phrase, légende, infobulle (« 3 621 €/m² · 58 m² · 210 000 € · 1 mars 2025 · à 40 m »), libellé pour lecteur d'écran, mention du fond IGN.
- `apps/web/src/ecrans/adresse/CarteQuartier.tsx` : carte de l'onglet (titre, légende, mention IGN), `print:hidden` ; charge `CarteVentes` par `React.lazy`, donc Leaflet et son CSS ne pèsent que sur l'onglet Estimation.
- `apps/web/src/ecrans/adresse/CarteVentes.tsx` : `L.map` sans molette ; au doigt (`pointer: coarse`), pas de glisser, la page défile et les boutons zooment ; tuiles IGN, trois cercles, une `circleMarker` par vente avec infobulle, le bien au centre ; cadrage sur le cercle de 300 m ; `role="img"` et libellé, les tableaux restent l'équivalent accessible.
- `apps/web/src/index.css` : couleurs des pastilles lues dans les jetons (`--color-bon`, `--color-encre-4`, `--color-surveiller`, `--color-accent`) ; `.leaflet-container` isolé (`isolation: isolate`) pour rester sous l'en-tête collé ; boutons de zoom de 44 px au doigt.
- Service worker : les tuiles viennent d'une autre origine, jamais interceptées (`strategiePour`).
- Méthode : une étape « Carte des ventes » mentionne le fond IGN et ce qu’il voit.

### Tests

- Worker : liste de la carte (mêmes comparables, sans coordonnées exclues, au-delà de 300 m exclues, autre type exclu, plafond, tri), route. Couverture 100 %.
- Web : `tests/carte-ventes.test.ts` (données et textes), `tests/carte-ventes-ecran.test.tsx` (carte simulée, jsdom ne dessine pas).
- Playwright : `e2e/carte.spec.ts` avec la vraie bibliothèque : 24 pastilles, 3 cercles, le bien, tuiles IGN demandées puis interceptées (`simulerWorker` rend une tuile vide), infobulle, isolation, carte absente à l'impression ; la spec des formats attend la carte sur l'écran Estimation.
