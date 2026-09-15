import type { Context, MiddlewareHandler } from 'hono';
import { z } from 'zod';

import { masquerCourriels } from '../../auth';
import type { Dependances } from '../../dependances';
import { messageDe } from '../../erreurs';
import type { EnvGestion } from '../acces';
import { estTableEnvoisAbsente } from './depot';
import { envoyerQuittanceDuMois } from './quittances';
import { inviterLocataires, type ContexteEnvois } from './taches';

const AvecId = z.object({ id: z.string().min(1) });
const CreationLue = z.object({ locataire: AvecId.nullable(), colocataires: z.array(AvecId) });
const OccupationLue = z.object({ locataire: AvecId, colocataires: z.array(AvecId) });
const PaiementLu = z.object({ locationId: z.string().min(1), periode: z.string().min(1) });

type Tache = () => Promise<void>;

async function reponseLue<T>(c: Context<EnvGestion>, schema: z.ZodType<T>): Promise<T | null> {
  const lu = schema.safeParse(
    await c.res
      .clone()
      .json()
      .catch(() => undefined),
  );
  return lu.success ? lu.data : null;
}

/** La tâche qui suit une écriture réussie de Gérer, ou `null` (ADR-G44). */
async function tacheApres(c: Context<EnvGestion>, deps: Dependances): Promise<Tache | null> {
  const ctx: ContexteEnvois = { deps, userId: c.get('userId'), origine: new URL(c.req.url).origin };
  const route = `${c.req.method} ${c.req.path}`;
  if (/^POST \/api\/gestion\/paiements$/.test(route)) {
    const paiement = await reponseLue(c, PaiementLu);
    return paiement === null
      ? null
      : () => envoyerQuittanceDuMois(ctx, paiement.locationId, paiement.periode);
  }
  if (/^POST \/api\/gestion\/(locations|biens\/[^/]+\/locations)$/.test(route)) {
    const creee = (await reponseLue(c, OccupationLue)) ?? (await reponseLue(c, CreationLue));
    if (creee?.locataire === undefined || creee.locataire === null) return null;
    const ids = [creee.locataire.id, ...creee.colocataires.map((l) => l.id)];
    return () => inviterLocataires(ctx, ids);
  }
  if (/^PATCH \/api\/gestion\/locataires\/[^/]+$/.test(route)) {
    const locataire = await reponseLue(c, AvecId);
    return locataire === null ? null : () => inviterLocataires(ctx, [locataire.id]);
  }
  return null;
}

function journaliser(deps: Dependances, erreur: unknown): void {
  if (estTableEnvoisAbsente(erreur)) {
    deps.journal.info('envois.indisponible');
    return;
  }
  deps.journal.erreur('envois.tache', { raison: masquerCourriels(messageDe(erreur)) });
}

/**
 * Après la réponse d'une route existante : invitations et quittance envoyée, confiées à `waitUntil`.
 * Rien ne change la réponse d'origine ; une erreur de tâche est journalisée, jamais remontée.
 */
export function declencheursEnvois(deps: Dependances): MiddlewareHandler<EnvGestion> {
  return async (c, next) => {
    await next();
    if (c.req.method === 'GET' || c.res.status >= 300) return;
    const tache = await tacheApres(c, deps);
    if (tache === null) return;
    const protegee = tache().catch((erreur: unknown) => {
      journaliser(deps, erreur);
    });
    try {
      c.executionCtx.waitUntil(protegee);
    } catch {
      // Serveur Node de développement : pas de contexte d'exécution, la promesse vit seule.
    }
  };
}
