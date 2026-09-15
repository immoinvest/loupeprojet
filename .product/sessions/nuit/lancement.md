# Lancement des sessions de nuit — 14-15/09/2026

Toutes les sessions peuvent être lancées **en même temps** : chacune attend seule la fusion de ses prérequis, puis que la file GitHub soit vide avant d'ouvrir sa PR (règles : `_regles-nuit.md`).

## Les sessions

| #   | Fiche de session                                    | Branche                     | Fiches de backlog | Attend la fusion de                                                                                 | Actions pour Pierre au matin                                                                                        |
| --- | --------------------------------------------------- | --------------------------- | ----------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| S1  | [audit-calculs](s1-audit-calculs.md)                | `feat/audit-calculs`        | 22                | —                                                                                                   | lire le rapport d'audit                                                                                             |
| S2  | [coque-menus](s2-coque-menus.md)                    | `feat/coque-menus`          | 12, 18            | —                                                                                                   | —                                                                                                                   |
| S3  | [formulaire-rapide](s3-formulaire-rapide.md)        | `feat/formulaire-rapide`    | 13, 20            | —                                                                                                   | déployer le Worker (service `communes`)                                                                             |
| S4  | [impot-total-revente](s4-impot-total-revente.md)    | `feat/impot-total-revente`  | 16                | `feat/audit-calculs`                                                                                | —                                                                                                                   |
| S5  | [travaux-etat](s5-travaux-etat.md)                  | `feat/travaux-etat`         | 19                | `feat/audit-calculs`, `feat/formulaire-rapide`                                                      | valider le barème « à confirmer »                                                                                   |
| S6  | [adresse-suggestions](s6-adresse-suggestions.md)    | `feat/adresse-suggestions`  | 21                | `feat/formulaire-rapide`                                                                            | déployer le Worker (suggestions, adresses DVF)                                                                      |
| S7  | [estimation-ventes](s7-estimation-ventes.md)        | `feat/estimation-ventes`    | 14                | `feat/adresse-suggestions`                                                                          | déployer le Worker ; relancer l'Action « Référentiels »                                                             |
| S8  | [carte-interactive](s8-carte-interactive.md)        | `feat/carte-interactive`    | 15                | `feat/estimation-ventes`                                                                            | —                                                                                                                   |
| S9  | [liens-hypotheses](s9-liens-hypotheses.md)          | `feat/liens-hypotheses`     | 17                | `feat/formulaire-rapide`, `feat/impot-total-revente`, `feat/travaux-etat`, `feat/estimation-ventes` | —                                                                                                                   |
| S10 | [liens-courts-domaine](s10-liens-courts-domaine.md) | `feat/liens-courts-domaine` | 23                | `feat/coque-menus`                                                                                  | acheter / brancher `deklic.pro`, appliquer la migration D1 **avant** de fusionner la PR (pas de fusion automatique) |

## Pourquoi ces regroupements

- **12 + 18** : deux petites retouches de la coque (menu, en-tête), mêmes fichiers `coque/`.
- **13 + 20** : même formulaire, mêmes composants de champ (`Champ`, `ChampHypothese`) ; les infobulles s'accrochent aux nouvelles commandes. Le composant de suggestions (combobox) créé ici sert à 21.
- **14 seule, puis 15** : 14 réécrit l'onglet Estimation et le contrat `/marche/adresse` ; la carte (15) se branche sur son tableau.
- **22 d'abord** : l'audit fixe les chiffres de référence avant que 16 et 19 ajoutent des calculs.
- **17 en dernier** : elle rend cliquables les chiffres de tous les onglets, qui changent avec 13, 14, 16 et 19.
- **23 à part** : dépend d'actions de Pierre (domaine, OAuth, migration D1) ; code prêt, bascule non activée.

## Ordre probable de la nuit

```
S1 audit ─────┬──► S4 impôt total ───────────────┐
              └──► S5 travaux (après S3 aussi) ───┤
S3 formulaire ┬──► S5                             ├──► S9 liens hypothèses
              └──► S6 adresse ──► S7 estimation ──┴──► S8 carte
S2 menus ─────────► S10 liens courts + domaine (PR laissée ouverte)
```

## Le matin

Rapports dans `C:\Users\errei\Claude\rapports-nuit\` (un par session). Les actions pour Pierre y sont listées ; déployer le Worker **une seule fois** après la dernière PR qui le touche (S3, S6, S7).
