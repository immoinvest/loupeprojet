# 01 — Hypothèses : le financement

Statut : `livrée` (14/09/2026, feature `hypotheses-financement`, PR `feat/hypotheses-financement`) · Notée le 14/09/2026 · Dépend de : 08 (le bouton y mène, l'outil n'est pas développé maintenant)

Décisions et livraison : `.product/features/hypotheses-financement-discovery.md`, `.product/specs/hypotheses-financement-specs.md`, `.product/architecture/hypotheses-financement.md`. Réponses aux questions ouvertes : (1) un vrai onglet Financement ; (2) le feu devient la couverture (crédit ÷ loyer, 70 % / 100 %), l'effort HCSF ne reste que pour les projets anciens qui portent des revenus ; (3) page « Bientôt » à `/simulateur-pret`, le lien porte déjà le prêt ; (4) Comparer et le partage ne parlent plus de revenus, le PDF gagne le volet Financement.

## La demande de Pierre

> Les hypothèses liées au financement doivent être effectivement sur financement. Les revenus nets ne sont pas demandés, tu peux enlever. Et je veux un bouton qui redirigera vers une simulation de prêt, qui est un outil indépendant d'un projet en particulier, même si pour l'instant on ne va pas développer l'outil.

## Ce qui existe aujourd'hui

- L'onglet Hypothèses (`apps/web/src/ecrans/Hypotheses.tsx`) affiche sept cartes dans l'ordre de `GROUPES` (`apps/web/src/hypotheses/descripteurs.ts`) : Le bien, Le marché, L'achat, Le financement, La location, Les charges, La fiscalité et la revente.
- La carte « Le financement » (`apps/web/src/hypotheses/groupes-finances.ts`, `GROUPE_FINANCEMENT`) contient : apport, durée du prêt, taux nominal, assurance emprunteur, frais de dossier, garantie, différé total, différé partiel… et **« Vos revenus nets »** (`hypotheses.revenusMensuels`).
- `revenusMensuels` est **obligatoire** dans le moteur (`packages/moteur/src/schema/hypotheses.ts`, ligne 106) : il sert au taux d'effort HCSF (`packages/moteur/src/financement/effort.ts` : mensualité assurance comprise ÷ (revenus + 70 % des loyers), seuil 35 %) qui alimente le **feu « effort »** du verdict et le point de vigilance `EFFORT_HCSF_DEPASSE`.
- Le formulaire Vérifier (`apps/web/src/ecrans/FormulaireProjet.tsx`, carte « Vous ») demande aussi les revenus nets, avec validation.
- Il n'existe **pas d'onglet « Financement »** : les onglets du projet sont Rapport, Estimation, Hypothèses, Fiscalité, Revente, Visite (`apps/web/src/coque/ProjetLayout.tsx`). Les résultats du financement (mensualité, TAEG, coût total, effort) sont dans le Rapport.
- L'ancien simulateur de comparaison de prêts a été supprimé le 13/09/2026 ; sa logique d'amortissement avec différés vit dans `packages/moteur/src/financement/amortissement.ts`, testée.

## Ce que ça changerait pour l'utilisateur

- Un endroit unique et clair pour « mon prêt », sans donnée personnelle qui n'a rien à y faire.
- Plus de question sur les revenus dans Vérifier ni dans Hypothèses : une friction de moins à la création.
- Un bouton « Simuler un prêt » qui ouvre un outil à part, pré-rempli avec le prêt du projet.

## Questions ouvertes (à trancher avant la spec)

1. **« Sur financement » veut dire quoi ?** Deux lectures :
   - (a) Un **nouvel onglet « Financement »** entre Hypothèses et Fiscalité, sur le modèle de Fiscalité et Revente : les hypothèses du prêt à gauche, les résultats à droite (mensualité, TAEG, coût total du crédit, tableau d'amortissement, effort), et le bouton « Simuler un prêt ». La carte « Le financement » disparaît alors de l'onglet Hypothèses.
   - (b) Simplement **nettoyer la carte « Le financement »** de l'onglet Hypothèses (retirer les revenus, ajouter le bouton).
   - Recommandation : (a). C'est cohérent avec les autres onglets (une analyse = un onglet où l'on règle ses hypothèses) et ça prépare l'outil 08 avec les mêmes composants.
2. **Que devient le feu « effort » sans les revenus ?** Trois options :
   - Le feu passe à « non évalué » avec la phrase « Indiquez vos revenus pour vérifier l'effort bancaire » (le champ reste disponible, facultatif, dans l'onglet Financement) — c'est la logique de la fiche 02.
   - Le feu est remplacé par le **taux de couverture** (mensualité ÷ loyer), qui ne demande aucune donnée personnelle et dit déjà si le loyer porte le crédit.
   - Les deux : couverture par défaut, effort HCSF si les revenus sont renseignés.
   - Recommandation : la troisième. Le verdict garde cinq feux quoi qu'il arrive.
3. **Le bouton « Simuler un prêt »** : ouvre `/simulateur-pret` (page « Bientôt » tant que 08 n'est pas fait) en passant montant emprunté, durée et taux dans l'URL pour pré-remplir. D'accord pour une page « Bientôt » visible en production ?
4. Faut-il aussi retirer les revenus de la **page Comparer** et de l'**impression** s'ils y apparaissent ?

## Pistes techniques et impact

- **Moteur** : `revenusMensuels` devient optionnel ; `effort.hcsf` devient `null` quand il manque (le type le permet déjà : `hcsf: number | null`) ; le feu effort lit la couverture en repli. Règle datée dans `regles/2026-09.ts` inchangée. Tests : cas « sans revenus » sur `effort.ts`, `verdict`, et `projetExemple` mis à jour.
- **Web** : `GROUPE_FINANCEMENT` retiré de `GROUPES` (option a) ou allégé (option b) ; nouvel écran `ecrans/Financement.tsx` réutilisant `ChampHypothese` et `Ligne` ; onglet dans `ProjetLayout` ; `FormulaireProjet.tsx` sans `revenusMensuels` ni sa validation ; textes des feux (`textes/feux.ts`) ; Méthode (section financement) ; `ModeDocument` pour l'impression ; test e2e « Hypothèses » à adapter et un test « Financement » à écrire.
- **Coût** : aucun appel réseau nouveau.
- **Risque** : les projets déjà enregistrés portent `revenusMensuels` ; le schéma doit continuer à les lire (champ optionnel, pas retiré).

## Sources à consulter pendant la spec

- `.product/functional-spec.md`, section financement et verdict (feux).
- `.product/design/maquette-v1.md` : la maquette prévoyait-elle un écran Financement ?
