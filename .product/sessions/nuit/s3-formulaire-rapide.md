# S3 — `formulaire-rapide` (fiches 13 et 20)

Branche `feat/formulaire-rapide` · Prérequis : aucun · Règles : `_regles-nuit.md`

## Objectif

1. **Fiche 13** (`…\backlog\13-formulaire-verifier-sans-saisie.md`, trois décisions prises) : formulaire Vérifier avec compteurs, tuiles, échelle DPE / GES, tuiles de périodes de construction, saisies de montants mises en forme, champs masqués selon le type de bien, chambres déduites des pièces, **un seul champ « Commune »** (code postal ou nom → communes, via le Worker), et **le strict minimum d'abord** (ce qui manque parmi l'essentiel visible ; lu dans l'annonce, estimé et facultatif repliés en résumés).
2. **Fiche 20** (`…\backlog\20-infobulles-termes.md`) : glossaire unique `apps/web/src/textes/glossaire.ts` (chiffres lus dans les règles du moteur), icône ⓘ (composant `Info` existant) à côté des termes techniques dans Vérifier **et** Hypothèses (`terme` sur `Descripteur` et `Champ`), composant `Terme` ; les autres onglets : seulement si le temps le permet, sinon noté dans le rapport.

## Composants à écrire pour être réutilisés

`apps/web/src/composants/saisie/` : `Compteur`, `Tuiles` (généralise `SelecteurMode`), `EchelleEnergie`, `ChampMontant`, **`Combobox`** générique (motif WAI-ARIA, anti-rebond, annulation, source asynchrone injectée) et `ChampCommune` qui l'utilise. **La session S6 réutilisera `Combobox` pour l'adresse** : API propre et documentée.

## Worker

Service de proxy `communes` (`apps/worker/src/services/communes.ts`, `geo.api.gouv.fr/communes?codePostal=` et recherche par nom), réponse Zod, cache 30 jours par code postal (une écriture KV par code postal, pas par frappe ; la recherche par nom **sans** cache KV). Pas de déploiement (Pierre) : sans Worker à jour, `ChampCommune` retombe sur la saisie libre code postal + ville.

## Périmètre

`apps/web/src/ecrans/{NouveauProjet,FormulaireProjet}.tsx`, `ecrans/formulaire/*`, `ecrans/hypotheses/ChampHypothese.tsx`, `hypotheses/types.ts` et descripteurs (ajout de `terme` seulement), `composants/saisie/*`, `textes/glossaire.ts`, `enrichissement/` (client `communes`), `apps/worker/src/services/`, tests Vitest et e2e qui remplissent le formulaire (liste dans la fiche 13).

## Hors périmètre

Travaux estimés (S5 : garder le champ Travaux actuel), `CarteAchat` au-delà des infobulles, onglet Estimation (S6, S7), moteur.

## Fin

PR fusionnée ; rapport `C:\Users\errei\Claude\rapports-nuit\formulaire-rapide.md` ; action pour Pierre : déployer le Worker.
