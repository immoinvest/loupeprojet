# 07 — Visite : une base de questions, des règles d'affichage, onglet masqué quand la visite est faite

Statut : `livrée` (14/09/2026, branche `feat/visite-questions`) · Notée le 14/09/2026 · Dépend de : rien

Livraison : discovery `../features/visite-questions-discovery.md`, specs `../specs/visite-questions-specs.md`, architecture `../architecture/visite-questions.md`. Les cinq questions ouvertes sont tranchées dans la discovery (base de 74 questions sourcées écrite par Claude, sept catégories, neuf questions à valeur, onglet masqué mais route ouverte avec compte rendu, points financiers dans le Rapport).

## La demande de Pierre

> Pour l'onglet Visite, il faut construire une base de données de questions et avoir des règles, en fonction des éléments présents, qui mettent les questions ou pas. Si la visite est déjà faite, il n'y a pas besoin d'avoir cet onglet.

## Ce qui existe aujourd'hui

- Le moteur produit des **points de vigilance** par règles (`packages/moteur/src/verdict/vigilance.ts`) : 14 codes (`PV_AG_ET_CARNET`, `CONFIRMER_CHARGES_COPRO`, `COPRO_EN_PROCEDURE`, `VERIFIER_DPE`, `RENOVATION_ENERGETIQUE_OBLIGATOIRE`, `EXPLIQUER_PRIX_SOUS_MARCHE`, `CONFIRMER_TAXE_FONCIERE`, `RISQUE_NATUREL`, `SANS_ASCENSEUR_ETAGE_ELEVE`, `EFFORT_HCSF_DEPASSE`, `DUREE_PRET_HORS_HCSF`, `PLAFOND_MICRO_DEPASSE`, `LOYER_AU_DESSUS_PLAFOND`, `PS_BIC_A_CONFIRMER`), chacun avec des paramètres ; les phrases et les catégories (« Documents à demander », « À vérifier sur place »…) sont côté web (`apps/web/src/textes/vigilance.ts`).
- L'onglet Visite (`apps/web/src/ecrans/Visite.tsx`) liste ces points par catégorie avec des cases à cocher **non persistées** (« sur cet écran seulement ») et renvoie vers Hypothèses après la visite.
- Le projet enregistré (`apps/web/src/stockage/projets.ts`, `ProjetEnregistre`) ne sait pas si la visite a eu lieu.
- L'impression (`garder`) reprend l'onglet Visite comme un volet du dossier.

## Ce que ça changerait pour l'utilisateur

- Une vraie liste de visite, longue quand il le faut (30 à 60 questions), courte quand le bien est simple : on ne pose la question de l'amiante que pour un immeuble d'avant 1997, celle du plomb avant 1949, celle du règlement de copropriété que si copro, celle de l'autorisation de changement d'usage que si courte durée en ville, celle de la surface des chambres que si colocation, celle de l'ascenseur que si étage ≥ 3…
- Chaque question a une catégorie, une réponse (à vérifier · ok · problème · sans objet), une note, et tout est **conservé** avec le projet.
- Une case « J'ai déjà visité » (à la création ou dans l'onglet) : l'onglet Visite disparaît de la navigation.

## Questions ouvertes

1. **Qui écrit la base ?** Proposition : une première base de ~60 questions rédigée par Claude à partir des listes publiques (ANIL, notaires, PAP, guides de visite), relue par Pierre ; chaque question porte sa source.
2. **Catégories** : Documents à demander · Sur place, le logement · L'immeuble et la copropriété · Le quartier · Questions au vendeur ou à l'agence · Travaux et diagnostics · Exploitation locative — à valider.
3. **Les réponses nourrissent-elles les hypothèses ?** Ex. : « Charges de copropriété confirmées : 1 450 €/an » remplit `charges.coproAnnuel` avec la provenance « à toi ». Proposition : oui pour une poignée de questions à valeur (charges, taxe foncière, DPE, travaux votés), non pour le reste en v1.
4. **Visite faite** : l'onglet disparaît totalement, ou reste accessible comme « Compte rendu de visite » (réponses figées) ? Proposition : disparaît de la navigation, le dossier imprimé garde le compte rendu si des réponses existent.
5. Les points de vigilance financiers du moteur (effort HCSF, plafond micro…) restent-ils dans Visite ? Ils ne se vérifient pas en visite. Proposition : les déplacer vers le Rapport (sous les feux) et ne garder dans Visite que ce qui se vérifie sur place ou se demande au vendeur.

## Pistes techniques et impact

- **Base de questions** : données pures, versionnées, dans `packages/moteur/src/visite/questions.ts` (ou un paquet `packages/visite`) : `{ id, categorie, texte, source, condition, valeur?: { chemin, type } }` ; `condition` = prédicat pur sur `Projet` + `Resultats` (type de bien, copro, année, DPE, étage, mode de location, risques, travaux, feux). Fonction pure `questionsPourProjet(projet, resultats) → Question[]`, testée à 100 % comme le reste du moteur. Les points de vigilance existants deviennent des questions de la base (mêmes conditions).
- **Stockage** : `ProjetEnregistre.visite = { faite: boolean, date?: string, reponses: Record<id, { etat, note? }> }` validé par Zod, migration douce (absent = visite non faite, aucune réponse).
- **Web** : `Visite.tsx` réécrit (groupes, réponses persistées par `mettreAJour`, barre de progression, « Marquer la visite comme faite ») ; `ProjetLayout` masque l'onglet ; Vérifier : case « J'ai déjà visité ce bien » ; impression : volet « Compte rendu de visite » ; Partage : les réponses voyagent dans le fragment (taille à surveiller).
- **Fiche 05** : les questions propres à chaque type d'exploitation s'y rattachent ; écrire la base avec les cinq types en tête.
- **Coût** : aucun appel réseau. Une session pour la base et les règles, une pour l'écran.
