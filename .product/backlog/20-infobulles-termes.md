# 20 — Une icône ⓘ qui explique chaque terme technique

Statut : `livrée` le 15/09/2026 pour Vérifier et Hypothèses (feature `formulaire-rapide` : [discovery](../features/formulaire-rapide-discovery.md), [specs](../specs/formulaire-rapide-specs.md), [architecture](../architecture/formulaire-rapide.md)) ; les autres onglets restent à brancher avec le composant `Terme` · Notée le 14/09/2026 · Dépend de : 10 (composant `Info`, livrée) ; à coordonner avec 13 (formulaire Vérifier) · Taille : une session (textes + branchement), écriture des définitions comprise

## La demande de Pierre

> Certains champs du formulaire ne sont pas compréhensibles par tout le monde, par exemple « CFE ». Quand un terme n'est pas simple, ajoute une infobulle avec une icône d'information pour expliquer à quoi ça correspond.

## Ce qui existe aujourd'hui

- **Le composant est déjà là** : `apps/web/src/composants/info.tsx` (fiche 10) — icône ⓘ, bulle au clic ou au focus clavier, fermée par Échap / clic ailleurs, positionnée pour ne pas sortir de l'écran (`decalageBulle`), paragraphe simple en mode document (impression, partage). Utilisé dans le Rapport.
- Les hypothèses sont décrites par des `Descripteur` (`apps/web/src/hypotheses/types.ts`) : `libelle`, `unite`, `aide` (phrase **sous** le champ : ce que la valeur change) et `aideSelon`. **Pas de définition du terme lui-même.**
- Le formulaire Vérifier a son propre `Champ` (`ecrans/formulaire/Champ.tsx`) avec `indication`, sans définition non plus.
- Termes affichés tels quels, sans explication (relevé dans `groupes-bien.ts`, `groupes-location.ts`, `groupes-finances.ts` et `FormulaireProjet.tsx`) : **CFE**, Assurance propriétaire (PNO), Taux nominal, Assurance emprunteur, Garantie, Frais de dossier, Différé total, Différé partiel, Vacance, Gestion déléguée, Conciergerie, Commission de la plateforme, Charges refacturées, Forfait de charges, Meublé de tourisme classé, Prélèvements sociaux meublé / nu, Régime retenu, Tranche d'imposition, Provision entretien, Comptable, Honoraires à la charge de l'acquéreur, Négociation, DPE, GES, Lots de copropriété, Copropriété en procédure, Loyer hors charges, Évolution du prix, Mobilier, « sortir des classes E, F ou G ».

## Ce que ça changerait pour l'utilisateur

```
CFE ⓘ                                     120 €/an
   ┌────────────────────────────────────────────┐
   │ Cotisation foncière des entreprises : un   │
   │ impôt local dû par les loueurs en meublé,  │
   │ comme toute activité commerciale. …        │
   │ Source : service-public.fr                  │
   └────────────────────────────────────────────┘
```

- À côté de chaque terme qui n'est pas du langage courant : ⓘ ; au clic (ou au toucher), 2 à 3 phrases simples : **ce que c'est**, **qui paye / quand**, **l'ordre de grandeur ou la règle utile**, puis la source.
- Même explication **partout où le terme apparaît** : formulaire Vérifier, Hypothèses, Financement, Fiscalité, Revente, Rapport, Méthode.
- Les termes simples (Surface, Pièces, Prix affiché) n'ont pas d'icône : pas de pollution visuelle.

## Proposition de réalisation

- **Un glossaire unique** : `apps/web/src/textes/glossaire.ts` — `GLOSSAIRE: Record<CodeTerme, { terme: string; definition: string; source?: { nom: string; url: string } }>` ; écrit une fois, vouvoiement, phrases courtes, aucun chiffre qui ne vienne des règles (un seuil ou un taux est **lu dans `obtenirRegles()`** et inséré, comme les textes de Méthode, pour ne jamais diverger du moteur).
- **Descripteurs** : nouveau champ facultatif `terme?: CodeTerme` ; `ChampHypothese` affiche `<Info sujet={libelle} texte={definition} />` à côté du libellé, **hors du `<label>`** (un clic sur l'icône ne doit pas donner le focus au champ).
- **Formulaire Vérifier** : prop `terme` sur `Champ` (ou sur l'enveloppe de la fiche 13).
- **Autres écrans** : composant `Terme` (`<Terme code="cfe">CFE</Terme>`) pour les mots dans les phrases et tableaux (Fiscalité : micro-BIC, LMNP réel, amortissement, déficit foncier ; Revente : plus-value, abattement, réintégration ; Financement : TAEG, HCSF, IRA ; Rapport : rendement net, cash-flow, TRI).
- **Méthode** : la page Méthode peut lister le glossaire complet (ancre par terme) — lien « En savoir plus » dans la bulle.
- **Accessibilité** : `Info` a déjà le rôle bouton et le nom « En savoir plus sur CFE » (à vérifier) ; bulle reliée par `aria-describedby`.
- **Test de complétude** : un test échoue si un descripteur de la liste « termes techniques » n'a pas de `terme`, ou si un code du glossaire n'est utilisé nulle part.

## Exemples de définitions (à rédiger et sourcer en discovery ; chiffres lus dans les règles)

| Terme                                 | Idée de la définition                                                                                                                                                  | Source à citer                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| CFE                                   | Impôt local des entreprises, dû aussi par les loueurs en meublé ; pas la première année, et exonération sous un seuil de recettes (à vérifier et lire dans les règles) | service-public.fr, impots.gouv.fr |
| Assurance propriétaire (PNO)          | Assurance « propriétaire non occupant » : couvre le logement quand il est vide ou si l'assurance du locataire ne joue pas                                              | service-public.fr                 |
| Taux nominal                          | Le taux d'intérêt du prêt seul, sans assurance ni frais ; le TAEG, lui, les inclut                                                                                     | Banque de France                  |
| Différé total / partiel               | Période au début du prêt où l'on ne rembourse rien (total) ou seulement les intérêts (partiel), souvent pendant les travaux                                            | Banque de France / ANIL           |
| Vacance                               | Part de l'année où le logement n'est pas loué (entre deux locataires) ; 1 mois par an ≈ 8 %                                                                            | —                                 |
| Prélèvements sociaux                  | Impôt de 17,2 % ou 18,6 % selon le cas (lu dans les règles, « à confirmer » si c'est le cas) prélevé en plus de l'impôt sur le revenu                                  | impots.gouv.fr                    |
| Tranche d'imposition                  | Le taux appliqué à la dernière tranche de vos revenus, indiqué sur votre avis d'impôt (« taux marginal »)                                                              | impots.gouv.fr                    |
| DPE / GES                             | Étiquettes de A à G : consommation d'énergie / émissions de gaz à effet de serre ; G interdit à la location depuis 2025 (calendrier lu dans les règles)                | ADEME, service-public.fr          |
| Lots de copropriété                   | Nombre de parts de l'immeuble (appartements, caves, parkings) ; une petite copropriété se gère différemment                                                            | ANIL                              |
| Honoraires à la charge de l'acquéreur | Frais d'agence payés par l'acheteur en plus du prix net vendeur ; ils changent la base des frais de notaire                                                            | ANIL                              |

## Questions ouvertes

1. **Bulle ou phrase sous le champ** : bulle ⓘ pour la définition, et l'actuelle `aide` reste sous le champ pour l'effet sur le calcul (proposition) ; ou tout dans la bulle pour alléger ?
2. **Où s'arrêter** : formulaire + Hypothèses d'abord (proposition, c'est la demande), puis les autres onglets dans la même session si le glossaire est prêt ?
3. **Page glossaire** dans Méthode : oui (proposition) ou pas nécessaire ?
4. **Survol souris** : ouvrir aussi au survol sur ordinateur, ou garder clic et focus seulement (proposition : clic, plus prévisible et identique au doigt) ?

## Tests à mettre à jour

- Vitest : glossaire (chaque définition non vide, chiffres identiques aux règles), complétude des descripteurs, `ChampHypothese` et `Champ` avec icône (clic ouvre, Échap ferme, le clic ne focalise pas l'entrée), mode document (paragraphe), `Terme` dans une phrase.
- Playwright : dans Hypothèses, ouvrir ⓘ de CFE au clavier puis à la souris ; au format téléphone, la bulle tient dans l'écran.

## Coût et risques

- Aucun appel réseau ; quelques Ko de textes.
- Risque : définition fausse ou périmée → chiffres toujours lus dans les règles datées, sources citées, relecture de Pierre sur la liste.
