# Architecture — rapport-espaces

Web seul, trois fichiers d'écran, aucun calcul, aucune donnée, aucun appel réseau.

## Fichiers

| Fichier                                     | Changement                                                                                                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/ecrans/rapport/CarteBien.tsx` | Le lien de l'annonce passe dans `TitreCarte action` (à droite du titre, sous le titre en mode document ; `print:hidden` inchangé) ; recette `survol-texte`.                                 |
| `apps/web/src/ecrans/rapport/CartePrix.tsx` | Paragraphe « Un prix aussi bas… » supprimé.                                                                                                                                                 |
| `apps/web/src/ecrans/rapport/Vigilance.tsx` | `className` transmis à `Carte` ; paragraphe du lien de visite en `mt-auto` (en bas de la carte quand elle s'étire, comme `LienOnglet`).                                                     |
| `apps/web/src/ecrans/Rapport.tsx`           | Constante `COLONNE_EMPILEE` (`flex flex-col gap-5`) ; la rangée du prix contient `CartePrix` puis une colonne `CarteRendements` (ou « à compléter ») + `CarteVigilance className="flex-1"`. |

## Pourquoi une colonne empilée plutôt qu'une grille à deux lignes

Une grille `md:grid-cols-2` avec le prix en `row-span-2` répartirait la hauteur du prix entre les deux lignes de droite (le Rendements s'étirerait à nouveau). La colonne flex laisse le Rendements à sa hauteur naturelle et étire seulement la dernière carte (`flex-1`), dont le lien descend en bas : les deux colonnes finissent à la même hauteur. Sous 768 px la grille passe à une colonne et `flex-1` n'a aucun effet.

## Impression

`DEUX_CARTES` garde `print:grid-cols-2` ; la colonne empilée n'a pas de préfixe d'écran, elle vaut aussi sur papier. Le nombre de grilles du Rapport imprimé ne change pas (la carte Vigilance n'était pas une grille).

## Tests

- `tests/rapport.test.tsx` : même parent pour Rendements et Vigilance, colonne à côté du prix, `flex-1`, ordre des titres, phrase absente ; même empilement sans loyer.
- `tests/carte-bien.test.tsx` : le lien est dans la rangée du titre.
- `e2e/rapport.spec.ts` : géométrie réelle (≥ 768 px : même abscisse, Vigilance sous Rendements, bas alignés sur le prix à 2 px ; téléphone : une colonne), phrase absente.
