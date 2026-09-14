# Specs — location-types

Discovery : `.product/features/location-types-discovery.md`. Rédigées le 14/09/2026.

## Épic A — Moteur : cinq types d'exploitation (PR 1)

### US-1 · Règles datées par type d'exploitation

**En tant que** moteur, **je veux** des défauts par type et des seuils réglementaires sourcés dans `regles/2026-09.ts` **afin que** rien ne soit inventé dans le code.

- Étant donné les règles `2026-09`, quand je lis `exploitation.parType`, alors j'obtiens pour `nu`, `meuble`, `colocation`, `courte_duree`, `moyenne_duree` les défauts listés dans la discovery (§ 5), chacun commenté avec sa source et sa date.
- Étant donné une valeur sans source publique (nuitées, séjours, ménage, énergie, internet, vacance et séjour en moyenne durée, commission de plateforme, nuitée déduite du loyer), alors son chemin figure dans `aConfirmer`.
- Étant donné les règles, alors `exploitation.colocation` porte 9 m² et 20 m³, `exploitation.meubleTourisme` porte la classe minimale E (nouvelle autorisation), D pour tous dès 2034 et 120 jours de résidence principale, `exploitation.bailMobilite` porte 1 et 10 mois.
- `vacanceSemainesColocation` disparaît au profit de `parType.colocation.vacanceSemaines` (même valeur, 4).

### US-2 · Schéma : union discriminée par `mode`

- Étant donné `LocationSchema`, alors il accepte exactement cinq variantes discriminées par `mode` avec les champs de la discovery (§ 6) et refuse une variante mélangée (nuitée sur une location nue) ou un mode inconnu.
- Étant donné un projet en colocation, courte ou moyenne durée avec `fiscalite.regime` nu, alors `HypothesesSchema` le refuse en nommant `fiscalite.regime` ; en nue ou meublée, les quatre régimes restent acceptés.
- `ChargesSchema` porte `energieMensuel` et `internetMensuel` (défaut 0).
- `regimesCompatibles(mode)`, `loyerMensuelHc(location)` (équivalent mensuel hors charges : loyer, chambres × loyer par chambre, nuitée × nuitées) et `estModeMeuble(mode)` sont exportés.
- `defautsPourMode(mode, regles, { loyerMensuel, chambres })` rend une variante complète et les charges propriétaire du type, à partir d'un loyer meublé mensuel de référence ; `loyerMensuelReference(location, regles)` fait le chemin inverse (nue × prime meublé, colocation ÷ prime colocation, nuitée × 30 ÷ 2).

### US-3 · Migration douce des projets enregistrés

- Étant donné un projet enregistré avant cette feature (`meuble_lld`, ou `courte_duree` avec `courteDuree.tauxOccupation` et `fraisMenageParNuit`), quand il passe par `migrerProjet`, alors il est accepté par `ProjetSchema` : `meuble_lld` → `meuble`, occupation × 365 ÷ 12 → `nuiteesParMois` (arrondi au dixième), ménage par nuit × 4 nuits → `menageCoutParSejour`, conciergerie et tourisme classé conservés.
- Étant donné un projet déjà au nouveau format, alors `migrerProjet` le rend inchangé (idempotent) ; une entrée qui n'est pas un objet est rendue telle quelle.
- Étant donné le stockage local et un lien de partage contenant l'ancien format, alors l'app les charge (test dédié sur un JSON figé de l'ancien format, `apps/web/tests`).

### US-4 · Recettes et charges par type

- Nue et meublée : loyers bruts = loyer × 12, vacance = bruts × semaines ÷ 52, nets = bruts − vacance (inchangé, « Projet 92K » et T3 Marseille identiques au centime).
- Colocation : bruts = loyer par chambre × chambres × 12 ; charges récupérées = forfait × chambres × 12 ; vacance sur bruts + récupérées ; nets = (bruts + récupérées) − vacance.
- Courte durée : nuitées = nuitées par mois × 12 ; séjours = nuitées ÷ durée de séjour ; bruts = nuitée × nuitées ; récupérées = séjours × ménage facturé ; vacance 0.
- Moyenne durée : bruts = loyer × 12 ; récupérées = forfait × 12 ; vacance sur le total ; séjours = 12 × (1 − vacance) ÷ durée de séjour.
- Charges d'exploitation : lignes `gestion` (% des nets, hors courte durée), `conciergerie` (courte durée), `plateforme` (courte et moyenne durée), `menage` (séjours × coût), `energie` et `internet` (× 12), en plus des existantes ; comptable et CFE comme aujourd'hui.
- Point mort = loyer mensuel hors charges (total en colocation) qui annule le cash-flow, en tenant compte des forfaits et des frais proportionnels ; `null` en courte durée. Taux de couverture = mensualité ÷ (loyers bruts ÷ 12) pour tous les types.
- Le contrat de sortie (`ResultatsSchema`) déclare les nouveaux champs et codes.

### US-5 · Fiscalité : régimes compatibles

- Étant donné un projet, alors `ResultatFiscalite.compatibles` liste les régimes du type ; `meilleur` et `meilleurImpot` sont choisis parmi les régimes compatibles et éligibles.
- Étant donné une courte durée non classée, alors micro-BIC applique 30 % et 15 000 € ; classée, 50 % et le plafond général (inchangé).
- Le micro-BIC est calculé sur les recettes encaissées (forfaits et ménage facturé compris), les frais de plateforme, de conciergerie et de ménage n'étant déductibles qu'au réel.
- Les régimes nus d'une colocation, courte ou moyenne durée sont projetés (contrat de sortie) avec un loyer nu déduit, sans jamais planter.

### US-6 · Scénarios

- « Colocation » : construit par `defautsPourMode('colocation')` (chambres du bien, loyer meublé de référence × prime colocation ÷ chambres, forfait et charges propriétaire) ; absent quand le projet est déjà une colocation.
- « Passer en nu / meublé » : nue ↔ meublée comme aujourd'hui ; depuis colocation, courte ou moyenne durée, « Passer en meublé » avec le loyer meublé de référence (loyer de marché du projet quand il est connu).
- « Deux mois vides » : 8 semaines de vacance ; en courte durée, nuitées par mois × 10 ÷ 12.

### US-7 · Points de vigilance par type

- Courte durée : `CHANGEMENT_USAGE_COURTE_DUREE` (paramètre `zone` = `paris_petite_couronne` pour 75, 92, 93, 94, sinon `a_verifier`) ; `DPE_MEUBLE_TOURISME` quand le DPE est E, F ou G ; `REGLEMENT_COPRO_LOCATION` en copropriété.
- Colocation : `SURFACE_CHAMBRES_COLOCATION` (chambres, surface moyenne par chambre parties communes comprises, minimum 9 m²) ; `REGLEMENT_COPRO_LOCATION` en copropriété.
- Moyenne durée : `BAIL_MOBILITE_CONDITIONS` (1 à 10 mois).
- `LOYER_AU_DESSUS_PLAFOND` compare le loyer mensuel équivalent (jamais en courte durée).

### US-8 · Web au minimum pour la PR 1

- Les projets d'exemple et de test emploient `meuble` ; l'onglet Hypothèses propose les cinq types dans la liste existante, montre les champs du type et applique `defautsPourMode` quand le type change ; Vérifier crée un projet du type choisi avec le loyer saisi comme référence ; le stockage et le partage migrent à la lecture ; les phrases des nouveaux points de vigilance existent ; l'effort HCSF et l'estimation utilisent le loyer mensuel équivalent.

## Épic B — Écrans (PR 2)

### US-9 · Sélecteur de type dans Hypothèses

- La carte « La location » commence par cinq boutons (groupe radio accessible) ; son titre répète le type : « La location — Colocation ».
- Changer de type reconstruit la variante par `defautsPourMode` (les valeurs propres au type sont badgées « estimé », le loyer de référence est conservé) et règle le régime retenu sur un régime compatible.

### US-10 · Vérifier par type

- La carte « La location » de Vérifier porte les mêmes boutons puis les champs du type : loyer (nue, meublée, moyenne durée) ; chambres louées et loyer par chambre (colocation) ; nuitée et nuitées par mois (courte durée).
- « Estimer le loyer » propose : nu ou meublé par m² ; en colocation, meublé × (1 + prime colocation) ÷ chambres ; en courte durée, le bouton est absent.
- `construireProjet` fabrique la variante du type avec ses défauts badgés « estimé », les charges propriétaire du type, le mobilier pour tout type meublé, comptable et CFE pour les régimes BIC.

### US-11 · Lecture de l'annonce

- Règles de texte : « colocation » → colocation ; « Airbnb », « saisonnier », « meublé de tourisme », « courte durée » → courte durée ; « meublé » → meublée ; sinon rien. La priorité va au plus spécifique.
- Prompt `/extract` v3 : champ `typeLocation` (`nu` | `meuble` | `colocation` | `courte_duree` | `moyenne_duree` | null) « seulement si l'annonce le dit » ; contrat Worker et tests ; réponses v2 en cache toujours lues (champ optionnel côté web).
- Le champ lu pré-remplit le type de Vérifier avec la provenance « annonce ».

### US-12 · Fiscalité, Rapport, Visite, Comparer, Méthode

- Fiscalité : seules les cartes des régimes compatibles ; le chapô dit « Les deux régimes du meublé » ou « Les quatre régimes ».
- Rapport : Levier 2 « Et si je passais en colocation » avec chambres × loyer par chambre ; absent en colocation. Le cash-flow détaille les nouvelles lignes de charges.
- Visite : phrases des nouveaux points, catégories.
- Comparer : ligne « Type de location » ; « Loyer mensuel hors charges » = équivalent mensuel.
- Méthode : une section « Les types de location » avec, par type, la formule des recettes, les charges propres et les défauts (source et « à confirmer ») ; sections cash-flow et scénarios mises à jour.

### US-13 · Preuves et livraison

- Tests e2e : un parcours qui crée une colocation depuis Vérifier et voit le titre « La location — Colocation » dans Hypothèses ; écrans de référence des formats inchangés.
- Worker redéployé (version montée) après la fusion ; docs communes mises à jour ; fiche 05 et tableau du backlog → « livrée ».

## Priorités (MoSCoW)

- Must : US-1 à US-10, US-12 (Fiscalité, Rapport, Visite), US-13.
- Should : US-11 (lecture de l'annonce), US-12 (Comparer, Méthode).
- Won't (v1) : profil saisonnier, type étudiant, encadrement par chambre, TVA para-hôtelière.
