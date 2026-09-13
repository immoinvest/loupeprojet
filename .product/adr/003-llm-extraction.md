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

## Amendement du 13/09/2026 — OpenRouter et modèle gratuit (feature `extraction-llm`)

Décision de Pierre : démarrer avec une clé **OpenRouter** et « le meilleur modèle gratuit ».

1. **Connecteur unique « chat completions »** (format OpenAI, que Mistral et OpenRouter partagent) : `LLM_URL` + `LLM_MODELE` (variables) + secret `OPENROUTER_API_KEY`. Passer à Mistral direct = changer l'URL et le modèle, pas le code.
2. **Modèle par défaut** : `nvidia/nemotron-3-super-120b-a12b:free` (plus gros modèle gratuit du catalogue OpenRouter au 13/09/2026 acceptant une sortie JSON contrainte) ; second choix `google/gemma-4-31b-it:free`. Le catalogue gratuit change souvent : le modèle est un réglage, jamais une constante du code métier.
3. **Sortie** : `response_format: json_object`, température 0, validation **champ par champ** (une valeur hors contrat devient `null` et le champ est listé dans `rejetes`) plutôt qu'un indice de confiance par champ, que les modèles gratuits ne fournissent pas de façon fiable. Côté web, tout champ lu par le LLM porte la provenance `annonce` et le badge « à vérifier ».
4. **Quota** : 10 lectures par minute et par IP (binding Rate Limiting Cloudflare, fenêtres de 10 ou 60 s seulement) au lieu de 20 par jour ; le quota journalier viendra avec les comptes (v1.5). Limites du palier gratuit OpenRouter : 20 requêtes/min et 50/jour sans crédit (1 000/jour avec ≥ 10 $ de crédits) — à surveiller dans Workers Logs (`llm.sature`).
5. **Écart assumé sur l'hébergement UE** : le texte de l'annonce transite par OpenRouter (États-Unis) avant le modèle. Ce sont des textes publics, jamais des données personnelles ; le texte n'est ni stocké ni journalisé (seule son empreinte sert de clé de cache 30 jours). Retour à Mistral direct (Paris) avant l'ouverture publique si le produit le promet.
