# Specs : estimation-ventes

Discovery : `../features/estimation-ventes-discovery.md`. Projet d'exemple : T3 65 m², Marseille 5e, 155 000 €, repère de quartier (31 ventes, 500 m). Analyse de test : 144 rue de l'Olivier, repère « même côté » (6 ventes, médiane 3 600 €/m²).

---

## Épopée A : l'adresse d'abord, repère appliqué seul

### US-1 : ordre de l'onglet et repère automatique

En tant que Camille, je veux que l'adresse du bien soit la première chose proposée et que son repère s'applique tout seul, afin d'obtenir l'estimation la plus fiable sans chercher.

Priorité : P0 · Effort : M

```gherkin
Scénario: sans adresse enregistrée, la carte d'adresse vient en premier
  Étant donné le projet d'exemple sans adresse
  Quand j'ouvre l'onglet Estimation
  Alors le premier titre de niveau 2 est « Où se trouve le bien ? »
  Et la carte « Peut-on se fier à cette estimation ? » vient juste après

Scénario: adresse enregistrée : ligne compacte
  Étant donné un projet dont l'adresse est « 144 Rue de l'olivier 13005 Marseille »
  Quand j'ouvre l'onglet
  Alors une ligne affiche l'adresse et un bouton « Changer »
  Et le champ « Adresse du bien » n'apparaît qu'après « Changer »

Scénario: analyse réussie, repère appliqué sans clic
  Quand j'analyse le 144 rue de l'Olivier
  Alors marche.dvf vaut { medianM2 3600, q1M2 3440, q3M2 3750, nombreVentes 6, rayonMetres 90, precision « rue » } en provenance « dvf »
  Et la note de confiance passe de 62 à 78
  Et une ligne dit « Repère appliqué : même côté de la rue, 6 ventes comparables, médiane 3 600 €/m². » avec « Annuler »

Scénario: Annuler
  Quand je clique « Annuler »
  Alors marche.dvf et ses provenances reviennent à la valeur d'avant l'analyse
  Et la ligne propose « Appliquer le repère de l'adresse »

Scénario: repère saisi à la main conservé
  Étant donné marche.dvf.medianM2 en provenance « utilisateur »
  Quand j'analyse l'adresse
  Alors marche.dvf n'est pas modifié
  Et un bouton « Remplacer par le repère de l'adresse » l'applique sur clic

Scénario: réouverture de l'onglet avec le même repère
  Étant donné un repère déjà appliqué identique à celui de l'analyse
  Alors aucune écriture n'est faite et la ligne dit que le repère est appliqué, sans « Annuler »

Scénario: pas de repère ou commune sans ventes
  Alors la carte Estimation dit « Moins de 5 ventes comparables… » ou « Aucune vente publiée… »
  Et le repère du projet ne change pas

Scénario: carte Repère supprimée
  Alors aucun titre « Le repère utilisé » ni « Le repère de prix » n'existe
  Et la carte Estimation affiche le repère (phrase, écart du prix affiché, provenance, « moins précis » pour une commune)
  Et la pastille « cadastre indisponible » quand l'analyse le dit
```

### US-2 : minimum et maximum par groupe

```gherkin
Scénario: colonnes Min et Max
  Alors le tableau « Les ventes, du plus près au plus large » a les colonnes Où, Ventes, Comparables, Médiane, Moitié des ventes entre, Min, Max
  Et la ligne « Même côté de la rue » affiche 2 929 €/m² et 4 000 €/m²
  Et un groupe sans statistiques affiche « — »
```

---

## Épopée B : tri, pagination, détail

### US-3 : Worker, toutes les ventes comparables (contrat v7)

```gherkin
Scénario: plafond de 300
  Étant donné 320 ventes comparables autour du bien
  Alors ventesProches compte 300 ventes, les plus proches d'abord
  Et ventesProchesTotal vaut 320 et ventesProchesTronquees vaut vrai

Scénario: moins de 300
  Alors ventesProchesTronquees vaut faux et ventesProchesTotal le nombre de ventes

Scénario: champs de chaque vente
  Alors chaque vente porte carrez (ou null) et parcelle (ou null)

Scénario: version du contrat
  Alors la clé de cache de /marche/adresse porte la version 7 et CONTRAT_ADRESSE vaut 7 côté web
```

### US-4 : tri, pagination, filtres et détail côté navigateur

```gherkin
Scénario: tri par défaut
  Alors les ventes sont triées par distance croissante, sans distance à la fin
  Et l'en-tête « Distance » porte aria-sort="ascending"

Scénario: changer de tri
  Quand je clique l'en-tête « Prix au m² »
  Alors le tri est croissant ; un second clic le rend décroissant
  Et les valeurs inconnues restent à la fin dans les deux sens
  Et la page revient à 1

Scénario: pagination
  Étant donné 45 ventes
  Alors la page 1 montre 20 lignes et « Page 1 sur 3 »
  Et « Précédent » est désactivé en page 1, « Suivant » en page 3

Scénario: filtres rapides
  Quand j'active « Même immeuble » : seules les ventes du groupe meme_parcelle
  Quand j'active « 2 dernières années » : ventes datées de moins de 24 mois avant la plus récente vente de la liste
  Quand j'active « 3 pièces » (pièces du bien) : ventes au même nombre de pièces
  Alors les filtres se cumulent, la page revient à 1, et « Aucune vente pour ces filtres » s'affiche si rien ne reste

Scénario: tronqué
  Étant donné ventesProchesTronquees vrai
  Alors le titre est suivi de « Les 300 ventes les plus proches sur 1 240. »

Scénario: détail
  Quand je clique « Détail » d'une ligne
  Alors une ligne dépliée montre : prix au m² de l'acte → au prix d'aujourd'hui (coefficient) → ramené à la surface du bien (correction), surface Carrez, pièces, parcelle, place par rapport au bien
  Et le bouton porte aria-expanded="true"

Scénario: nouvelle analyse
  Alors tri, page, filtres et détails ouverts reviennent à leur état initial
```

---

## Épopée C : informations en plus

### US-5 : colonnes DVF dépendances, terrain, lots

```gherkin
Scénario: appartement avec une cave
  Étant donné une mutation d'un appartement et d'une dépendance (code_type_local 3)
  Alors la vente porte dependances 1

Scénario: maison avec terrain
  Étant donné une maison dont les lignes portent surface_terrain 1001
  Alors terrain vaut 1001 (surfaces distinctes par parcelle et nature de culture additionnées)

Scénario: lots
  Alors lots vaut nombre_lots du logement, null quand 0 ou vide

Scénario: CSV
  Alors l'en-tête finit par carrez,dependances,terrain,lots

Scénario: ancien format lu par le Worker
  Étant donné un CSV sans ces colonnes
  Alors dependances, terrain et lots valent null
```

### US-6 : DPE probable des ventes (Worker)

```gherkin
Scénario: rapprochement
  Étant donné une vente du 2025-03-01 de 60 m² au 144 rue de l'Olivier
  Et deux DPE ADEME à la clé 13205_6659_00144 : 62 m² le 2024-12-10 (D), 45 m² le 2025-01-05 (F)
  Alors la vente porte le DPE D (surface à ±10 %, établi dans les 18 mois avant la vente)

Scénario: plusieurs candidats
  Alors le plus proche en surface, puis en date, l'emporte

Scénario: aucun candidat
  Étant donné un DPE établi après la vente, ou 19 mois avant, ou de 70 m²
  Alors la vente porte dpe null

Scénario: une requête par paquet de 50 adresses
  Étant donné 120 adresses distinctes
  Alors 3 requêtes ADEME `identifiant_ban_in` sont faites, au plus 4 paquets, les adresses les plus proches d'abord
  Et chaque paquet est mis en cache 7 jours

Scénario: ADEME en panne
  Alors les ventes n'ont pas de DPE, dpeVentes vaut « indisponible », l'analyse n'est pas mise en cache

Scénario: source
  Quand au moins un DPE est rapproché
  Alors la source ADEME s'ajoute aux sources de la réponse
```

### US-7 : colonnes et filtre DPE (web)

```gherkin
Scénario: colonne DPE
  Alors la colonne « DPE » affiche la lettre ou « — », triable A → G, inconnus à la fin

Scénario: filtre passoires
  Quand j'active « DPE F ou G »
  Alors seules les ventes au DPE F ou G restent

Scénario: détail
  Alors le dépliant montre DPE et GES, consommation en kWh/m²/an, période de construction, énergie de chauffage, date du DPE, avec « DPE probable : rapproché par l'adresse, la surface et la date »
  Et dépendances (« 1 dépendance vendue avec »), terrain et lots quand ils sont connus

Scénario: rien sur les personnes
  Alors aucune colonne ni aucun détail ne parle d'acheteur ou de vendeur
```

## Priorités

P0 : US-1, US-2, US-3, US-4. P1 : US-5, US-6, US-7 (livrées ensemble ou pas du tout).

## Auto-revue critique

- Chaque story a un cas nominal, un cas limite et un cas d'échec.
- US-4 « 2 dernières années » : mesuré depuis la vente la plus récente de la liste plutôt que la date du jour, pour rester pur et stable dans les tests (les DVF ont 6 mois de retard de toute façon).
- Les chiffres de US-1 (62 → 78) reprennent ceux du test de confiance existant : ils valident que le moteur n'a pas bougé.
- Validé : on continue vers l'architecture.
