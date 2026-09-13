import type { Handler } from 'hono';
import type { BlankEnv } from 'hono/types';

import type { Dependances } from '../dependances';
import { messageDe, reponseErreur } from '../erreurs';
import { ecrireCache, lireCache, repondre } from '../http';
import { cleCache } from '../proxy/cache';
import { normaliserChamps, RequeteExtractionSchema } from './contrat';
import { normaliserTexte, VERSION_PROMPT } from './prompt';

/** Une lecture d'annonce vaut 30 jours : même texte, même modèle, même prompt → même réponse. */
export const TTL_EXTRACTION_SECONDES = 30 * 24 * 3600;
/** Le navigateur ne garde pas une lecture d'annonce : c'est le Worker qui la mémorise. */
const SANS_CACHE_NAVIGATEUR = 'no-store';

async function lireCorps(c: Parameters<Handler<BlankEnv, '/extract'>>[0]): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
}

/**
 * POST /extract { texte } : le modèle lit le texte de l'annonce et rend les champs du contrat.
 * Le texte n'est jamais conservé ni journalisé : seule son empreinte sert de clé de cache.
 */
export function creerExtraction(deps: Dependances): Handler<BlankEnv, '/extract'> {
  return async (c) => {
    const extracteur = deps.extracteur;
    if (extracteur === null) return reponseErreur(503, 'EXTRACTION_INDISPONIBLE');

    const corps = await lireCorps(c);
    if (corps === undefined)
      return reponseErreur(400, 'PARAMETRES_INVALIDES', { champs: ['corps'] });
    const requete = RequeteExtractionSchema.safeParse(corps);
    if (!requete.success) {
      const champs = [...new Set(requete.error.issues.map((i) => i.path.map(String).join('.')))];
      return reponseErreur(400, 'PARAMETRES_INVALIDES', { champs });
    }

    const texte = normaliserTexte(requete.data.texte);
    const cle = await cleCache('extraction', {
      modele: extracteur.modele,
      version: VERSION_PROMPT,
      texte,
    });
    const enCache = await lireCache(deps, cle);
    if (enCache !== null) return repondre(c, enCache, 'HIT', SANS_CACHE_NAVIGATEUR);

    const lecture = await extracteur.extraire(texte);
    if (!lecture.ok) return reponseErreur(lecture.statut, lecture.code);
    let normalisation;
    try {
      normalisation = normaliserChamps(lecture.brut);
    } catch (erreur) {
      deps.journal.erreur('extraction.invalide', {
        modele: extracteur.modele,
        raison: messageDe(erreur),
      });
      return reponseErreur(502, 'AMONT_INVALIDE');
    }
    if (normalisation.rejetes.length > 0) {
      deps.journal.info('extraction.champs_rejetes', {
        modele: extracteur.modele,
        champs: normalisation.rejetes,
      });
    }
    const enveloppe = {
      champs: normalisation.champs,
      rejetes: normalisation.rejetes,
      modele: extracteur.modele,
      obtenuLe: new Date(deps.maintenant()).toISOString(),
    };
    const texteReponse = JSON.stringify(enveloppe);
    await ecrireCache(deps, cle, texteReponse, TTL_EXTRACTION_SECONDES);
    return repondre(c, texteReponse, 'MISS', SANS_CACHE_NAVIGATEUR);
  };
}
