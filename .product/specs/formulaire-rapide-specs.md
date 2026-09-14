# Specs — `formulaire-rapide`

Discovery : `.product/features/formulaire-rapide-discovery.md`. Priorité MoSCoW entre crochets.

## US-1 — Service `communes` du Worker [Must]

En tant qu'application, je veux la liste des communes d'un code postal ou d'un nom, pour remplir la ville sans saisie.

```gherkin
Scénario: code postal connu
  Étant donné l'API Géo qui répond deux communes pour 01480
  Quand j'appelle GET /proxy/communes?codePostal=01480
  Alors je reçois { donnees: { communes: [{ nom, codeInsee, codesPostaux }] } }
  Et la réponse est mise en cache 30 jours (un second appel ne touche pas l'API)

Scénario: recherche par nom
  Quand j'appelle GET /proxy/communes?nom=lyon
  Alors l'API Géo est appelée avec boost=population et limit=10
  Et rien n'est écrit dans le cache

Scénarios d'erreur
  - ni codePostal ni nom, ou les deux, code postal qui n'a pas 5 chiffres, nom de moins de 2 lettres → 400 PARAMETRES_INVALIDES
  - réponse amont hors contrat → 502 AMONT_INVALIDE
```

## US-2 — Client web `communes` [Must]

```gherkin
Scénario: réponse valide
  Quand ClientWorker.communes({ codePostal: '13005' }) reçoit une réponse au contrat
  Alors il rend { ok: true, valeur: [...] }
Scénario: hors ligne ou ancien Worker (404 SERVICE_INCONNU)
  Alors il rend { ok: false, code } et clientHorsLigne rend HORS_LIGNE
```

## US-3 — Commandes de saisie réutilisables [Must]

```gherkin
Scénario: Tuiles
  Étant donné un groupe de tuiles effaçable dont « Oui » est choisi
  Quand je clique à nouveau « Oui »
  Alors la valeur redevient inconnue ('')
Scénario: Compteur
  Étant donné un compteur vide de 1 à 10
  Quand je clique « + »
  Alors la valeur vaut 1 ; à 10, « + » est désactivé ; la valeur reste saisissable au clavier
Scénario: Échelle énergie
  Quand je clique la lettre E de l'échelle DPE
  Alors la valeur vaut E ; un second clic la remet à inconnu
Scénario: Montant
  Quand je tape 155000
  Alors le champ affiche « 155 000 » et la valeur transmise vaut « 155000 »
  Et coller « 155 000,50 € » dans un champ sans décimale donne « 155000 »
Scénario: Curseur sans valeur
  Étant donné un curseur sans valeur
  Alors il affiche « Je ne sais pas »
```

## US-4 — Combobox et champ Commune [Must]

```gherkin
Scénario: cinq chiffres, une commune
  Quand je tape 69003 dans « Commune »
  Alors la ville Lyon est choisie seule et le champ affiche « 69003 Lyon »
Scénario: plusieurs communes
  Quand je tape 01480
  Alors la liste propose chaque commune ; Flèche bas puis Entrée choisit la première
Scénario: par nom
  Quand je tape « Mars »
  Alors la liste propose « Marseille » avec ses codes postaux (après 250 ms sans frappe ; la recherche précédente est annulée)
Scénario: Worker indisponible
  Quand la recherche échoue
  Alors une phrase invite à taper « code postal ville » et « 69003 Lyon » tapé remplit code postal et ville
```

## US-5 — Glossaire et infobulles [Must]

```gherkin
Scénario: terme dans Hypothèses
  Quand j'ouvre l'ⓘ de « CFE » dans Hypothèses
  Alors une bulle explique la CFE avec sa source ; cliquer l'icône ne donne pas le focus à la saisie
Scénario: chiffres des règles
  Alors les définitions des prélèvements sociaux, du micro-BIC, du micro-foncier et du DPE citent les taux et années de obtenirRegles()
Scénario: complétude
  Alors chaque descripteur technique porte un terme, et chaque terme du glossaire est utilisé
```

## US-6 — Commandes du formulaire Vérifier [Must]

```gherkin
Scénario: maison
  Quand je choisis « Maison »
  Alors étage, ascenseur, charges de copropriété, lots et procédure disparaissent et ne sont pas transmis
Scénario: rez-de-chaussée
  Quand l'étage vaut 0 (« RDC »)
  Alors l'ascenseur disparaît
Scénario: chambres estimées
  Quand je passe les pièces à 3 sans avoir touché aux chambres
  Alors chambres vaut 2 avec le badge « estimé » ; si je règle les chambres, elles ne bougent plus
Scénario: période de construction
  Quand je choisis « 1949 à 1996 »
  Alors l'année transmise est une année de la période, marquée « estimé » ; « Je connais l'année » ouvre la saisie exacte
Scénario: apport
  Quand je choisis 20 %
  Alors l'apport vaut 20 % du coût total arrondi à la centaine ; « 10 % » revient au défaut estimé
```

## US-7 — Le strict minimum d'abord [Must]

```gherkin
Scénario: saisie à la main
  Alors seuls L'essentiel (type de location, prix, surface, commune, loyer) et trois résumés repliés sont visibles
Scénario: annonce lue
  Étant donné une annonce qui donne prix, surface et commune
  Alors L'essentiel ne montre que le loyer visé et le résumé « Lu dans l'annonce : N informations »
Scénario: erreur dans un groupe replié
  Quand je crée le projet avec une durée invalide dans « Estimé pour vous » replié
  Alors le groupe s'ouvre et le focus va sur la durée
```

## US-8 — Tests existants et e2e [Must]

Les tests Vitest et Playwright qui remplissent le formulaire utilisent « Commune », ouvrent les groupes et choisissent les tuiles ; `creerProjetMinimal` reste en une fonction.

## Won't (cette fois)

Commandes riches dans Hypothèses ; « Marché : … — utiliser » dans le champ loyer ; taxe foncière estimée affichée ; infobulles des onglets Fiscalité, Revente, Financement, Rapport.

## Auto-revue critique

Stories testables une à une, sans changement de contrat. US-6 et US-7 touchent le même fichier : elles sont livrées dans deux commits successifs, les tests de l'écran étant mis à jour avec US-7 (US-8). Validé.
