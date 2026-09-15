# Discovery — adresse-suggestions

Date : 2026-09-15 (session de nuit S6). Fiche de backlog : `.product/backlog/21-adresse-autocompletion.md`. Demande de Pierre :

> « Dans Estimation, je veux que le choix de l'adresse se fasse de manière plus intelligente, avec une autocomplétion : aujourd'hui c'est dur à remplir. »

Plus un bogue constaté le 14/09/2026 : « 9001 route de Galice 13090 Aix-en-Provence » et « 9001 Cité Valcros Aix-en-Provence » sont refusées.

## Le problème

1. **Adresses fiscales refusées.** `9001`, `9002`… sont des numéros fictifs de la DGFiP ; les voies à code `A…` (FANTOIR) sont des ensembles ou lieux-dits absents de la BAN. La Géoplateforme ne rend que la rue, `phrasePrecision` refuse (« ajoutez le numéro »), alors que les ventes DVF de l'immeuble existent, avec parcelle et coordonnées.
2. **Saisie difficile.** Champ libre, premier résultat du géocodage pris d'office : faute de frappe → introuvable ; rue sans numéro → refus ; homonyme d'une autre ville → mauvais résultat sans le voir.

## Ce que l'utilisateur obtient

- **Suggestions pendant la frappe** dès 3 caractères (pause de 250 ms) : adresses de la BAN, celles du code postal du projet en premier ; flèches, Entrée ou clic ; **choisir lance l'analyse**, le bouton « Analyser » reste.
- **Adresses du cadastre** : quand le texte porte un numéro ≥ 9000, un mot de résidence ou de cité, ou quand la BAN ne connaît pas le numéro tapé, la liste ajoute « 9001 Cite Valcros — adresse du cadastre, 7 ventes connues ». La choisir analyse l'immeuble exact (groupe « Même immeuble » par numéro + code de voie).
- **Rue sans numéro** : choisir une rue ouvre « Numéro ? » ; « Analyser » avec le numéro, ou « Je ne connais pas le numéro » (analyse moins précise, dite comme telle).
- **Numéro fiscal sans suggestion** (bouton « Analyser ») : « Ce numéro vient du cadastre : choisissez l'adresse dans la liste des suggestions, ou tapez le nom de la résidence. » au lieu de « ajoutez le numéro ».
- **Contexte** : aide « Suggestions d'abord à {ville} ({code postal}) » ; champ pré-rempli par l'adresse déjà enregistrée.
- **Hors ligne ou Worker ancien** : saisie libre comme aujourd'hui, « Suggestions indisponibles pour le moment ».

## Contraintes

- Par le Worker (décision 1 de la fiche). **Aucune écriture KV par frappe** : quota gratuit de 1 000 écritures/jour. Suggestions BAN sans cache ; adresses DVF mises en cache une fois par commune et par jour.
- Débit dédié aux suggestions : 120 requêtes/min par IP (nouveau binding `LIMITEUR_SUGGESTIONS`), pour ne pas épuiser les 60/min du proxy pendant la frappe.
- Composant accessible (motif WAI-ARIA combobox), mobile d'abord, cibles de 44 px, champ en 16 px ; `Combobox` générique livré par la session S3 (`formulaire-rapide`).
- Aucun texte d'annonce concerné ; l'adresse tapée part vers l'IGN comme aujourd'hui ; le journal du Worker ne contient pas le texte.
- Fonctionne sans déploiement du Worker (dégradation propre).

## Hors périmètre

Ordre des cartes, repère automatique, tableaux (S7, fiche 14) ; placer le bien sur la carte (fiche 15, question ouverte tranchée : dans la fiche 15) ; champ adresse dans Vérifier.

## Risques

- Formats DVF : ventes sans coordonnées (adresse ignorée si aucune vente n'a de point), même numéro fiscal dans plusieurs voies (deux suggestions distinctes).
- Taille de la liste d'adresses d'une grande commune en KV (quelques centaines de Ko, sous la limite de 25 Mio).
- Libellés DVF en majuscules sans accents : affichés en casse de titre, sans accents.

## Auto-revue critique

- Le biais par position de la Géoplateforme exige le centre de la commune, que le projet ne porte pas : on s'appuie sur la position de l'adresse enregistrée quand elle existe et sur un tri côté client par code postal. Suffisant pour « d'abord dans la ville du projet » sans appel de plus.
- Déclencher la recherche cadastre pour « la BAN ne connaît pas le numéro » peut ajouter une lecture R2 par commune ; elle est mise en cache 24 h par commune, coût négligeable.
- L'autocomplétion ne remplace pas le parcours actuel : les tests existants « taper puis Analyser » restent valables.
  Validé (auto-validation, session de nuit).
