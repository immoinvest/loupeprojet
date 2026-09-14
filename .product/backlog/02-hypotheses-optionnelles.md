# 02 — Hypothèses optionnelles : moins de friction, analyses qui disent ce qui leur manque

Statut : `livrée` (14/09/2026, branche `feat/hypotheses-optionnelles` ; discovery `../features/hypotheses-optionnelles-discovery.md`, specs `../specs/hypotheses-optionnelles-specs.md`, architecture `../architecture/hypotheses-optionnelles.md`, 14/09/2026) · Notée le 14/09/2026 · Dépend de : 01 (revenus), 04 (travaux) : implémentée avant leur fusion, sur décision de Pierre

## La demande de Pierre

> La plupart des choses doivent être optionnelles. Si des choses ne sont pas remplies, elles bloquent effectivement des analyses, et lorsqu'on essaye d'aller sur ces analyses, c'est explicitement écrit qu'il faut les remplir. Ça permettra d'enlever de la friction, car actuellement il faut remplir beaucoup de choses.

## Ce qui existe aujourd'hui

- **Vérifier** (`apps/web/src/ecrans/FormulaireProjet.tsx`, fonction `valider`) exige : prix, surface, code postal, ville, loyer visé, apport, durée du prêt, revenus nets. Le reste est facultatif et « estimé » (badge) par `construireProjet` (`apps/web/src/annonces/`), qui pose des **défauts sourcés** : taux du mois (usure), assurance 0,25 %, vacance 3 semaines, entretien 0,5 %, taxe foncière et copropriété estimées, etc.
- **Moteur** (`packages/moteur/src/schema/`) : le schéma `Projet` exige `achat.prix`, `pret.tauxNominal`, `pret.dureeAnnees`, `location.mode`, `location.loyerHc`, `fiscalite.tmi`, `fiscalite.regime`, `revenusMensuels`, `bien.surface`, `bien.departement`. Tout le reste a un `.default()`. `calculerProjet` calcule **tout ou rien** : pas de résultat partiel.
- **Hypothèses** : les descripteurs marqués `obligatoire: true` (`groupes-*.ts`) refusent une valeur vide ; les autres acceptent le vide et retombent sur le défaut.
- Principe métier n° 5 du projet : **« jamais de case vide »** — chaque hypothèse a une valeur par défaut sourcée et un badge de provenance. La demande ne le contredit pas : elle vise les valeurs qu'on ne peut **pas** deviner (revenus, TMI, apport, parfois loyer) et qu'on force aujourd'hui l'utilisateur à taper avant de voir quoi que ce soit.

## Ce que ça changerait pour l'utilisateur

- Créer un projet avec **trois chiffres** (prix, surface, ville — le loyer proposé par l'ANIL) et voir déjà un rapport.
- Chaque onglet qui a besoin d'une donnée personnelle le dit à sa place : « Pour comparer les régimes, indiquez votre tranche d'imposition » avec le champ juste là, plutôt qu'un formulaire de vingt cases au départ.
- Les feux et indicateurs qui ne peuvent pas être calculés affichent « à compléter » au lieu d'un chiffre bâti sur une valeur inventée.

## Questions ouvertes (à trancher avant la spec)

1. **Quel est le minimum vital de Vérifier ?** Proposition : prix, surface, ville (pour DVF et ANIL). Le loyer visé est proposé (bouton « Estimer le loyer » déjà en place) mais pas exigé. Apport, durée, TMI, revenus : facultatifs.
2. **Bloquer ou dégrader ?** Pour chaque donnée absente, l'analyse peut soit se **bloquer** (message + champ), soit se **dégrader** (calcul partiel : cash-flow avant impôt sans TMI, effort remplacé par la couverture sans revenus). Proposition d'une matrice, à valider :

   | Donnée absente         | Rapport                                   | Fiscalité                       | Revente                    | Verdict                                   |
   | ---------------------- | ----------------------------------------- | ------------------------------- | -------------------------- | ----------------------------------------- |
   | Loyer visé             | bloqué : « Indiquez ou estimez le loyer » | bloqué                          | bloqué                     | feux rendement, cash-flow « à compléter » |
   | Durée / apport du prêt | défaut (20 ans, 0 €) marqué « estimé »    | défaut                          | défaut                     | calculé                                   |
   | TMI                    | cash-flow **avant impôt** + mention       | bloqué : « Indiquez votre TMI » | plus-value calculée (19 %) | feu cash-flow sur l'avant-impôt           |
   | Revenus (fiche 01)     | couverture au lieu de l'effort HCSF       | —                               | —                          | feu effort = couverture                   |
   | Régime retenu          | défaut : le meilleur des quatre           | —                               | —                          | —                                         |

3. **Où vit le message ?** Bandeau en tête d'onglet avec le ou les champs à remplir en ligne (pas de renvoi vers Hypothèses), et le même état dans le Rapport (carte grisée « à compléter »).
4. La TMI a-t-elle un défaut acceptable (30 %, la tranche la plus fréquente chez les investisseurs) ou doit-elle rester « à toi » sans défaut ? Recommandation : sans défaut, car elle change le verdict du tout au tout.

## Pistes techniques et impact

- **Moteur** : deux voies.
  - (A) Le schéma reste strict et c'est le **web** qui pose des défauts et calcule une liste de `manques` par analyse (`apps/web/src/analyses/manques.ts` : `manquesPour(projet, analyse) → Manque[]`). Simple, mais le moteur calcule avec une TMI inventée et le web doit masquer les chiffres qui en dépendent : fragile.
  - (B) Le moteur accepte les absences (`tmi`, `revenusMensuels`, `loyerHc` optionnels) et `Resultats` porte des sections `null` avec un tableau `manques: [{ champ, analyses }]`. Chaque module sait ce qu'il peut calculer sans la donnée (cash-flow avant impôt, couverture). Plus de travail (tests et couverture 100 % à maintenir), mais un seul endroit fait foi.
  - Recommandation : (B), en gardant `calculerProjet` compatible (un projet complet donne exactement les mêmes résultats qu'aujourd'hui).
- **Web** : `valider` de Vérifier réduit ; composant `AnalyseIncomplete` (bandeau + champs) réutilisé par Rapport, Fiscalité, Revente, Comparer ; Méthode explique ce qui est calculé sans quoi.
- **Stockage** : `ProjetEnregistre` doit accepter les projets incomplets (Zod) et les recalculer à l'ouverture comme aujourd'hui.
- **Tests** : matrice ci-dessus traduite en tests du moteur ; e2e « nouveau projet » avec le minimum vital.
- **Risque** : c'est la fiche la plus transversale du backlog ; à faire seule dans une session, après 01 et 04.
