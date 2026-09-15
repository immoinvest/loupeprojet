# Discovery — rapport-espaces

Date : 15/09/2026. Demande de Pierre (captures du Rapport à l'appui) : « optimise les espaces ».

## Demande

1. Carte « Le bien » : le lien « Voir l'annonce sur leboncoin.fr » occupe une ligne à lui seul ; le mettre en haut à droite.
2. Carte « Combien ça rapporte ? » : beaucoup d'espace vide.
3. Carte « Est-ce que c'est cher ? » : retirer « Un prix aussi bas se vérifie en visite : pourquoi le vendeur baisse ? ».
4. Analyser tous les emplacements du Rapport et proposer une disposition plus serrée.

## Mesures (avant), projet d'exemple, script Playwright sur le serveur de dev

| Largeur | Carte                          | Hauteur | Vide en bas                                  |
| ------- | ------------------------------ | ------- | -------------------------------------------- |
| 1 440   | Est-ce que ça s'autofinance ?  | 485     | 0                                            |
| 1 440   | Est-ce que c'est cher ?        | 372     | 0                                            |
| 1 440   | Combien ça rapporte ?          | 372     | **181**                                      |
| 1 440   | Leviers                        | 165     | 0                                            |
| 1 440   | Avant de faire une offre       | 174     | 0 (une ligne de texte sur 1 136 px de large) |
| 1 440   | Combien d'impôts ?             | 372     | ~140 (lien poussé en bas)                    |
| 1 440   | Qu'est-ce qu'il vous restera ? | 372     | 0                                            |
| 1 180   | Combien ça rapporte ?          | 437     | **246**                                      |
| 820     | Combien ça rapporte ?          | 437     | **230**                                      |

Hauteur du Rapport : 1 980 px (1 440), 2 061 px (1 180), 2 145 px (820), 3 178 px (390), sans la carte « Le bien ».

## Analyse de chaque emplacement

- **Verdict et cinq feux** : dense, rien à gagner.
- **Le bien** : titre, bandeau de photos, pastilles, puis une ligne de 44 px pour le lien. Le lien va à droite du titre (`TitreCarte action`) : une ligne et un espacement de moins (~56 px).
- **Autofinancement** : cascade 3/5 + repères 2/5, aucune zone vide. Inchangé.
- **Prix | Rendements** : le Rendements ne contient que trois chiffres (≈ 190 px de contenu) face à un Prix de 372 px. Retirer la phrase du prix bas enlève ~36 px au Prix.
- **Avant de faire une offre** : pleine largeur pour une ou deux lignes. Sa hauteur (≈ 174 px) comble presque exactement le vide du Rendements : **l'empiler sous le Rendements, à côté du Prix**, supprime une rangée entière (≈ 194 px) et le vide de 181 px.
- **Leviers** : pleine largeur, dense. Inchangé.
- **Impôts | Revente** : ~140 px vides dans Impôts (la revente a quatre lignes). Rien de court à y empiler ; accepté, le lien reste aligné en bas des deux cartes.

## Hors périmètre

- Contenu des cartes (chiffres, explications, liens) : inchangé, sauf la phrase retirée.
- La carte Impôts compare les autres régimes par l'impôt d'exploitation seul (`impotTotal`) alors que la règle de la fiche 16 veut `impotGlobal` : signalé à part, non traité ici.

## Risques

- Ordre sur téléphone : « Avant de faire une offre » passe avant les Leviers (même ordre dans le document imprimé et pour un lecteur d'écran). Lecture : prix → rendement → ce qu'il faut régler → leviers, cohérente.
- Le test e2e d'impression A4 compte les grilles du Rapport : à vérifier.

## Auto-revue

Pierre a demandé une proposition ; l'autorisation d'auto-valider s'applique (disposition réversible, aucune donnée ni calcul changés). Seul choix discutable : le déplacement de « Avant de faire une offre », signalé dans le rapport avec les captures avant / après.
