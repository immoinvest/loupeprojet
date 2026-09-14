# Feature Discovery : Rapport, icônes d'information et cash-flow au centre

Fiche de backlog : `../backlog/10-rapport-icones-cashflow.md` (Pierre, 14/09/2026). Session parallèle, web seulement. État : `../pipeline/rapport-cashflow.json`.

## Demande

> Sur le Rapport, chaque élément a souvent un bouton « Pourquoi ? ». Je veux une icône ; en cliquant, une infobulle donne plus d'informations sur ce qu'il y a derrière. Pour l'estimation, un lien direct vers Estimation. Pour l'autofinancement, une infobulle avec plus d'informations. Pour « Combien d'impôts », une redirection vers Fiscalité ; pour « Combien vous restera », un lien vers Revente. Soigner cet onglet : c'est le plus important, et l'autofinancement (avec le crédit, etc.) est le plus vrai ; il faut comprendre le cash-flow. Il est aussi important de comprendre le rendement brut, pas seulement le net déjà affiché.

## Ce qui existe (vérifié dans le code le 14/09/2026)

- `ecrans/Rapport.tsx` : verdict, cinq feux, grille 2 × 2 (Prix, Autofinancement, puis Impôts, Revente) coupée par le bandeau Leviers. Les cartes Impôts et Revente portent des « liens » (« Comparer les 4 régimes », « Détail ») qui ne mènent nulle part : ils déplient un texte.
- `composants/ui.tsx` : `Pourquoi` est un `<details>` ; `TitreCarte` place son `action` à droite du titre (sous le titre en mode document).
- `textes/explications.ts` : cinq textes fixes, sans les chiffres du projet ; `EXPLICATIONS.cashflow`, `.revente` et `.leviers` servent aussi de résumé aux sections de la page Méthode (`textes/methode-*.ts`).
- Moteur, noms exacts (`packages/moteur/src/schema/resultats.ts`) : `r.cashflow.mensuel` (**avant impôt**, régime de croisière, vacance et charges pleines déduites), `r.cashflow.effortEpargne`, `r.cashflow.pointMort` (`null` en courte durée), `r.cashflow.tauxCouverture` (= mensualité assurance comprise ÷ loyer HC, `null` sans loyer), `r.rendement.rendements.{coutTotal, brut, net, netNet}`, `r.rendement.enrichissement.{miseDeDepart, cashflowsCumules, capitalRembourse, total}`, `r.fiscalite.regimes[retenu].impotTotal`, `r.financement.parAnnee` (intérêts et assurance de l'année 1, utilisés par le net-net).
- **Correction de la fiche** : le « Reste chaque mois » affiché aujourd'hui est le cash-flow **avant impôt** (`r.cashflow.mensuel`), pas après. C'est aussi lui que jugent le feu « Cash-flow », le sous-titre du verdict, la synthèse des Hypothèses, Comparer et les scénarios. Le rendement net-net, lui, retient l'impôt de la première année.
- Chiffres de l'exemple (T3 Marseille) : loyer 980 €, crédit et assurance 827 €, charges 307 €/mois, 3 semaines vides 57 €/mois, reste −210 €, couverture 84 %, loyer d'équilibre 1 203 €, rendements 6,8 % brut · 4,3 % net · 1,0 % net-net, impôt 0 € sur 10 ans (meublé au réel), cash net de revente 58 217 €, gain total 13 647 € pour 19 337 € de mise (× 0,7).

## Ce que ça change pour Camille

1. **Une icône ⓘ à côté de chaque titre de carte** et de chaque indicateur clé. Au clic ou au clavier, une infobulle en deux ou trois phrases : ce que mesure le chiffre, comment il est calculé **avec les chiffres de son projet** (formatés depuis les résultats, jamais recopiés), ce qui le fait bouger. Échap ou un clic ailleurs la ferme. Sur papier, le texte s'imprime sous le titre.
2. **Un lien clair vers l'onglet qui détaille** : « Voir l'estimation → » (Prix), « Voir la fiscalité → » (Impôts), « Voir la revente → » (Revente). L'icône et le lien sont deux éléments distincts : ⓘ = toujours une bulle, le lien = toujours un changement d'onglet. L'autofinancement n'a pas d'onglet : sa bulle est la plus complète.
3. **L'autofinancement devient la carte principale**, première et pleine largeur : une cascade loyer → après le crédit → après les charges (= reste chaque mois, le chiffre du feu) → après l'impôt (moyenne mensuelle du régime retenu sur la durée de détention), et à côté trois repères : **part du loyer prise par le crédit** (taux de couverture du glossaire), **effort d'épargne** ou excédent, **loyer d'équilibre** (point mort).
4. **Une carte Rendements** : brut · net · net-net, chacun avec sa définition du glossaire et sa formule chiffrée (« 11 760 € de loyers ÷ 172 987 € de coût total = 6,8 % »).
5. **Multiple sur apport** dans la carte Revente (gain total ÷ mise de départ), l'indicateur de l'Excel de Pierre, avec sa bulle.

## Réponses aux questions ouvertes de la fiche

| #   | Question                        | Décision                                                                                                                                                                                                                                                                                  |
| --- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Une icône, deux comportements ? | Non : ⓘ ouvre toujours une bulle ; le lien vers l'onglet est un élément séparé, en bas de carte (`LienOnglet`).                                                                                                                                                                           |
| 2   | Contenu des bulles              | Phrase + chiffres du projet, générés depuis `Resultats` par des fonctions `(r) => string` de `textes/explications.ts`.                                                                                                                                                                    |
| 3   | Disposition                     | Deux maquettes dans `../design/rapport-cashflow-maquettes.html` ; **A** (autofinancement pleine largeur, puis Prix et Rendements, Leviers, Impôts et Revente) est retenue par défaut ; **B** (autofinancement 2/3 + rendements empilés 1/3, puis Prix pleine largeur) reste disponible.   |
| 4   | Cash-flow affiché               | Le « Reste chaque mois » **reste avant impôt** (cohérent avec le feu, le verdict, Comparer et les scénarios) ; la ligne « Après l'impôt » vient en dessous, avec le régime et la période en clair. Écart assumé avec la proposition de la fiche, dont le constat de départ était inexact. |
| 5   | Impression                      | Oui : en mode document, chaque ⓘ devient son texte sous le titre ; les liens vers les onglets disparaissent (le document contient déjà tous les volets).                                                                                                                                  |

## Périmètre

- **IN** : `composants/ui.tsx` (`Info`, `LienOnglet`, `TitreCarte` à deux emplacements, retrait de `Pourquoi`), `ecrans/Rapport.tsx` et `ecrans/rapport/{CarteAutofinancement,Rendements,CartePrix}.tsx`, `analyses/rapport.ts` (cascade, impôt mensuel moyen, multiple sur apport : les seuls dérivés, purs et testés), `textes/explications.ts` (fonctions chiffrées ; les résumés fixes de la page Méthode conservés), tests de composants et d'écran, parcours e2e Rapport, docs.
- **OUT** : moteur (rien à ajouter), Comparer, Méthode, Hypothèses, Leviers (bandeau inchangé), feux du verdict (la fiche 01 les retouche dans une autre session), infobulles ailleurs que sur le Rapport.

## Contraintes

- Aucun calcul dans les écrans : les soustractions de la cascade, la moyenne mensuelle de l'impôt et le multiple sur apport vivent dans `analyses/rapport.ts`, couverts à 100 %.
- Aucune phrase avec chiffres recopiés : tout passe par `formatage/nombres` depuis `Resultats`.
- Accessibilité : bouton ⓘ de 44 × 44 px, nom accessible « Explication : <titre> », `aria-expanded`, `aria-controls` et `aria-describedby` vers un `role="tooltip"`, ouverture au clic et au focus clavier, fermeture Échap, clic dehors et perte du focus ; la bulle reste hors du `h2` pour que le nom du titre ne change pas (les tests e2e visent les titres exacts).
- Responsive (ADR-007) : mobile d'abord, équivalent `print:` de chaque changement de mise en page, cibles de 44 px mesurées par la spec des formats ; la bulle ne dépasse jamais la largeur de l'écran.
- Direction « Le guide » (ADR-004) : moins de texte visible, les chiffres d'abord, l'explication derrière l'icône.

## Risques

| Risque                                                                      | Mitigation                                                                                                                                                    |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `popover` natif : absent de jsdom 27, positionnement en couche supérieure   | Bulle positionnée en absolu sous l'icône, alignée à gauche ou à droite selon la place disponible ; Échap et clic dehors gérés à la main ; tests déterministes |
| Deux ⓘ ouvertes en même temps                                               | Une bulle se ferme dès qu'on clique ailleurs, y compris sur une autre icône                                                                                   |
| Texte du document imprimé plus long (une bulle par indicateur)              | En mode document, les textes sont en petit corps gris sous le titre, sans encart ; cartes insécables déjà en place                                            |
| Nom accessible du `h2` altéré par le bouton                                 | Le bouton est frère du `h2`, pas enfant ; test e2e `carte(page, titre)` inchangé                                                                              |
| Conflit de fusion avec la session « hypothèses financement » (feu effort)   | Les feux ne sont pas touchés ici ; `git merge origin/master` avant la PR, les deux côtés conservés                                                            |
| Tests d'écran existants (`app.test.tsx` : deux « Non. », `impression.test`) | Les titres de cartes sont conservés ; le texte « ventes signées chez le notaire » reste dans l'explication du prix                                            |

## Auto-validation critique

- **Le reste chaque mois reste avant impôt.** Passer au « après impôt » aurait créé deux cash-flows différents entre le feu et la carte pour le même projet ; la cascade montre les deux, étiquetés.
- **Taux de couverture affiché comme « part du loyer prise par le crédit »** (mensualité ÷ loyer, définition du glossaire et du moteur) plutôt que son inverse « le loyer couvre X % de la mensualité » : aucun dérivé, pas d'ambiguïté avec les charges qui viennent après.
- **Impôt mensuel moyen sur la période** (impôt total ÷ années ÷ 12) plutôt que l'impôt de l'année 1 : au réel, l'année 1 est souvent à 0 alors que l'impôt arrive plus tard ; la moyenne dit ce que ça coûte vraiment. Le libellé le précise (« moyenne sur 10 ans »).
- **Pas de `popover` natif** malgré la recommandation de la fiche : jsdom ne l'implémente pas et le positionnement dans la couche supérieure demanderait l'ancrage CSS, encore inégal. Une bulle absolue sous l'icône fait le même travail ; rien n'empêche de migrer plus tard.
- **`EXPLICATIONS` fixes conservées** pour la page Méthode (« Comparer et Méthode inchangés ») ; les fonctions chiffrées les complètent au lieu de les remplacer.

## Definition of Done

- [ ] `Info` et `LienOnglet` testés (clavier, Échap, clic dehors, mode document)
- [ ] Rapport : cascade, repères, rendements, multiple, liens vers les onglets, textes chiffrés ; tests d'écran et e2e à jour
- [ ] Couverture 100 % sur `textes/` et `analyses/` ; lint, typecheck, suite complète verts
- [ ] Vérification dans le navigateur (ordinateur et téléphone) avec captures
- [ ] Docs : architecture, registre, README, CLAUDE.md, fiche 10 et tableau du backlog → « livrée » ; PR armée en auto-merge
