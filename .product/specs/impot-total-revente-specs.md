# Specs : impôt total par régime (fiche 16)

Discovery : `../features/impot-total-revente-discovery.md`.

## Epic : comparer les régimes sur toute la vie de l'investissement

### US-1 — Moteur : revente et bilan par régime (Must)

En tant que moteur, je calcule pour chaque régime sa revente et son bilan, afin que l'interface compare les régimes jusqu'à la vente.

- Étant donné un projet complet, quand `calculerFiscalite` s'exécute, alors chaque `ResultatRegime` porte `revente` (même forme que `Resultats.revente`), `impotRevente` = `revente.plusValue.impotTotal`, `impotGlobal` = `impotTotal` + `impotRevente`, `enrichissementFinal` = `cashflowApresImpotTotal` + `revente.cashNetVendeur`.
- Étant donné le régime `lmnp_reel`, alors `revente.plusValue.reintegration` = `amortissementsImmeubleDeduits` ; pour `micro_bic`, `micro_foncier`, `nu_reel`, alors elle vaut 0.
- Étant donné le régime retenu, alors `Resultats.revente` est strictement égal à `fiscalite.regimes[retenu].revente` et le TRI est inchangé.
- `ResultatFiscalite.meilleurAuTotal` = régime compatible et éligible au plus grand `enrichissementFinal` ; égalité → premier dans `REGIMES`.
- Cas de référence documentés : exemple T3 revendu à 10 ans (écart LMNP réel / micro-BIC recalculé à la main à partir des amortissements et des abattements) ; revente à perte (impôt de revente nul partout) ; 22 ans (seuls les prélèvements sociaux) ; 30 ans (aucun impôt de revente, même en LMNP réel).
- `ResultatsSchema` valide les nouveaux champs ; 100 % lignes et branches.

### US-2 — Cartes des régimes (Must)

- Étant donné l'onglet Fiscalité d'un projet complet, alors chaque carte affiche « Pendant N ans », « À la revente », « Impôt total », et « Ce qu'il vous reste au total ».
- Étant donné une réintégration positive, alors « À la revente » précise « dont X € dus aux amortissements réintégrés » (X = impôt de revente du LMNP réel − impôt de revente sans réintégration, c'est-à-dire l'écart avec le micro-BIC).
- Pastille « le plus avantageux au total » sur `meilleurAuTotal` ; « meilleur cash-flow » garde sa place.
- Explication du meublé au réel : l'impôt à la revente dû aux amortissements quand il existe ; mention des résidences services.
- Nu au réel : avertissement quand un déficit imputé sur le revenu global l'année A précède une revente avant A + 3.

### US-3 — Graphique, tableau de revente, frise (Should)

- Graphique « Pendant et à la revente » : pour chaque régime affiché, une barre en deux segments (exploitation, revente), texte équivalent lisible par un lecteur d'écran et à l'impression.
- Tableau « La revente selon le régime » : lignes prix de cession, prix d'acquisition majoré, amortissements réintégrés, plus-value brute, abattement IR, abattement PS, impôt sur le revenu, prélèvements sociaux, surtaxe, impôt à la revente, cash net de revente ; une colonne par régime affiché, première colonne collante.
- Frise : dernière case « revente », colorée si le régime retenu paie un impôt à la revente.
- Rappel « Revente dans N ans » avec un lien « Changer l'horizon » vers l'onglet Revente (absent en mode document).

### US-4 — Comparer et Méthode (Should)

- Comparer : indicateur `impotGlobal` « Impôt total (exploitation + revente) », sens bas, meilleure valeur, détail « régime · N ans ».
- Méthode (fiscalité) : une phrase sur l'impôt total et la réintégration.

### US-5 — Documentation (Must)

Architecture, registre, README, CLAUDE.md, fiche 16 copiée et « livrée ».
