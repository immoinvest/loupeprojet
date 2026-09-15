# Sessions de nuit du 14-15/09/2026 — règles communes

À lire en entier avant toute action. La fiche de ta session (même dossier) donne le périmètre ; la ou les fiches de backlog qu'elle cite donnent le détail et les décisions.

## Où sont les documents

- Fiches de backlog et fiches de session : **`C:\Users\errei\Claude\loupe-backlog\.product\`** (worktree local, branche `docs/backlog-formulaire-menu`, jamais poussée). Lis-les par ce chemin absolu : elles ne sont pas sur `master`.
- Dépôt : `C:\Users\errei\Claude\loupeprojet` (GitHub `immoinvest/loupeprojet`, branche `master` protégée : check `verify` requis, branche à jour exigée).
- Lis d'abord `CLAUDE.md` de `master`, puis `.product/features-registry.md`, `.product/technical-spec.md`, `.product/functional-spec.md`, et le tronc commun `C:\Users\errei\Claude\loupe-backlog\.product\sessions\_commun.md` (outils et pièges ; ses commandes de gates sont remplacées par celles ci-dessous).

## Démarrage

1. Tu es dans un worktree neuf. `git fetch origin` puis `git checkout -b <branche de ta fiche> origin/master`. `npm ci` (obligatoire dans chaque worktree).
2. **Attente des prérequis** (si ta fiche en liste) : lance en **arrière-plan** (outil PowerShell, `run_in_background: true`) la boucle ci-dessous avec les branches de tes prérequis ; tu seras réveillé quand elle se termine. Pendant l'attente, tu peux lire le code et les fiches, mais **ne crée ta branche qu'après** (pour partir du `master` qui contient les prérequis).

   ```powershell
   $gh = "C:\Program Files\GitHub CLI\gh.exe"; $branches = @('feat/xxx','feat/yyy'); $debut = Get-Date
   while ($true) {
     $manquantes = @($branches | Where-Object { [int](& $gh pr list --state merged --head $_ --json number --jq 'length') -lt 1 })
     if ($manquantes.Count -eq 0) { 'PREREQUIS FUSIONNES'; break }
     if (((Get-Date) - $debut).TotalHours -gt 11) { "ABANDON : toujours pas fusionnees : $($manquantes -join ', ')"; break }
     Start-Sleep -Seconds 300
   }
   ```

   Si la boucle affiche `ABANDON`, n'implémente rien : écris ton rapport (« bloqué par … ») et arrête-toi.

3. Utilise le skill **`/new-feature`** (outil Skill ; sinon lis `.claude/commands/new-feature.md` et suis-le), avec les équivalences de `CLAUDE.md`. État du pipeline dans `.product/pipeline/<slug>.json` (jamais `.product/pipeline-state.json`).

## Autonomie cette nuit

- Pierre dort : **auto-valide** chaque point de contrôle (discovery, specs, architecture, stories) avec une courte auto-revue critique écrite. Ne pose aucune question.
- **Questions ouvertes des fiches** : applique la **proposition** écrite dans la fiche (ou la décision déjà prise) ; note chaque choix dans ton rapport.
- **Interdit sans Pierre** (à lister dans ton rapport comme « actions pour Pierre ») : déployer le Worker (`npm run deploy`), lancer l'Action « Référentiels », appliquer une migration D1 en production, poser un secret, dépenser de l'argent, supprimer des données, toucher aux réglages Cloudflare / Google / Apple / Resend. Le code doit **fonctionner sans** ces actions (dégradation propre : message « indisponible », ancien format toléré).
- Aucun `TODO`, aucun secret, aucun texte d'annonce persisté, principes métier de `CLAUDE.md` respectés.

## Travail en parallèle

- D'autres sessions tournent en même temps ; chacune a sa branche et son périmètre (liste dans `lancement.md`). Ne touche pas aux fichiers hors de ton périmètre ; si c'est indispensable, changement minimal signalé dans la PR.
- Le PC est lent : pendant le développement, lance les tests **fichier par fichier** (`npx vitest run <fichier>`) ; la suite complète seulement avant la PR.
- **Docs communes** (`CLAUDE.md`, `README.md`, `.product/features-registry.md`, `technical-spec.md`, `functional-spec.md`, `architecture-overview.md`) : seulement à la fin, après `git fetch origin && git merge origin/master`, et seulement tes lignes.
- **Fiches de backlog** : copie **ta ou tes fiches** depuis `C:\Users\errei\Claude\loupe-backlog\.product\backlog\` vers `.product/backlog/` de ta branche, statut passé à `livrée` avec les liens vers discovery / specs / architecture. **Ne modifie pas `.product/backlog/README.md`** (seule la session `liens-hypotheses`, la dernière, le fait).

## Gates (avant chaque commit)

`npm run lint && npm run typecheck && npm run test` (tous verts, 0 avertissement) ; `packages/moteur` à 100 % lignes et branches ; `npm run build` avant la PR ; `npm run test:e2e` avant la PR si tu as touché un parcours web (le job `e2e` n'est pas requis pour la fusion, mais il doit être vert : corrige-le).

## Ouvrir la PR : jamais tant que la file GitHub n'est pas vide

1. **Attendre la file vide** (arrière-plan, tu seras réveillé) — la file = les PR ouvertes, non brouillon, avec fusion automatique armée :

   ```powershell
   $gh = "C:\Program Files\GitHub CLI\gh.exe"
   while ($true) {
     $file = [int](& $gh pr list --state open --json isDraft,autoMergeRequest --jq '[.[] | select(.isDraft == false and .autoMergeRequest != null)] | length')
     if ($file -eq 0) { Start-Sleep -Seconds (Get-Random -Minimum 20 -Maximum 120); $file = [int](& $gh pr list --state open --json isDraft,autoMergeRequest --jq '[.[] | select(.isDraft == false and .autoMergeRequest != null)] | length') }
     if ($file -eq 0) { 'FILE VIDE'; break }
     Start-Sleep -Seconds 180
   }
   ```

2. `git fetch origin && git merge origin/master`, résous les conflits, **relance tous les gates**, pousse.
3. `gh pr create` (description en français : ce qui change, comment tester, actions pour Pierre, fiches couvertes ; terminer par la ligne d'attribution demandée par le système), puis `gh pr merge <n> --auto --merge` (sauf mention contraire dans ta fiche).
4. **Suivre jusqu'à la fusion** (arrière-plan, toutes les 3 min) : `gh pr view <n> --json state,mergeStateStatus` ; `BEHIND` → `gh pr update-branch <n>` ; check `verify` rouge → lis le journal (`gh run view --log-failed`), corrige, pousse ; conflit → étape 2. Termine quand `state` = `MERGED`.
5. Après la fusion, `git checkout master && git pull` dans le dossier principal n'est **pas** nécessaire (worktree) : ne touche pas au dossier principal `loupeprojet`.

## Rapport du matin

Écris **`C:\Users\errei\Claude\rapports-nuit\<slug>.md`** (crée le dossier si besoin ; hors dépôt), en français simple, sans jargon :

1. Résultat : PR (lien), fusionnée ou non, CI.
2. Ce qui change pour l'utilisateur, en 3 à 6 puces.
3. Comment le tester à la main (pas à pas, en production ou en local).
4. Décisions prises à la place de Pierre (questions ouvertes de la fiche).
5. **Actions pour Pierre** (déploiement du Worker, migration D1, Action Référentiels, réglages externes), dans l'ordre.
6. Risques, limites, ce qui n'a pas été fait et pourquoi.
