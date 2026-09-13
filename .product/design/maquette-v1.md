# Maquette v1 — structure des écrans (référence, pas le look final)

Source : artifact « Maquette Loupe » (13/09/2026). **Pierre veut une autre direction visuelle** : avant la première feature UI, proposer 2-3 pistes (Rule 10). Ce document conserve la **structure** et les **composants** de la maquette, qui restent valables quelle que soit la direction retenue.

## Tokens de la maquette (à remplacer)

Polices Bricolage Grotesque (titres) + IBM Plex Sans / Mono · accent vert #1E6E5A · fond #EEF2F4 · encre #16232C · feux : good #2E7D4F, warn #A8701B, bad #B23A3A · mode sombre complet · rayons 8–14 px · ombres très légères.

## Barre d'app

Logo « Loupe » · nav : Nouveau projet / Mes projets / Comment c'est calculé · chip « sans compte · sauvegardé sur cet appareil ».

## Écran 1 — Coller

- Titre : « Colle le lien de l'annonce, on s'occupe du reste. »
- Champ URL + bouton Analyser ; tags : portail reconnu, id d'annonce, extension détectée.
- Carte « Lecture en cours » : 4 barres de progression (page lue, champs trouvés 11/14, texte → 3 champs, données publiques 6 sources).
- Séparateur « pas d'extension ? » → 3 cartes : installer l'extension, glisser le bouton-favori, coller le texte.
- Séparateur « pas de lien ? saisir à la main » → 3 champs : prix, surface, ville/CP.
- Colonne droite « Ce qui se passe ensuite » : 4 items (on lit la page, on complète, tu vérifies cinq chiffres, le rapport) + pied : Gratuit · Sans compte · lue chez toi · aucune annonce stockée.

## Écran 2 — Vérifier

- Légende des badges : `annonce` `donnée publique` `estimé` `à toi`.
- 4 groupes en grille de lignes clé/valeur : **Le bien** (prix FAI, honoraires, surface, pièces/chambres, étage/ascenseur, année/lots, DPE/GES en échelle colorée A→G, travaux barème, mobilier), **Le financement** (frais d'acquisition formule, apport*, durée*, taux du mois, assurance, dossier+garantie, montant emprunté, revenus*), **La location** (mode*, loyer visé*, fourchette ANIL, vacance, TF, copro, PNO/comptable/CFE, entretien), **Ta fiscalité** (TMI*, PS, revente envisagée).
- Les 5 lignes `*` sont encadrées (à confirmer par l'utilisateur).
- Colonne droite : « Ce qu'on a trouvé autour » (6 cartes : DVF, DPE officiel, loyer ANIL, taux TF, risques, zone/population) + « Contrôle de cohérence ».
- CTA « Voir le rapport ».

## Écran 3 — Rapport

- En-tête : résumé du bien + actions (Modifier les hypothèses, PDF dossier banque, Partager).
- **Verdict** : carte texte (bord coloré) + carte « Cinq feux » (prix vs DVF, rendement net, cash-flow, effort HCSF, risques) avec valeur.
- **5 KPI** : prix au m² (vs quartier), mensualité, cash-flow/mois, brut · net, mise de départ.
- « Est-ce que c'est cher ? » : jauge Q1 / médiane / Q3 avec position du bien + explication.
- « Le financement » : tableau de lignes (prix, frais, travaux, dossier, total, emprunt, mensualité, TAEG, coût du crédit, effort HCSF).
- « Est-ce que ça s'autofinance ? » : barres loyer / crédit / TF / copro / PNO / entretien → cash-flow ; point mort ; taux de couverture.
- « Et si… » : chips de scénarios cliquables (négocier, colocation, 20 ans, taux +0,5, nu, vacance 2 mois) + tableau « À quel prix ça marche ? » (3 cibles).
- Pied : sources + version des règles + « outil d'aide à la décision, pas un conseil ».

## Écran 4 — Fiscalité & revente

- 4 cartes régimes côte à côte, la meilleure encadrée : nom, hypothèse, gros chiffre (impôt/an ou sur 10 ans), « pourquoi ».
- Timeline 10 ans « quand commences-tu à payer » (cases vertes/ocre).
- « Revente dans 10 ans » : tableau (valeur, agence, CRD, IRA, impôt PV, reste en poche).
- « Ce que ça t'aura rapporté » : mise, cash-flows cumulés, capital remboursé, PV nette, enrichissement, TRI.
- « Préparer la visite » : liste de questions générées par règles.

## Écran 5 — Mes projets

- Liste de cartes : titre + sous-titre (prix, mode, date, statut), 4 métriques (prix vs marché, cash-flow, net, TRI) colorées, 5 points = les cinq feux. Actions : Comparer (n), + Nouveau projet.

## Composants réutilisables identifiés

Badge de provenance · Feu (3 états) · KPI · Ligne clé/valeur éditable · Jauge de fourchette · Barres de flux · Chip scénario · Carte régime · Timeline annuelle · Échelle DPE · Tableau de lignes avec total.
