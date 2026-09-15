# Architecture : estimation-ventes

Specs : `../specs/estimation-ventes-specs.md`. Aucun changement du moteur.

## Flux

```
Adresse.tsx ──analyser──▶ client.analyserAdresse (contrat=7)
   │                          │
   │                          ▼  Worker /marche/adresse
   │                    analyserAdresse (300 comparables, carrez, parcelle, dépendances, terrain, lots)
   │                          │
   │                    rapprocherDpeVentes ──▶ ADEME dpe03existant ?identifiant_ban_in=… (≤ 4 paquets de 50, KV 7 j)
   │                          ▼
   ├─ decisionRepere(projet, reference) → appliquer | deja | proteger | aucun
   ├─ mettreAJour unique : risques + loyer + repère (précédent gardé en mémoire de l'écran)
   └─ TableauVentes : filtrerVentes → trierVentes → pageDe (état local, remis à zéro par clé d'analyse)
```

## Fichiers

### Temps A (web)

| Fichier | Rôle |
| --- | --- |
| `enrichissement/repere.ts` (nouveau, pur) | `repereManuel(projet)`, `memeRepere(dvf, repere)`, `decisionRepere(projet, repere)`, `appliquerRepere(projet, repere)`, `restaurerRepere(projet, precedent)`, `instantaneRepere(projet)` |
| `ecrans/Adresse.tsx` | ordre des cartes, ligne compacte, écriture unique, état `repere` (appliqué / protégé / précédent) |
| `ecrans/adresse/LigneRepere.tsx` (nouveau) | « Repère appliqué … Annuler » / « Remplacer par le repère de l'adresse » / « Appliquer le repère de l'adresse » |
| `ecrans/adresse/Estimation.tsx` | reçoit `repere?: ReactNode` : bloc « Le repère » (phrase, écart, badge, moins précis) ou phrase de l'analyse ; carte sans estimation qui garde la phrase |
| `ecrans/adresse/Repere.tsx` | supprimé ; son contenu devient `ecrans/adresse/BlocRepere.tsx` (paragraphe « Le repère utilisé » dans la carte Estimation, sans titre de carte) |
| `ecrans/adresse/Tableaux.tsx` | `TableauGroupes` + Min / Max ; `TableauVentes` déplacé |
| `textes/repere.ts` (nouveau) | `PHRASES_REPERE` (`annuler`, `appliquer`, `remplacer`, `protege`), `phraseRepereApplique`, `phraseRepereNonApplique` ; fichier séparé de `textes/adresse.ts`, que S6 modifie en parallèle |
| `ecrans/adresse/LigneRepere.tsx` (nouveau) | états `applique` (Annuler), `deja`, `protege` (Remplacer), `annule` (Appliquer), `role="status"` |
| `textes/adresse.ts` | seulement `titreAdresse` et `changer` pour la ligne compacte (après la fusion de S6) |

### Temps B

| Fichier | Rôle |
| --- | --- |
| `worker/src/adresse/analyse.ts` | `MAX_VENTES_PROCHES = 300`, `ventesProchesTotal`, `ventesProchesTronquees`, `carrez`, `parcelle` ; plus de 300 lignes → `ventes-proches.ts` extrait (`venteProcheDe`, `ventesProchesDe`) |
| `worker/src/adresse/route.ts` | `VERSION_CONTRAT = 7` |
| `web/src/enrichissement/contrat.ts` | champs optionnels (tolérance au Worker 0.10) |
| `web/src/enrichissement/client.ts` | `CONTRAT_ADRESSE = 7` |
| `web/src/enrichissement/ventes.ts` (nouveau, pur) | `CleTri`, `SensTri`, `trierVentes`, `FiltresVentes`, `filtrerVentes`, `pageDe`, `TAILLE_PAGE = 20`, `triSuivant` |
| `web/src/ecrans/adresse/TableauVentes.tsx` (nouveau) | en-têtes-boutons `aria-sort`, filtres `aria-pressed`, pagination, lignes dépliables |
| `web/src/ecrans/adresse/DetailVente.tsx` (nouveau) | contenu du dépliant |
| `web/src/textes/ventes.ts` (nouveau) | libellés des colonnes, filtres, pagination, phrases du détail |

### Temps C

| Fichier | Rôle |
| --- | --- |
| `data/src/schemas/dvf.ts` | `dependances`, `terrain`, `lots` (nullable) ; `EN_TETE_VENTES` + 3 colonnes finales |
| `data/src/sources/dvf/vente.ts` | `nombreDependances`, `surfaceTerrain`, `nombreLots` |
| `data/src/sources/dvf/csv-sortie.ts` | trois cellules de plus |
| `worker/src/adresse/ventes.ts` | lecture des trois colonnes (null si absentes) |
| `worker/src/adresse/dpe-ventes.ts` (nouveau) | `cleBanVente`, `rapprocherDpe` (pur), `lireDpeVentes(deps, cles)` (paquets, cache, journal), `ajouterDpe(ventes, dpes)` |
| `web/src/enrichissement/contrat.ts` | `dpe` d'une vente, `dpeVentes` |
| `web/src/enrichissement/ventes.ts` | clé de tri `dpe`, filtre `passoires` |

## Contrat `/marche/adresse` v7 (ajouts)

```ts
ventesProchesTotal: number;          // comparables avant plafond
ventesProchesTronquees: boolean;
dpeVentes: 'ok' | 'indisponible' | 'sans_adresse';
ventesProches[i]: {
  …v6,
  carrez: number | null;
  parcelle: string | null;
  cleBan: string | null;        // clé BAN de l'adresse de la vente (même donnée publique que `adresse`)
  dependances: number | null;   // null = CSV d'avant la colonne
  terrain: number | null;
  lots: number | null;
  dpe: {
    etiquetteDpe: 'A'…'G'; etiquetteGes: lettre | null;
    consommationM2: number | null; periodeConstruction: string | null;
    energieChauffage: string | null; date: string;
  } | null;
}
```

## Décisions

- **Repère** : décision pure testée à 100 % ; « précédent » vit dans l'état de l'écran (ne voyage pas dans le projet, conforme à la fiche). Protégé si la provenance de `marche.dvf.medianM2` est `utilisateur`.
- **Tri stable** : copie + `sort` avec rang d'origine en dernier critère ; valeurs `null` toujours à la fin.
- **« 2 dernières années »** : 730 jours avant la date la plus récente de la liste (pur).
- **Rapprochement DPE** : clé `codeInsee_codeVoie(minuscules)_numéro sur 5 chiffres` (même format que `cleBanAdresse` du web) ; suffixes ignorés en v1 ; fenêtre `[date − 18 mois, date]` ; score |Δsurface|/surface puis |Δjours|. Paquets en parallèle, clé de cache par liste triée ; un paquet en échec → `indisponible`.
- **Sous-requêtes** : 4 paquets au plus (≤ 200 adresses) : les adresses au-delà n'ont pas de DPE (`dpe: null`).
- **Pas de nouveau service `/proxy`** : le rapprochement est interne à `/marche/adresse`, jamais appelable seul.

## Implémentation (ordre)

1. US-1 + US-2 (web) → commit.
2. US-3 (worker) + US-4 (web) → commit.
3. US-5 (data + lecture Worker) → commit ; US-6 (worker DPE) → commit ; US-7 (web) → commit.

## Auto-revue critique

- Fichiers > 300 lignes surveillés : `analyse.ts` (364) → extraction des ventes proches ; `Adresse.tsx` (280) → ligne de repère et ligne compacte extraites.
- Sécurité : aucune entrée utilisateur ne va vers l'ADEME (les clés BAN viennent du CSV DVF) ; réponses ADEME validées par Zod ; rendu texte uniquement.
- Performance : 300 ventes × tri en navigateur négligeable ; mémo par `useMemo`.
- Validé : on implémente.
