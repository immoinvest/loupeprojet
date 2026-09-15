# S6 — `adresse-suggestions` (fiche 21)

Branche `feat/adresse-suggestions` · **Prérequis : `feat/formulaire-rapide`** (composant `Combobox`) · Règles : `_regles-nuit.md`

## Objectif

Détail et décisions : `C:\Users\errei\Claude\loupe-backlog\.product\backlog\21-adresse-autocompletion.md`.

1. **Bogue des adresses fiscales d'abord** (première story) : « 9001 route de Galice 13090 Aix-en-Provence » et « 9001 Cité Valcros Aix-en-Provence » doivent aboutir. Route Worker `GET /marche/adresses-dvf` (adresses DVF de la commune regroupées par numéro + code de voie + voie, normalisation, cache 24 h par commune) ; suggestion « adresse du cadastre, N ventes connues » ; `AdresseBien` depuis l'adresse DVF ; message clair pour un numéro ≥ 9000 sans suggestion. Fixtures : les lignes DVF publiques citées dans la fiche.
2. **Autocomplétion** dans l'onglet Estimation : service `/proxy/adresses` (Géoplateforme `autocomplete=1`, biais sur la commune du projet, **aucune écriture KV**, Cache API ou rien), `ChampAdresse` sur le `Combobox` de S3, suggestions BAN puis DVF, **choisir lance l'analyse**, rue sans numéro → « Numéro ? » avec possibilité de continuer sans, pré-remplissage depuis le projet, hors ligne = saisie libre.

## Vérifier avant de commencer

L'état de la branche `fix/meme-adresse-dvf` (worktree `C:\Users\errei\Claude\loupe-fix-adresse`, même zone du Worker) : si une PR est ouverte, **attendre sa fusion** (même boucle que les prérequis) ; si elle n'a jamais été poussée, ne pas y toucher et le signaler dans le rapport.

## Périmètre

`apps/worker/src/{services,adresse,marche}/` (routes et services nouveaux), `apps/web/src/ecrans/Adresse.tsx` (formulaire d'adresse seulement), `composants/saisie/ChampAdresse.tsx`, `enrichissement/` (client), `textes/adresse.ts`, tests Worker et web, e2e avec `page.route`.

## Hors périmètre

Ordre des cartes, repère automatique, tableaux (S7), carte Leaflet (S8).

## Fin

PR fusionnée ; rapport `C:\Users\errei\Claude\rapports-nuit\adresse-suggestions.md` (tester les deux adresses d'Aix après déploiement du Worker) ; action pour Pierre : déployer le Worker.
