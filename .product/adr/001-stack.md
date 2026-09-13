# ADR-001 : Stack technique de Loupe

**Date** : 2026-09-13 · **Statut** : accepté · **Décideur** : Claude, sur délégation de Pierre (« choisis le stack qui te paraît le plus cohérent pour construire un SaaS solide »).

## Contexte

Deux propositions coexistaient :

1. **Stack « SaaS classique »** validé le matin du 13/09 : Next.js 15 sur Vercel, Supabase, Stripe, Claude, Firecrawl/Apify, Inngest.
2. **Spec produit Loupe v1** (rédigée le même jour) : SPA statique (Svelte ou Preact) sur Cloudflare Pages, Workers, KV/R2/D1, Mistral, extension navigateur, gratuit sans compte, < 10 €/mois.

Contraintes qui tranchent :

- **Juridique** : LeBonCoin et SeLoger ont fait condamner Jinka deux fois en appel (12/2025, 04/2026) pour extraction côté serveur. Toute lecture d'annonce par nos serveurs (Firecrawl, Apify, crawler) est exclue. → ADR-002.
- **Coût** : lancement gratuit ; Vercel Hobby interdit l'usage commercial ; Vercel Pro (20 $/mois) et Supabase (pause après 7 jours d'inactivité en gratuit) dépassent le budget ou fragilisent le service.
- **Architecture** : tout le calcul tourne dans le navigateur ; il n'y a ni rendu serveur ni tâche longue. Un framework SSR n'apporte rien.
- **Vibe coding** : l'auteur ne relit pas le code ; il faut les technos les mieux maîtrisées par les IA de code et les plus documentées.

## Décision

| Couche          | Choix                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------- |
| Monorepo        | npm workspaces, Node 22, TypeScript strict                                                    |
| Moteur          | `packages/moteur`, TS pur + Zod, zéro I/O                                                     |
| Front           | React 19 + Vite + React Router + Tailwind v4 + shadcn/ui + Recharts, SPA sur Cloudflare Pages |
| API             | Cloudflare Workers + Hono (`/extract`, `/proxy/*`)                                            |
| Capture         | WebExtension MV3 + bookmarklet, règles par portail sur R2                                     |
| Données         | KV (cache), R2 (référentiels), D1 (v1.5)                                                      |
| LLM             | Mistral Small derrière une interface, repli regex, Claude Haiku en alternative → ADR-003      |
| Auth v1.5       | Lien magique, Better Auth + Drizzle + D1 (Supabase Auth en alternative)                       |
| Paiement v3     | Stripe via webhooks Worker                                                                    |
| Tests / qualité | Vitest, Playwright, ESLint, Prettier, GitHub Actions                                          |
| Observabilité   | Sentry, Cloudflare Web Analytics, aucun tracking tiers                                        |

**Un seul écart avec la spec** : **React remplace Svelte/Preact.** Le résultat est identique (SPA statique), mais React est le framework le mieux maîtrisé par les IA de code, shadcn/ui et Recharts s'y branchent directement, et le bundle supplémentaire (~40 ko gzip) est négligeable pour une app de rapport.

## Conséquences

- Le `CLAUDE.md` du 13/09 matin (Next.js/Supabase/Stripe) est remplacé.
- Aucune brique payante en v1 ; le seul coût variable est Mistral (~4 $/mois pour 10 000 analyses).
- Le passage à des comptes (v1.5) et à la monétisation (v3) se fait dans le Worker existant, sans changer de plateforme.
- Si le trafic dépasse les quotas gratuits Cloudflare (100 000 req/jour Workers), le plan Workers Paid coûte 5 $/mois.

## Alternatives écartées

- **Next.js + Vercel** : SSR inutile, Hobby non commercial, Pro hors budget. Next.js sur Cloudflare (OpenNext) est possible mais ajoute une couche de complexité sans bénéfice.
- **Svelte / Preact** : bundle plus léger, mais moins bien couverts par les IA et par les bibliothèques de composants.
- **Supabase en v1** : aucune base nécessaire ; pause d'inactivité en gratuit. Reste une option pour l'auth v1.5.
- **PocketBase sur VPS Hetzner (~4,5 €/mois)** : une seule machine, mais sauvegardes et mises à jour à la charge de l'auteur.
