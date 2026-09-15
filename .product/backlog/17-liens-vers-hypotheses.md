# 17 — Chaque chiffre supposé mène à l'endroit où le changer

Statut : `livrée` (15/09/2026, session de nuit S9, feature `liens-hypotheses` : [discovery](../features/liens-hypotheses-discovery.md), [specs](../specs/liens-hypotheses-specs.md), [architecture](../architecture/liens-hypotheses.md) ; questions ouvertes tranchées selon les propositions) · Notée le 14/09/2026 · Dépend de : 10 (liens du Rapport, livrée) ; à faire avant ou avec 13 et 16 (nouveaux chiffres affichés) · Taille : deux sessions

## La demande de Pierre

> Lorsque des hypothèses sont reprises d'un onglet à l'autre, je veux un lien qui me permette d'aller changer l'hypothèse, et qui redirige vers le bon onglet au bon endroit à chaque fois. Comprends le chemin qu'un utilisateur peut prendre et les liens entre ces chemins, pour proposer la navigation la plus fluide possible quand il veut changer une hypothèse.

## Ce qui existe aujourd'hui

- Onglets d'un projet (`apps/web/src/App.tsx`) : Rapport (`/projets/:id`), Estimation (`adresse`), Financement, Hypothèses, Fiscalité, Revente, Visite.
- **Toutes les hypothèses ont déjà une adresse stable** : un descripteur par champ (`apps/web/src/hypotheses/descripteurs.ts`, groupes `groupes-bien.ts`, `groupes-location.ts`, `groupes-finances.ts`) identifié par son **chemin pointé** (`hypotheses.achat.travaux`, `bien.dpe`, `hypotheses.revente.annees`…), modifié partout par `appliquerSaisie`.
- Certains onglets modifient déjà une hypothèse **sur place** : Fiscalité (« Retenir ce régime »), Revente (curseur d'horizon), Visite (`ChampValeur` d'une question), Estimation (état du bien, DPE, repère), Financement (groupe `GROUPE_FINANCEMENT`), `AnalyseIncomplete` (champ manquant).
- **Liens existants** : Rapport → onglets (fiche 10), Rapport → Visite (`Vigilance.tsx`), Visite → Hypothèses et Prêt à gérer → Hypothèses (**haut de page seulement**), Financement → Simulateur. Aucun lien n'amène à un champ précis : la page Hypothèses n'a **ni ancre, ni défilement, ni mise en évidence** d'un champ.
- Beaucoup de chiffres affichés reposent sur une hypothèse sans le dire : loyer, vacance, taux du prêt, durée, apport, tranche d'imposition, évolution du prix, frais de revente, travaux…

## Ce que ça changerait pour l'utilisateur

1. **Chaque chiffre qui repose sur une hypothèse est cliquable** (soulignement pointillé, icône crayon au survol) : « Loyer 720 €/mois ✎ ». Au clic :
   - si l'hypothèse se change **ici** (curseur, tuiles, champ déjà présent dans l'onglet) → on défile jusqu'au champ, il clignote doucement et reçoit le focus ;
   - sinon → **ouverture d'Hypothèses au bon groupe, au bon champ**, mis en évidence et focus dedans.
2. **Retour en un clic** : un bandeau « ← Revenir à Fiscalité » en haut d'Hypothèses après un saut, qui ramène au même endroit de l'onglet d'origine (position de défilement gardée). Le bouton précédent du navigateur fait la même chose.
3. **Après la modification**, un toast « Loyer passé à 750 € — le cash-flow passe à +32 €/mois · Revenir à Fiscalité » : on voit l'effet sans chercher.
4. **Tout lien est partageable** : `/projets/abc/hypotheses#hypotheses.location.loyerHc` ouvre directement le champ.
5. Dans Hypothèses, chaque champ dit **où il sert** (« Utilisé par : Rapport, Fiscalité, Revente ») avec des liens retour vers ces onglets — le chemin inverse.

## Les parcours à rendre fluides (cartographie)

| Je suis sur…       | Je vois…                                   | Hypothèse                                        | Où la changer (proposition)                           |
| ------------------ | ------------------------------------------ | ------------------------------------------------ | ----------------------------------------------------- |
| Rapport            | verdict prix, cash-flow, rendement, effort | prix retenu, loyer, charges, taux, durée, apport | Hypothèses (champ) ; prix → Estimation                |
| Rapport            | feu « prix »                               | repère DVF, état                                 | Estimation (repère, état)                             |
| Estimation         | prix estimé, corrections                   | état, DPE, balcon, étage                         | sur place (déjà) ; étage/balcon → Hypothèses          |
| Financement        | mensualité, TAEG, effort HCSF              | taux, durée, apport, assurance, frais, revenus   | sur place (groupe financement)                        |
| Fiscalité          | impôt par régime                           | régime, tranche, loyer, charges, amortissements  | régime sur place ; tranche, loyer → Hypothèses        |
| Revente            | valeur, plus-value, TRI                    | horizon, évolution du prix, frais de revente     | horizon sur place ; le reste → Hypothèses             |
| Visite             | question « travaux prévus (6 000 €) »      | travaux, charges, DPE                            | sur place (`ChampValeur`, déjà)                       |
| Comparer           | 14 indicateurs par projet                  | toutes                                           | onglet du projet concerné, au champ                   |
| Analyse incomplète | « il manque le loyer »                     | champ manquant                                   | sur place (déjà), lien « voir toutes les hypothèses » |

Règle générale : **on change une hypothèse là où l'on est, si l'onglet sait l'afficher ; sinon on va au champ exact dans Hypothèses, avec un retour immédiat.**

## Proposition de réalisation

- **Adresse d'une hypothèse** : `lienHypothese(projetId, chemin): To` dans `apps/web/src/hypotheses/liens.ts` (pur, testé) → `{ pathname: '/projets/:id/hypotheses', hash: '#' + chemin, state: { depuis: location } }`. Table `OU_CHANGER: Record<Chemin, 'hypotheses' | 'estimation' | 'financement' | 'revente' | 'fiscalite'>` pour les hypothèses qui ont une maison ailleurs.
- **Composant `ValeurHypothese`** (`apps/web/src/composants/`) : affiche la valeur formatée + le lien ; props `chemin`, `children` ; si le champ est dans la page courante (registre de contexte `ChampsSurPlace`), il défile au lieu de naviguer. Remplace progressivement les chiffres « nus » des onglets.
- **Page Hypothèses** : `id={chemin}` sur chaque `ChampHypothese` ; au montage et à chaque changement de `hash` → `scrollIntoView({ block: 'center' })` dans le `main` qui défile (coque fixe, fiche 11 : décalage de l'en-tête collé), focus sur l'entrée, classe `mise-en-evidence` 2 s (animation désactivée si `prefers-reduced-motion`) ; groupe replié ouvert automatiquement.
- **Retour** : `state.depuis` lu par un `BandeauRetour` ; la position de défilement de l'onglet d'origine est déjà gérée par `coque/defilement.ts` (à étendre pour la restaurer au retour au lieu de remettre en haut).
- **Toast d'effet** : comparer `resultats` avant / après `mettreAJour` sur 2-3 indicateurs liés au chemin (table `INDICATEURS_LIES`), texte généré, `aria-live="polite"`.
- **« Utilisé par »** : table inverse générée depuis `OU_CHANGER` et la liste des chiffres affichés par onglet ; tenue à jour par un test qui échoue si un `ValeurHypothese` pointe vers un chemin inconnu.
- **Impression / partage** : en mode document, `ValeurHypothese` rend la valeur sans lien.

## Questions ouvertes

1. **Changer sur place ou aller dans Hypothèses** : la règle ci-dessus (proposition), ou toujours ouvrir une petite fenêtre d'édition sur place pour ne jamais quitter l'onglet ? La fenêtre est plus fluide mais duplique l'édition de 60 champs ; proposition : sur place quand le champ existe déjà dans l'onglet, sinon saut vers Hypothèses.
2. **Toast d'effet** : utile (proposition) ou trop bavard ?
3. **« Utilisé par »** dans Hypothèses : oui (proposition) ou plus tard ?
4. Tous les chiffres cliquables d'un coup (grosse PR) ou onglet par onglet ? Proposition : session A = mécanique + Rapport + Fiscalité ; session B = les autres onglets et Comparer.

## Tests à mettre à jour

- Vitest : `lienHypothese`, `OU_CHANGER` (tout chemin existe dans les descripteurs), Hypothèses ouvre au bon champ par le hash (focus, groupe ouvert), bandeau de retour, toast (valeurs avant / après), `ValeurHypothese` en mode document.
- Playwright : Rapport → clic « loyer » → Hypothèses au champ loyer, focus → modifier → « Revenir » → Rapport au même endroit avec la nouvelle valeur ; Fiscalité → tranche d'imposition ; lien direct avec hash ; format téléphone (en-tête collé ne cache pas le champ).

## Coût et risques

- Aucun appel réseau, aucun changement de données.
- Risque : trop de soulignés rend la page chargée → style discret, crayon au survol seulement, pas de lien sur les chiffres calculés sans hypothèse directe.
