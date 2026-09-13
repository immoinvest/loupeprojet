# ADR-004 : Direction visuelle « Le guide »

**Date** : 2026-09-13 · **Statut** : accepté · **Décideur** : Pierre, sur trois pistes proposées

## Contexte

Trois pistes ont été maquettées sur l'écran Rapport avec les chiffres réels du moteur (canevas : https://claude.ai/code/artifact/641ff5cb-c990-4b67-9e86-688bd484ab29) :

- **A · Le dossier** : papier crème, serif (Newsreader), filets fins, chiffres en colonne. Confiance, PDF banque naturel ; austère.
- **B · Le cockpit** : fond nuit, tuiles denses, monospace, feux vifs. Tout sur un écran ; intimidant, sombre seulement.
- **C · Le guide** : blanc chaud, une couleur vive, cartes arrondies, une question par carte, une phrase sous chaque chiffre. Fidèle à la promesse « chaque chiffre s'explique en une phrase » ; plus long à faire défiler.

## Décision

**Piste C**, avec deux corrections demandées par Pierre :

1. **Moins de texte.** Une réponse courte par carte (« Non. », « Pas tout à fait. »), les chiffres d'abord, une seule phrase d'explication, le reste derrière un « Pourquoi ? » dépliable.
2. **Penser SaaS dès maintenant.** L'interface a une coque d'application : barre latérale avec la liste des projets et « Nouveau projet », profil utilisateur et offre en bas, onglets par volet du rapport (Rapport, Hypothèses, Fiscalité, Revente), actions (PDF, partager, statut du projet). Les fonctionnalités futures (comparaison, extension, compte, abonnement) doivent trouver leur place sans refonte.

## Système visuel retenu (point de départ, ajustable)

| Élément         | Valeur                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------- |
| Titres          | Outfit 600/700                                                                           |
| Texte           | Nunito Sans 400/600/700                                                                  |
| Fond            | #FFFDF9 (blanc chaud) · cartes #FFFFFF · bordures #ECE8E0                                |
| Encre           | #23272F · secondaire #4B5563 · discret #6B7280                                           |
| Accent          | Indigo #4F55D8 · fond doux #EEEEFF / #F7F5FF                                             |
| Feux            | bon #2E9E6B (fond #E3F4EA) · à surveiller #D98A1E (#FBEEDA) · problème #D9453D (#FBE5E3) |
| Rayons          | cartes 20 px · pastilles 999 px · encarts 12 px                                          |
| Ombre           | 0 6px 24px rgba(35,39,47,.05)                                                            |
| Cibles tactiles | ≥ 44 px                                                                                  |

## Conséquences

- La feature `web-socle` implémente cette coque (barre latérale + zone de contenu) avec Tailwind v4 + shadcn/ui ; les tokens ci-dessus deviennent les variables CSS du thème.
- Les textes d'explication longs vivent dans des composants dépliables, pas dans le flux principal.
- Le mode sombre n'est pas prioritaire (la piste sombre a été écartée) ; il pourra venir plus tard via les tokens.
- La spec v1 dit « sans compte » : la coque prévoit le profil dès maintenant (état « sans compte · sauvegardé sur cet appareil » en attendant), pour ne pas la refaire à la v1.5.

## Écarté

Pistes A et B, conservées sur la page « Pistes écartées » du canevas pour mémoire.
