# 09 — Estimation : carte des ventes, chiffres visibles même sans adresse, indice de confiance en tête

Statut : `idée` · Notée le 14/09/2026 · Dépend de : rien

## La demande de Pierre

> Pour Estimation, lorsqu'on met l'adresse d'un bien, on a pas mal de statistiques. J'aimerais une carte qui montre aussi, sur le quartier, les ventes aux alentours. Ensuite, lorsque l'adresse n'est pas renseignée, mettre tout de même les chiffres qui ont été utilisés, même s'ils sont moins précis. Enfin, un indice de confiance sur l'estimation : sans adresse il sera probablement bas, surtout s'il y a de grandes différences de prix dans le quartier ; avec une adresse et plein de ventes à peu près pareilles, récentes, il sera haut. Indiquer cet indice tôt dans l'onglet.

## Ce qui existe aujourd'hui

- L'onglet Estimation (`apps/web/src/ecrans/Adresse.tsx`) : formulaire d'adresse → `GET /marche/adresse` (ventes du même immeuble, parcelles voisines, même côté, en face, cercles 100/200/300 m, communes voisines ; tendance semestrielle), DPE, risques, loyer. Les ventes s'affichent en **tableaux** (`adresse/Tableaux.tsx` : groupes puis ventes une à une) — pas de carte géographique.
- **Sans adresse**, l'onglet ne montre que le formulaire et `CarteEstimation` ; les tableaux, la tendance, le DPE, le loyer, les risques n'apparaissent qu'après analyse. Pourtant le projet a déjà un repère : `marche.dvf` (médiane, quartiles, nombre de ventes de la commune ou de l'arrondissement, posé à la création par `GET /marche`), et c'est lui que l'estimation utilise. L'utilisateur ne voit pas d'où sort le prix estimé.
- La **confiance** existe déjà mais sommairement : `niveauConfiance(dvf, regles)` (`packages/moteur/src/estimation/index.ts`) = élevée si rayon ≤ 300 m et ≥ 10 ventes, moyenne si ≤ 1 000 m et ≥ 5, faible sinon (`regles/2026-09.ts`, `estimation.confiance`) ; elle règle la marge de la fourchette (5 / 8 / 12 %). Elle **ignore la dispersion des prix et l'ancienneté des ventes**, et s'affiche en petite pastille dans `CarteEstimation`, après le formulaire.
- Les CSV DVF publiés (`dvf/<millésime>/<codeInsee>.csv`) portent parcelle, numéro, voie, Carrez ; **à vérifier** : la latitude/longitude par vente (le DVF géolocalisé d'Etalab la fournit).

## Ce que ça changerait pour l'utilisateur

- **En tête d'onglet**, avant tout le reste : « Confiance : élevée » avec ses raisons en clair — « adresse précise · 18 ventes à moins de 200 m · prix resserrés (± 9 %) · ventes de moins de 18 mois » — ou, sans adresse : « faible — repère à l'échelle de l'arrondissement, prix très dispersés (du simple au double) ; indiquez l'adresse pour affiner ».
- **Sans adresse**, une carte « Le repère utilisé » : commune ou arrondissement, médiane et quartiles au m², nombre de ventes, période, avec la mention « moins précis : repère de commune » et le champ d'adresse juste au-dessus.
- **Avec adresse**, une **carte géographique** du quartier : le bien au centre, les ventes en points colorés par prix au m² (ou par groupe : même immeuble, même rue, cercles), cercles 100/200/300 m, survol = prix, surface, date. Les tableaux restent en dessous.

## Questions ouvertes

1. **L'indice** : trois niveaux (comme aujourd'hui) ou une note de 0 à 100 ? Proposition : une note **0-100 affichée en mots** (très faible · faible · moyenne · bonne · élevée) avec ses composantes visibles — pas de score magique sans explication (principe métier n° 7). La marge de la fourchette découle de la note.
2. **Composantes de la note** (à pondérer, règle datée dans `regles/`) : précision de la localisation (adresse / rue / commune), nombre de comparables, dispersion (écart interquartile ÷ médiane), ancienneté médiane des ventes, part des ventes de même type et surface proche, correction de tendance appliquée ou non. Pierre a-t-il d'autres critères en tête ?
3. **Fond de carte** : tuiles IGN Géoplateforme (service public, gratuit, cohérent avec « données publiques ») ou OpenStreetMap ? Chaque tuile chargée révèle la zone consultée au fournisseur de tuiles : acceptable ? Alternative sans tiers : une carte **schématique** sans fond (points sur un plan avec cercles et rue), zéro donnée sortante mais moins lisible. Recommandation : IGN, avec mention dans la page Vie privée.
4. **Pas de coordonnées dans le CSV** (si c'est le cas) : les ajouter au référentiel DVF et republier (Action « Référentiels »), ou placer les ventes à la parcelle par l'API Carto IGN (déjà utilisée) — plus lent, plus d'appels. À vérifier en premier.
5. Sans adresse mais avec code postal : proposer d'emblée « Analyser à la commune » ou attendre l'adresse ?
6. L'Excel de Pierre (feuille « NEW - Revente ») liste des estimateurs en ligne à consulter (PAP, MeilleursAgents, Notaires, SeLoger, RealAdvisor). Une ligne « Comparer avec d'autres estimateurs » (liens sortants, sans données envoyées) en bas de l'onglet : utile ?

## Pistes techniques et impact

- **Moteur** : `confianceEstimation(dvf, regles) → { note, niveau, composantes: [{ code, valeur, points }] }` pur ; `marche.dvf` enrichi (déjà : `medianM2`, `q1M2`, `q3M2`, `nombreVentes`, `rayonMetres` ; à ajouter : `ancienneteMedianeMois`, `precision: 'adresse' | 'rue' | 'commune'`, `periodeReference`) ; `Resultats.estimation.confiance` devient l'objet ci-dessus ; règle `estimation.confiance` réécrite et datée ; tests sur les cas de Pierre (sans adresse + dispersion forte → faible ; adresse + 15 ventes proches récentes → élevée).
- **Worker** : `/marche` et `/marche/adresse` renvoient l'ancienneté et la dispersion ; coordonnées des ventes dans `ReponseAdresse` (contrat v4) si le CSV les a.
- **Data** : colonnes `lat, lon` dans `dvf/<millésime>/<codeInsee>.csv` si absentes (source DVF géolocalisé Etalab, licence ouverte) ; taille des fichiers à surveiller.
- **Web** : composant `CarteVentes` (Leaflet ou MapLibre en dépendance npm, pas de CDN ; tuiles IGN), `CarteConfiance` en tête, `CarteRepere` sans adresse ; `textes/estimation.ts` pour les raisons ; Rapport (résumé de l'estimation) montre la confiance ; Méthode explique la note ; impression : carte remplacée par les tableaux (ou image statique).
- **Coût** : tuiles IGN gratuites sous clé publique « essentiels » ; aucun appel Worker de plus. Une session pour la confiance et le repère sans adresse, une pour la carte.
