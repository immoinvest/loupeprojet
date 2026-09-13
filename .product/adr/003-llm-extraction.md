# ADR-003 : Un seul usage du LLM — extraire les champs manquants du texte de l'annonce

**Date** : 2026-09-13 · **Statut** : accepté

## Contexte

Le produit doit rester gratuit (< 10 €/mois) et fiable. Un LLM qui calcule une rentabilité se trompe parfois ; un LLM qui rédige un avis coûte cher et n'est pas vérifiable.

## Décision

1. **Périmètre** : le LLM ne sert qu'à lire le texte de l'annonce pour les champs que la page ne fournit pas en structuré (charges, taxe foncière, étage, ascenseur, année, chauffage, travaux mentionnés). Zéro LLM pour le verdict (règles), les explications (textes écrits une fois), les estimations (données publiques), le chat (pas de chat en v1).
2. **0 ou 1 appel par annonce.** Si la capture structurée (JSON-LD, état de page) couvre prix, surface, pièces, localisation et DPE, aucun appel.
3. **Fournisseur par défaut : Mistral Small** (sortie JSON contrainte par schéma, ~0,0004 $ l'annonce, francophone). Derrière une interface `Extracteur` pour pouvoir basculer vers Ministral 8B, Gemini Flash-Lite ou Claude Haiku 4.5 sans toucher au reste.
4. **Sortie validée par Zod** ; champ manquant → `null`, jamais inventé ; indice de confiance par champ ; < 0,7 → badge « à vérifier ».
5. **Repli regex** (prix, m², pièces, DPE, étage, code postal) si le LLM est indisponible ou si le quota est atteint. Badge « lecture partielle ».
6. **Cache** par hash SHA-256 du texte normalisé, 30 jours. **Quota** : 20 extractions/jour/IP sans compte, 100 avec compte.

## Conséquences

- Coût variable estimé : ~4 $/mois pour 10 000 analyses.
- Le moteur (`packages/moteur`) ne dépend d'aucun LLM et se teste sans réseau.
- La lecture des photos (vision) est reportée à une option v2 derrière un compte (5 à 10× plus cher).
