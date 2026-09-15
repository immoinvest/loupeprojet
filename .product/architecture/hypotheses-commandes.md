# Architecture — hypotheses-commandes (fiche 24)

## Flux

```
Descripteur ──commandeDe(d)──▶ ReglageCommande (pur, hypotheses/commandes.ts)
     │
ChampHypothese(texte, onChange) ─▶ EnveloppeChamp (composants/saisie)
                                  └▶ CommandeHypothese (switch)
                                       montant  → ChampMontant
                                       compteur → Compteur (bornes du réglage)
                                       ouiNon   → Tuiles Oui / Non
                                       tuiles   → Tuiles (options du descripteur)
                                       energie  → EchelleEnergie
                                       annee    → SaisieAnnee (périodes des règles)
                                       duree    → SaisieDuree
                                       apport   → SaisieApport (coût total du projet)
                                       curseur  → Curseur (nuits, occupation)
                                       taux / texte → <input> texte
     texte ──onChange──▶ appliquerSaisie (inchangé)
```

## Fichiers

| Fichier                                                                                | Rôle                                                                                  |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `apps/web/src/hypotheses/commandes.ts` (nouveau, pur, 100 %)                           | `TypeCommande`, `ReglageCommande`, `commandeDe`, bornes par défaut, `texteNuits`      |
| `apps/web/src/hypotheses/types.ts`                                                     | `Descripteur.commande?`, `bornes?`                                                    |
| `apps/web/src/hypotheses/groupes-*.ts`                                                 | déclarations explicites : année, durée, apport, nuits (curseur), bornes des compteurs |
| `apps/web/src/composants/saisie/EnveloppeChamp.tsx` (nouveau)                          | apparence commune (libellé, ⓘ, badge, `data-champ`, aide / erreur, pied)              |
| `apps/web/src/composants/saisie/{SaisieAnnee,SaisieApport,SaisieDuree}.tsx` (nouveaux) | commandes composées à valeur + `onChange`                                             |
| `apps/web/src/ecrans/formulaire/{Champ,ChoixAnnee,ChoixApport,ChoixDuree}.tsx`         | adaptateurs minces du contexte du formulaire                                          |
| `apps/web/src/ecrans/hypotheses/CommandeHypothese.tsx` (nouveau)                       | aiguillage                                                                            |
| `apps/web/src/ecrans/hypotheses/ChampHypothese.tsx`                                    | enveloppe + commande, prop `projet` facultative (apport, sinon montant)               |
| `apps/web/src/coque/champ-cible.ts`                                                    | focus : bouton radio coché d'abord                                                    |

## Décisions

- **D1 Défaut déduit** plutôt que déclaré partout : 60 descripteurs, 6 déclarations.
- **D2 Taux en texte** : un taux peut être négatif et `ChampMontant` n'accepte pas le signe.
- **D3 Montants à deux décimales** : une valeur enregistrée avec centimes n'est jamais tronquée à la saisie.
- **D4 Enveloppe « erreur sinon aide »** comme dans Vérifier (une ligne sous la commande).
- **D5 Choix effaçables** quand le champ n'est pas obligatoire (équivalent de l'option « ? » du `<select>`).
- **D6 Apport 10 % dans Hypothèses** : écrit le montant arrondi (pas de provenance « estimé » hors formulaire).
- **D7 Compteurs** : bornes larges (pièces 1-20, chambres 0-20, étage 0-50, lots 1-9 999 à pas adaptatif, différés 0-36 mois, revente 1-30 ans) ; la saisie au clavier reste libre, la validation Zod dit le reste.
- **D8 Choix de noms de groupes radio** : `nom` = chemin (+ id du composant) pour rester unique dans la page (simulateur à deux offres).

## Ordre d'implémentation

1. `commandes.ts` + types + déclarations (US-1) → commit.
2. `EnveloppeChamp` + `Champ` adaptateur (US-2) → commit.
3. `Saisie*` + adaptateurs `Choix*` → commit.
4. `CommandeHypothese` + `ChampHypothese` + focus (US-3, US-4, US-5) → migration des tests → commit.
5. e2e (US-6) → commit.

## Auto-revue

Pas de nouvelle dépendance, pas de réseau, pas de stockage. Le point fragile est le focus d'ancre et l'unicité des noms de boutons radio ; tous deux testés. Validé.
