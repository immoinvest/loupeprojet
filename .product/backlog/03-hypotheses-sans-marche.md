# 03 — Hypothèses : retirer le bloc « Le marché » (DVF)

Statut : `livrée` (14/09/2026, avec la fiche 01 dans la feature `hypotheses-financement`) · Notée le 14/09/2026 · Dépend de : rien

Réponses aux questions ouvertes : (1) pas de saisie manuelle du repère DVF, l'onglet Estimation est la seule porte d'entrée ; (2) le plafond d'encadrement est dans « La location », sous le loyer visé. `descripteurParChemin` n'était appelé avec un chemin `marche.dvf.*` nulle part : les descripteurs DVF et `preparerDvf` ont été supprimés.

## La demande de Pierre

> DVF : retire cette partie-là, car elle est déjà couverte dans Estimation, donc pas besoin de l'avoir.

## Ce qui existe aujourd'hui

- La carte « Le marché » de l'onglet Hypothèses (`GROUPE_MARCHE`, `apps/web/src/hypotheses/groupes-bien.ts`) affiche cinq champs saisissables : prix médian des ventes, premier quart, troisième quart, nombre de ventes (`marche.dvf.*`) et plafond d'encadrement des loyers (`marche.plafondLoyerMensuel`). Son sous-titre dit encore « Bientôt rempli automatiquement » : obsolète depuis `enrichissement-marche` et `dvf-adresse`.
- L'onglet Estimation (`apps/web/src/ecrans/Adresse.tsx`) remplit `marche.dvf` d'un clic (« Utiliser ce repère pour l'estimation ») avec la médiane, les quartiles, le nombre de ventes et le rayon ; l'estimation du moteur (`packages/moteur/src/estimation/`) lit ces valeurs.
- Le plafond d'encadrement n'est **pas** couvert par Estimation : il sert au point de vigilance `LOYER_AU_DESSUS_PLAFOND` (`packages/moteur/src/verdict/vigilance.ts`). Il n'est rempli par aucune donnée publique aujourd'hui (l'encadrement à Paris, Lyon, Lille, Bordeaux, Montpellier… n'est pas dans les référentiels).

## Ce que ça changerait pour l'utilisateur

- Une carte de moins dans Hypothèses, plus de chiffres DVF à taper à la main : la seule porte d'entrée du marché est l'onglet Estimation, qui montre d'où viennent les ventes.
- Le plafond d'encadrement reste saisissable, mais dans « La location », à côté du loyer visé.

## Questions ouvertes

1. Garder une saisie manuelle du repère DVF quelque part (pour les communes sans ventes ou l'utilisateur qui a son propre chiffre) ? Proposition : non ; l'onglet Estimation peut proposer plus tard « Saisir mon propre repère » si le besoin apparaît.
2. Le plafond d'encadrement déménage dans « La location » — d'accord ?

## Pistes techniques et impact

- `GROUPE_MARCHE` retiré de `GROUPES` (`descripteurs.ts`) ; `marche.plafondLoyerMensuel` ajouté à `GROUPE_LOCATION`.
- Vérifier avant de supprimer les descripteurs `marche.dvf.*` : `descripteurParChemin` est-il appelé avec ces chemins ailleurs que dans l'onglet Hypothèses (Adresse, Comparer, Méthode) ? Si oui, garder les descripteurs dans un registre « techniques » non affiché.
- Onglet Hypothèses : le rappel de la synthèse et l'ordre des cartes ne changent pas.
- Tests : `apps/web/tests` de l'onglet Hypothèses et le parcours e2e « Hypothèses » (`apps/web/e2e`) s'ils comptent les cartes ou cherchent « Le marché ».
- Estimation d'effort : une heure. Aucun impact moteur, aucun appel réseau.
