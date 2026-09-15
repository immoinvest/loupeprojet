import {
  DemandeLectureAccordSchema,
  LectureAccordSchema,
  ReponseAccordSchema,
} from '@loupe/gestion';
import { Hono, type MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';

import type { Dependances } from '../../dependances';
import { reponseErreur } from '../../erreurs';
import { origineConnue } from '../../garde';
import type { JetonValide, LocataireContact } from './depot';
import { empreinteEmail } from './jetons';
import { reponseErreurEnvois } from './routes';

const TAILLE_MAX_OCTETS = 2048;

/** Sans compte : hôte connu, `Origin` connu (toutes les routes écrivent ou consomment), jamais en cache. */
function origines(deps: Pick<Dependances, 'origines'>): MiddlewareHandler {
  return async (c, next) => {
    const hote = new URL(c.req.url).origin;
    const entete = c.req.header('Origin') ?? '';
    if (!origineConnue(hote, deps.origines) || !origineConnue(entete, deps.origines)) {
      return reponseErreur(403, 'ORIGINE_INCONNUE');
    }
    await next();
    c.res.headers.set('Cache-Control', 'no-store');
  };
}

interface JetonLu {
  readonly jeton: JetonValide;
  readonly locataire: LocataireContact;
}

/**
 * Signature, puis ligne en base (non utilisée, non expirée), puis adresse inchangée. Tout échec rend
 * `null` : la page dit « Ce lien n'est plus valable » sans révéler ce qui a échoué.
 */
async function jetonLu(
  deps: Dependances,
  jeton: string,
  consommer: boolean,
): Promise<JetonLu | null> {
  if (deps.jetons === null) return null;
  const maintenantMs = deps.maintenant();
  const id = await deps.jetons.verifier(jeton, maintenantMs);
  if (id === null) return null;
  const maintenant = new Date(maintenantMs).toISOString();
  const ligne = consommer
    ? await deps.envois.consommerJeton(id, maintenant)
    : await deps.envois.jetonValide(id, maintenant);
  if (ligne === null) return null;
  const locataire = await deps.envois.locataire(ligne.userId, ligne.locataireId);
  if (locataire?.email === undefined) return null;
  if ((await empreinteEmail(locataire.email)) !== ligne.emailEmpreinte) return null;
  return { jeton: ligne, locataire };
}

/** Les routes /api/accord/* : la page publique où le locataire accepte ou refuse (G2-1, ADR-G41). */
export function routeurAccord(deps: Dependances): Hono {
  const app = new Hono();
  app.use('*', origines(deps));
  app.use(
    '*',
    bodyLimit({
      maxSize: TAILLE_MAX_OCTETS,
      onError: () => reponseErreur(413, 'CORPS_TROP_GROS'),
    }),
  );
  const invalide = (): Response => reponseErreur(410, 'LIEN_INVALIDE');

  // Lire ne consomme rien : un antivirus qui ouvre le lien ne répond pas à la place du locataire.
  app.post('/lire', async (c) => {
    const demande = DemandeLectureAccordSchema.safeParse(await c.req.json().catch(() => undefined));
    if (!demande.success) return invalide();
    const lu = await jetonLu(deps, demande.data.jeton, false);
    if (lu === null) return invalide();
    const lieu = await deps.envois.contexteInvitation(lu.jeton.userId, lu.jeton.locataireId);
    return c.json(LectureAccordSchema.parse({ prenom: lu.locataire.prenom, ...lieu }));
  });

  app.post('/repondre', async (c) => {
    const demande = ReponseAccordSchema.safeParse(await c.req.json().catch(() => undefined));
    if (!demande.success) return invalide();
    const lu = await jetonLu(deps, demande.data.jeton, true);
    if (lu === null) return invalide();
    await deps.envois.enregistrerAccord(
      lu.jeton.userId,
      lu.jeton.locataireId,
      demande.data.reponse,
      lu.jeton.emailEmpreinte,
      new Date(deps.maintenant()).toISOString(),
    );
    return c.json({ statut: demande.data.reponse });
  });

  app.onError((erreur, c) => reponseErreurEnvois(deps, erreur, c.req.path));

  return app;
}
