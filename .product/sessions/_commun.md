# Fiches de session — tronc commun

Ce texte est repris en tête de chaque fiche de `.product/sessions/` (les sessions parallèles démarrent dans un worktree qui n'a pas forcément ces fichiers : la fiche complète est collée dans le prompt de lancement).

## Contexte

Dépôt Loupe : `C:\Users\errei\Claude\loupeprojet` (GitHub `immoinvest/loupeprojet`, branche principale `master`). Lis d'abord `CLAUDE.md` (règles, stack, glossaire), `.product/features-registry.md`, `.product/technical-spec.md`, `.product/functional-spec.md` ; la spec de référence est `.product/reference/spec-produit-v1.html`. Pierre, l'utilisateur, vibe-code et ne lit pas le code : rapport en français simple après chaque étape (ce qui change pour l'utilisateur, comment le tester à la main, les risques ou coûts).

## Autorisations

- Pierre a autorisé l'**auto-validation** de tous les points de contrôle du pipeline (discovery, specs, architecture, stories) avec un esprit critique : n'attends aucune validation, écris une courte auto-revue à chaque étape.
- Les PR **fusionnent automatiquement** quand la CI est verte : après `gh pr create`, lance `gh pr merge <numéro> --auto --merge`. Ne demande une décision que pour dépenser de l'argent, supprimer quelque chose ou changer le périmètre produit.
- Une PR est fusionnée par un merge commit ; la branche distante est supprimée après le merge.

## Outils et pièges connus

- `gh` n'est pas dans le PATH de l'outil PowerShell : `& "C:\Program Files\GitHub CLI\gh.exe" …` (connecté au compte `immoinvest`).
- Ne jamais réécrire un fichier source avec `Get-Content`/`Set-Content` PowerShell (corruption UTF-8) : outils Write/Edit uniquement. Messages de commit avec accents : écrire le message dans un fichier temporaire et `git commit -F`.
- Pas de `Co-Authored-By`, pas de signature de commit. Format `feat(scope): US-N — description`.
- Node 24 en local, 22 en CI. Vitest 3 en mode projets : les seuils de couverture se déclarent dans `vitest.config.ts` à la racine, par glob.
- Le serveur de prévisualisation web se lance avec l'outil preview (`.claude/launch.json`, nom `web`).

## Travail en parallèle

D'autres sessions travaillent en même temps (worker → extraction LLM → enrichissement marché ; extension ; référentiels ; garder/Comparer/Méthode ; e2e Playwright). Règles :

1. Commence par `git fetch origin` puis `git checkout -b feat/<slug> origin/master`.
2. N'écris pas dans `.product/pipeline-state.json` (réservé à la session principale) : tiens ton état dans `.product/pipeline/<slug>.json` (même schéma).
3. Ne modifie `CLAUDE.md`, `README.md`, `.product/features-registry.md`, `.product/technical-spec.md`, `.product/architecture-overview.md` qu'à la toute fin, après `git fetch origin && git merge origin/master` dans ta branche, et seulement les lignes qui te concernent.
4. Ne touche pas aux fichiers « hors périmètre » de ta fiche. Si tu as vraiment besoin d'un changement ailleurs, fais-le minimal et signale-le dans la PR.
5. Si le merge automatique bloque (conflit), fusionne `origin/master` dans ta branche, résous, relance les gates, pousse.

## Gates (avant chaque commit, tous verts)

`npm run lint && npm run format:check && npm run typecheck && npm run test:coverage && npm run build`. Couverture 100 % (lignes, branches, fonctions) sur les modules de logique que tu ajoutes : ajoute leur glob dans `vitest.config.ts` racine. Aucun `TODO`, aucun secret, aucun texte d'annonce persisté, aucune clé API côté client.

## Définition de fini

Discovery (`.product/features/<slug>-discovery.md`) → implémentation par stories avec un commit par story → docs (`.product/architecture/<slug>.md`, registre, README, CLAUDE.md) → PR ouverte et armée en auto-merge → rapport final à Pierre en français simple.
