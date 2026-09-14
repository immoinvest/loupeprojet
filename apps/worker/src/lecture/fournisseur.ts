import type { Fetcher } from '../dependances';
import { messageDe } from '../erreurs';
import type { Journal } from '../journal';

/** API « Web Unlocker » de Bright Data (ADR-008) : une requête = une page d'annonce, rendue telle quelle. */
export const URL_BRIGHTDATA = 'https://api.brightdata.com/request';
export const ZONE_DEFAUT = 'deklic_unlocker';
/** SeLoger a mis jusqu'à 74 s le 14/09/2026 : au-delà de 70 s, on abandonne cette tentative. */
export const DELAI_PAGE_MS = 70_000;
/** Les pages relevées pèsent de 70 Ko à 1,6 Mo. */
export const TAILLE_MAX_PAGE = 3_000_000;

export type ReponsePage =
  | { readonly ok: true; readonly statutPortail: number; readonly html: string }
  | { readonly ok: false; readonly code: 'AMONT_INDISPONIBLE' | 'AMONT_INVALIDE' };

/** Qui va chercher la page d'une annonce pour Deklic. Ne lève jamais. */
export interface LecteurPages {
  readonly fournisseur: string;
  lire(url: string): Promise<ReponsePage>;
}

export interface ConfigurationBrightData {
  readonly cle: string;
  readonly zone: string;
  readonly delaiMs: number;
}

const ENTETE_STATUT_PORTAIL = 'x-brd-status-code';

/** Statut rendu par le portail lui-même, relayé par Bright Data ; `null` si la réponse vient de Bright Data seul. */
function statutDuPortail(reponse: Response): number | null {
  const brut = reponse.headers.get(ENTETE_STATUT_PORTAIL);
  const statut = Number(brut);
  return brut !== null && Number.isInteger(statut) && statut >= 100 && statut <= 599
    ? statut
    : null;
}

async function envoyer(
  config: ConfigurationBrightData,
  fetcher: Fetcher,
  url: string,
): Promise<Response> {
  return fetcher(new URL(URL_BRIGHTDATA), {
    method: 'POST',
    signal: AbortSignal.timeout(config.delaiMs),
    headers: { Authorization: `Bearer ${config.cle}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ zone: config.zone, url, format: 'raw', country: 'fr' }),
  });
}

/**
 * Lecteur Bright Data. Le contenu de la page n'est jamais journalisé : seulement ce qui explique un
 * refus du fournisseur (statut, code d'erreur de Bright Data).
 */
export function lecteurBrightData(
  config: ConfigurationBrightData,
  fetcher: Fetcher,
  journal: Journal,
): LecteurPages {
  return {
    fournisseur: 'brightdata',
    async lire(url) {
      try {
        const reponse = await envoyer(config, fetcher, url);
        const statutPortail = statutDuPortail(reponse);
        if (statutPortail === null && !reponse.ok) {
          journal.erreur('lecture.fournisseur_refuse', {
            statut: reponse.status,
            erreur: reponse.headers.get('x-brd-error'),
          });
          return { ok: false, code: 'AMONT_INDISPONIBLE' };
        }
        // Une page annoncée démesurée n'est pas lue du tout (mémoire du Worker).
        if (Number(reponse.headers.get('content-length')) > TAILLE_MAX_PAGE) {
          return { ok: false, code: 'AMONT_INVALIDE' };
        }
        const html = await reponse.text();
        if (html.length > TAILLE_MAX_PAGE) return { ok: false, code: 'AMONT_INVALIDE' };
        return { ok: true, statutPortail: statutPortail ?? reponse.status, html };
      } catch (erreur) {
        journal.erreur('lecture.fournisseur_injoignable', { raison: messageDe(erreur) });
        return { ok: false, code: 'AMONT_INDISPONIBLE' };
      }
    },
  };
}
