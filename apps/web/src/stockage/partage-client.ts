import {
  alleger,
  expirationDepuis,
  PartageCreeSchema,
  PartageLuSchema,
  type PartageCree,
  type PartageLu,
} from '@loupe/projets';
import { z } from 'zod';

import type { ProjetEnregistre } from './projets';

/** Liens de partage courts (ADR-009) : l'API /api/partage du worker des comptes, même origine. */

export type CodeErreurPartage =
  'introuvable' | 'indisponible' | 'limite' | 'invalide' | 'reseau' | 'inconnue';

export type ResultatPartage<T> =
  | { readonly ok: true; readonly valeur: T }
  | { readonly ok: false; readonly code: CodeErreurPartage };

export interface ClientPartage {
  creer(enregistre: ProjetEnregistre): Promise<ResultatPartage<PartageCree>>;
  lire(id: string): Promise<ResultatPartage<PartageLu>>;
  supprimer(id: string, jeton: string): Promise<ResultatPartage<null>>;
}

export type Recuperateur = (url: string, init?: RequestInit) => Promise<Response>;

export const URL_PARTAGE = '/api/partage';

const ErreurSchema = z.object({ code: z.string() });

const CODES_SERVEUR: Readonly<Record<string, CodeErreurPartage>> = {
  INTROUVABLE: 'introuvable',
  PARTAGE_INDISPONIBLE: 'indisponible',
  CONFIGURATION_INCOMPLETE: 'indisponible',
  LIMITE_ATTEINTE: 'limite',
  CHAMPS_INVALIDES: 'invalide',
  CORPS_TROP_GROS: 'invalide',
};

async function codeDe(reponse: Response): Promise<CodeErreurPartage> {
  const corps = ErreurSchema.safeParse(await reponse.json().catch(() => undefined));
  const connu = corps.success ? CODES_SERVEUR[corps.data.code] : undefined;
  if (connu !== undefined) return connu;
  return reponse.status >= 500 ? 'indisponible' : 'inconnue';
}

/**
 * Le client réel. Une réponse inattendue (site sans API : la page HTML de l'application, par
 * exemple) donne `inconnue` ; le bouton Partager retombe alors sur le lien compressé.
 */
export function clientPartageReseau(
  recuperer: Recuperateur = (url, init) => fetch(url, init),
): ClientPartage {
  async function appeler<T>(
    url: string,
    init: RequestInit,
    lire: (corps: unknown) => T | null,
  ): Promise<ResultatPartage<T>> {
    let reponse: Response;
    try {
      reponse = await recuperer(url, init);
    } catch {
      return { ok: false, code: 'reseau' };
    }
    if (!reponse.ok) return { ok: false, code: await codeDe(reponse) };
    const valeur = lire(await reponse.json().catch(() => undefined));
    return valeur === null ? { ok: false, code: 'inconnue' } : { ok: true, valeur };
  }
  const json = (method: string, corps: unknown): RequestInit => ({
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  });
  const valide =
    <T>(schema: z.ZodType<T>) =>
    (corps: unknown): T | null => {
      const resultat = schema.safeParse(corps);
      return resultat.success ? resultat.data : null;
    };

  return {
    creer: (enregistre) =>
      appeler(
        URL_PARTAGE,
        json('POST', { projet: alleger(enregistre) }),
        valide(PartageCreeSchema),
      ),
    lire: (id) =>
      appeler(
        `${URL_PARTAGE}/${encodeURIComponent(id)}`,
        { method: 'GET' },
        valide(PartageLuSchema),
      ),
    async supprimer(id, jeton) {
      let reponse: Response;
      try {
        reponse = await recuperer(
          `${URL_PARTAGE}/${encodeURIComponent(id)}`,
          json('DELETE', { jeton }),
        );
      } catch {
        return { ok: false, code: 'reseau' };
      }
      return reponse.ok ? { ok: true, valeur: null } : { ok: false, code: await codeDe(reponse) };
    },
  };
}

/** Quand le partage court n'existe pas (tests, pages hors application) : toujours indisponible. */
export const clientPartageIndisponible: ClientPartage = {
  creer: () => Promise.resolve({ ok: false, code: 'indisponible' }),
  lire: () => Promise.resolve({ ok: false, code: 'indisponible' }),
  supprimer: () => Promise.resolve({ ok: false, code: 'indisponible' }),
};

export interface OptionsClientMemoire {
  readonly maintenant?: () => number;
  readonly genererId?: () => string;
}

/** Aux mêmes règles que l'API (projet allégé, 90 jours prolongés à l'ouverture, jeton exigé), en mémoire. */
export function clientPartageMemoire(options: OptionsClientMemoire = {}): ClientPartage & {
  readonly liens: Map<string, { contenu: string; jeton: string; expireLe: string }>;
} {
  const horloge = options.maintenant ?? ((): number => Date.now());
  let compteur = 0;
  const genererId =
    options.genererId ??
    ((): string => {
      compteur += 1;
      return `memoire${String(compteur)}`.slice(-8).padStart(8, 'm');
    });
  const liens = new Map<string, { contenu: string; jeton: string; expireLe: string }>();
  return {
    liens,
    creer(enregistre) {
      const id = genererId();
      const cree = { id, jeton: `jeton-${id}`, expireLe: expirationDepuis(horloge()) };
      liens.set(id, {
        contenu: JSON.stringify(alleger(enregistre)),
        jeton: cree.jeton,
        expireLe: cree.expireLe,
      });
      return Promise.resolve({ ok: true, valeur: cree });
    },
    lire(id) {
      const lien = liens.get(id);
      const maintenant = horloge();
      if (lien === undefined || lien.expireLe <= new Date(maintenant).toISOString()) {
        return Promise.resolve({ ok: false, code: 'introuvable' });
      }
      lien.expireLe = expirationDepuis(maintenant);
      const lu = PartageLuSchema.safeParse({
        projet: JSON.parse(lien.contenu) as unknown,
        expireLe: lien.expireLe,
      });
      return Promise.resolve(
        lu.success ? { ok: true, valeur: lu.data } : { ok: false, code: 'inconnue' },
      );
    },
    supprimer(id, jeton) {
      if (liens.get(id)?.jeton !== jeton)
        return Promise.resolve({ ok: false, code: 'introuvable' });
      liens.delete(id);
      return Promise.resolve({ ok: true, valeur: null });
    },
  };
}
