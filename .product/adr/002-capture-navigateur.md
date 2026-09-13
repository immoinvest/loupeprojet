# ADR-002 : La page de l'annonce est lue dans le navigateur de l'utilisateur, jamais par nos serveurs

**Date** : 2026-09-13 · **Statut** : accepté

## Contexte

LeBonCoin, SeLoger et Bien'ici n'ont pas d'API publique, interdisent l'extraction dans leurs CGU et bloquent les robots. La cour d'appel de Versailles a condamné Jinka pour avoir reconstitué leurs annonces côté serveur : 60 000 € face à SeLoger (12/2025), 200 000 € face à LeBonCoin (04/2026), sur le fondement du droit sui generis du producteur de base de données.

Horiz, Lybox et Castorus contournent le problème avec une extension navigateur qui lit la page affichée par l'utilisateur lui-même.

## Décision

1. **Aucune lecture d'annonce côté serveur**, aucun crawler, aucune base d'annonces. Le mode « lecture par nos serveurs » n'existe pas dans le code ; il ne pourrait être réactivé portail par portail qu'après revue explicite des CGU et du robots.txt.
2. **Modes de capture v1**, du plus fluide au plus manuel : extension WebExtension (Chrome, Firefox, Edge), bouton-favori (bookmarklet), partage du lien depuis le téléphone + texte collé, texte collé seul, saisie manuelle (prix, surface, ville).
3. **Règles de capture par portail** dans un fichier JSON versionné sur R2, téléchargé par l'extension au lancement, corrigeable sans republier. Test automatique quotidien sur une annonce témoin par portail.
4. **Ce qui quitte le navigateur** : uniquement le texte de l'annonce, vers `/extract`, et seulement si la capture structurée ne suffit pas. Le Worker ne stocke que le hash SHA-256 du texte normalisé (clé de cache, 30 jours) et les champs extraits.
5. **Le projet est indépendant de l'annonce** : une fois capturé, il vit dans le stockage de l'utilisateur ; si l'annonce disparaît, l'analyse reste.

## Conséquences

- Firecrawl et Apify sont exclus du projet.
- L'extension est un livrable v1 à part entière (`apps/extension`).
- L'historique de prix (v2) est tenu par l'extension, chez l'utilisateur, jamais côté serveur.
