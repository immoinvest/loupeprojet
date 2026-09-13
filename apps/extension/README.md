# Extension navigateur Deklic (`@loupe/extension`)

Avec l'extension installée, **coller le lien d'une annonce dans Deklic suffit** : l'extension ouvre l'annonce dans un onglet de votre navigateur, la lit, referme l'onglet, et le formulaire « Vérifier » se remplit. Sur une annonce déjà ouverte, un clic sur l'icône Deklic fait la même chose. Portails : LeBonCoin, SeLoger, Bien'ici, PAP, Logic-Immo.

La page est toujours lue **dans votre navigateur**, jamais par nos serveurs (ADR-002) ; le texte de l'annonce sert à remplir le formulaire puis disparaît : seuls les champs lus sont conservés. Les noms techniques (`@loupe/…`, `loupeprojet.pages.dev`) sont les noms d'origine du projet, inchangés par l'identité de marque (ADR-005).

## Construire

```bash
npm run build -w apps/extension       # production : ouvre https://loupeprojet.pages.dev
npm run build:dev -w apps/extension   # développement : ouvre http://localhost:5173
npm run dev -w apps/extension         # développement + reconstruction à chaque modification
```

Sortie : `apps/extension/dist/chrome/` (Chrome, Edge, Brave) et `apps/extension/dist/firefox/` (même contenu, manifeste adapté à Firefox). Les icônes sont dessinées au build, rien de binaire n'est versionné.

## Charger l'extension non empaquetée

**Chrome, Edge, Brave** : ouvrir `chrome://extensions` (ou `edge://extensions`), activer le **mode développeur**, cliquer **Charger l'extension non empaquetée** et choisir le dossier `apps/extension/dist/chrome`. Épingler l'icône Deklic. Après une mise à jour, cliquer sur la flèche « recharger » de l'extension, puis recharger l'onglet Deklic.

**Firefox** : ouvrir `about:debugging#/runtime/this-firefox`, cliquer **Charger un module complémentaire temporaire…** et choisir `apps/extension/dist/firefox/manifest.json`. Firefox n'accorde pas d'office l'accès aux portails : cliquer sur l'icône Deklic puis sur **Autoriser la lecture automatique**. L'extension disparaît à la fermeture de Firefox (module temporaire).

La publication sur les stores (Chrome Web Store, Add-ons Mozilla) demande un compte et des frais : décision à prendre plus tard. En attendant, le bouton-favori de la page `/extension` de Deklic fonctionne sans installation (sans lecture automatique du lien collé).

## Utiliser

1. **Coller un lien** : dans Deklic, « Nouveau projet », coller le lien de l'annonce. « L'extension Deklic lit l'annonce… » s'affiche ; un onglet s'ouvre un instant puis se referme ; le formulaire se remplit (badge « lue par l'extension »). Si le portail affiche une vérification anti-robot, la valider dans l'onglet : la lecture reprend toute seule.
2. **Depuis l'annonce** : cliquer sur l'icône Deklic, puis **Analyser dans Deklic**.

En cas d'échec, Deklic dit pourquoi (annonce retirée, autorisation manquante, page qui n'a pas répondu, rien de lisible), propose **Réessayer la lecture** et garde le texte collé et la saisie manuelle.

## Permissions

- `activeTab`, `scripting` : lire l'onglet quand vous cliquez sur l'icône.
- Accès aux cinq portails (`leboncoin.fr`, `seloger.com`, `bienici.com`, `pap.fr`, `logic-immo.com`) : ouvrir et lire l'annonce quand vous collez son lien dans Deklic.
- Script « pont » sur les pages Deklic (`*.loupeprojet.pages.dev`, `localhost`) : permet à Deklic de savoir que l'extension est là et de lui demander une lecture. Il ne lit rien de la page Deklic.
- Aucun stockage, aucun historique, aucune requête vers nos serveurs. La seule requête réseau de l'extension est celle que Bien'ici fait lui-même pour afficher l'annonce (`/realEstateAd.json`), sur Bien'ici, depuis votre navigateur.

## Comment ça marche

- `src/pont.ts` (pages Deklic) : répond au ping de la page et relaie ses demandes de lecture ; ignore tout message qui ne vient pas de la page elle-même.
- `src/arriere-plan.ts` + `src/logique/lecteur.ts` : ouvre l'annonce dans un onglet caché à côté de Deklic, attend le chargement, lit jusqu'à avoir prix et surface, sinon affiche l'onglet et réessaie, referme et revient sur Deklic. Une lecture à la fois.
- `src/contenu.ts` + `src/logique/lire-page.ts` : applique les règles du portail à la page (et aux données que la page charge elle-même) avec `@loupe/capture`.
- `src/popup.ts` : clic sur l'icône ; bouton d'autorisation quand il manque.
- `regles/<portail>.json` : les règles de lecture, un fichier par portail, versionnées `<portail>-AAAA-MM-JJ`. Pour chaque champ, des extracteurs essayés dans l'ordre : `json` (état applicatif : `__NEXT_DATA__` pour LeBonCoin, `__UFRN_LIFECYCLE_SERVERREQUEST__` pour SeLoger et Logic-Immo), `donnees` (Bien'ici), `jsonld` (schema.org), `meta` (`og:`), `css`. Le premier qui donne une valeur valide gagne.

## Ce qui est lu, par portail (relevé du 13/09/2026)

| Portail             | Données structurées lues                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LeBonCoin           | type, prix, surface, pièces, chambres, étage, ascenseur, DPE, GES, charges de copropriété (annuelles ramenées au mois), taxe foncière, année, meublé, ville, code postal, texte |
| SeLoger, Logic-Immo | type, prix, surface, pièces, chambres, étage, ascenseur, DPE, GES (diagnostics avant ou après 2021), ville, code postal, texte                                                  |
| Bien'ici            | type, prix, surface, pièces, chambres, étage, ascenseur, DPE, GES, charges, lots et procédure de copropriété, année, meublé, ville, code postal, texte                          |
| PAP                 | type, prix, surface, pièces, chambres, DPE, GES, adresse, ville, code postal, texte                                                                                             |

Ce que la page ne donne qu'en texte (charges et taxe foncière chez SeLoger, Logic-Immo et PAP, honoraires, année…) est lu par Deklic dans la description : règles de texte, puis l'IA quand le Worker répond.

## Corriger un portail qui a changé de maquette

1. Ouvrir une annonce du portail, relever le nouveau chemin (état applicatif, JSON-LD) ou sélecteur.
2. Modifier `regles/<portail>.json` et dater la `version`.
3. Mettre à jour `tests/fixtures/<portail>.html` (et `bienici.json`) avec la nouvelle structure, valeurs fictives, puis `npm run test -w apps/extension`.
4. Reconstruire l'extension (et le web, pour le bouton-favori).

Les fixtures reprennent la structure relevée sur de vraies annonces le 13/09/2026, avec des valeurs fictives.
