# Architecture — `audit-calculs` (fiche 22)

## Fichiers

| Fichier                                                            | Rôle                                                                                                                                                                                     |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/moteur/src/exemples/projet-92k.ts`                       | `projet92k` : entrées de l'Excel en `ProjetEntree` ; exclu de la couverture comme `t3-marseille.ts` ; non exporté par `index.ts` (cas de test, pas un exemple d'interface)               |
| `packages/moteur/tests/reference/projet-92k.test.ts`               | Un `describe` par feuille de l'Excel ; constantes `EXCEL` = valeurs enregistrées par Excel ; formules fautives de l'Excel reproduites en clair ; valeurs du moteur recalculées à la main |
| `packages/moteur/tests/reference/proprietes.test.ts`               | Propriétés fast-check (tableau, TAEG, TRI, rapport complet, conservation des amortissements) ; tirages limités (25 à 60)                                                                 |
| `packages/moteur/package.json`                                     | `fast-check` en devDependency                                                                                                                                                            |
| `.product/audit/excel-92k.md`, `.product/audit/calculs-2026-09.md` | Lecture de l'Excel ; tableau d'écarts, sources, recommandations                                                                                                                          |

Aucun changement du code de calcul dans la PR d'audit. Les corrections 🟥 sont trois PR séparées, chacune avec un test rouge d'abord :

1. `fix/calcul-lmnp-ordre-imputation` — `fiscalite/lmnp-reel.ts` : sur un résultat positif, déduire la dotation de l'année, puis les amortissements différés, puis imputer les déficits antérieurs sur le reste.
2. `fix/calcul-nu-reel-frais-emprunt` — `fiscalite/nu-reel.ts` : frais de dossier et de garantie en charges financières l'année 1 ; assurance et frais d'emprunt traités comme les intérêts pour le plafond d'imputation sur le revenu global.
3. `fix/calcul-plus-value-prix-acquisition` — `revente/index.ts` : prix d'acquisition = `baseFraisAcquisition(achat)` ; frais réels = frais d'acquisition + honoraires acquéreur ; les forfaits de `plusValueImposable` s'appliquent déjà au `prixAcquisition` passé.

## Script jetable (hors dépôt)

`scratchpad/lire.mjs` : dézippe le `.xlsx`, associe feuilles et relations, résout les chaînes partagées, écrit chaque cellule `référence · formule · valeur`. Non versionné : l'Excel reste chez Pierre.

## Auto-revue critique

- Le test de référence fige des valeurs à 2 décimales : un changement volontaire des règles le fera échouer, c'est le but (question ouverte 4).
- Les propriétés sur le rapport complet coûtent ~0,4 s : tirages limités pour le PC lent.
- Les trois corrections touchent `fiscalite/` et `revente/`, modifiés ensuite par la session S4 : changements minimaux, fusionnés avant elle.
- Validé : implémentation.
