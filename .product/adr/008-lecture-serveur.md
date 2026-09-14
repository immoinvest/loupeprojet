# ADR-008 : Deklic lit la page d'une annonce par son serveur quand l'extension ne le peut pas

**Date** : 2026-09-14 · **Statut** : accepté · **Décideur** : Pierre (« implémente cela comme alternative avec un loader qui arrive à faire patienter la personne »), après un test concluant le même jour · **Amende** : ADR-002

## Contexte

L'ADR-002 interdisait toute lecture d'annonce côté serveur : l'extension et le bouton-favori lisent la page dans le navigateur de la personne. Conséquence relevée par l'ADR-007 : sur téléphone, où l'extension n'existe pas, coller le lien ne suffit pas ; il faut copier le texte de l'annonce. C'est contraire à l'exigence « deux clics ».

Le 14/09/2026, Pierre a demandé d'explorer la lecture serveur. Un test avec Bright Data Web Unlocker (compte gratuit) a passé les protections des quatre portails qui bloquent les serveurs (DataDome : LeBonCoin, SeLoger, Logic-Immo ; Cloudflare : PAP). Bien'ici répond sans protection. Les règles de l'extension ont lu correctement le HTML obtenu. Pierre a demandé l'implémentation.

Le risque juridique ne disparaît pas : la cour d'appel de Versailles a condamné Jinka (14/04/2026, 200 000 € et 500 € d'astreinte par annonce) pour extraction et réutilisation de parties substantielles de la base LeBonCoin. Passer par un prestataire ne change pas qui extrait.

## Décision

1. **La lecture par le serveur est un chemin de secours**, pas le chemin principal : elle ne se lance que si l'extension est absente ou n'a pas pu ouvrir l'annonce. L'extension reste proposée sur ordinateur.
2. **À la demande, une annonce à la fois** : la route `POST /lecture` du Worker ne lit que le lien qu'une personne vient de coller, et seulement s'il désigne une annonce de l'un des cinq portails. Aucun parcours de recherches, aucune liste, aucun robot planifié.
3. **Rien n'est conservé par Deklic** : ni HTML, ni texte, ni cache, ni journal du contenu. Le Worker transmet la page au navigateur, qui en tire les champs et l'oublie. Le projet enregistré chez la personne garde les champs lus et les adresses des photos, pas le texte.
4. **Pas de réutilisation** : les données lues servent uniquement l'analyse de la personne qui les a demandées ; aucune n'est publiée, agrégée ou revendue.
5. **Fournisseur** : Bright Data Web Unlocker, derrière une interface `LecteurPages` remplaçable ; clé en secret du Worker ; compte sans fonds déposés (plafond de coût : l'offre gratuite de 5 000 lectures par mois). Bien'ici est lu directement, sans fournisseur.
6. **Limites** : 5 lectures par minute par adresse IP ; origines CORS de Deklic seulement.

## Conséquences

- Sur téléphone et sans extension, coller le lien remplit le formulaire ; l'attente (5 à 75 s) est accompagnée par un écran dédié.
- Les photos sont affichées depuis les serveurs des portails, jamais copiées.
- Coût : 0 € sous 5 000 lectures par mois ; au-delà, 1,50 $ les 1 000 **après décision de Pierre** de déposer des fonds.
- **Avant une ouverture large (communication, trafic payant), Pierre fait valider ce mode par un avocat** ; en cas de mise en demeure d'un portail, la lecture serveur de ce portail se coupe en retirant ses URL de la liste blanche du Worker (déploiement du Worker seul).
- L'ADR-002 reste valable pour tout le reste : pas de crawler, pas de base d'annonces, capture côté client par défaut.

## Écarté

- **Proxy résidentiel + navigateur maison** (Playwright sur un serveur) : plus cher à opérer, fragile face à DataDome, et Cloudflare Workers n'exécute pas de navigateur complet dans le plan gratuit.
- **Robots Apify « leboncoin-scraper »** : faits pour les recherches, pas pour le lien d'une annonce ; un seul portail.
- **Cache des pages lues** : économiserait des lectures mais constituerait une copie des annonces chez Deklic.
