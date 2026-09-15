import {
  ColocataireChangeSchema,
  CongeEnregistreSchema,
  CongeRetireSchema,
  DecompteCompletSchema,
  EtatFinBailSchema,
  ModeChargesLocationSchema,
  RegularisationSchema,
  RegularisationValideeSchema,
  RestitutionEnregistreeSchema,
  RestitutionSchema,
} from '@loupe/gestion';
import { z } from 'zod';

import type { Recuperateur } from '../reseau';
import type { ClientFinBail, CodeErreurFinBail, ResultatFinBail } from './types';

const RACINE = '/api/gestion/fin-bail';
const ErreurSchema = z.object({ code: z.string() });

const CODES_SERVEUR: Readonly<Record<string, CodeErreurFinBail>> = {
  NON_CONNECTE: 'non_connecte',
  CHAMPS_INVALIDES: 'invalide',
  CORPS_TROP_GROS: 'invalide',
  INTROUVABLE: 'introuvable',
  DATE_INVALIDE: 'date_invalide',
  CONGE_INVALIDE: 'conge_invalide',
  FIN_AVANT_ENTREE: 'fin_avant_entree',
  PAIEMENTS_APRES_SORTIE: 'paiements_apres_sortie',
  LOCATION_EN_COURS: 'location_en_cours',
  RETENUES_TROP_ELEVEES: 'retenues_trop_elevees',
  DEJA_ENREGISTRE: 'deja_enregistre',
  DEPOT_RENDU: 'depot_rendu',
  REGULARISATION_IMPOSSIBLE: 'regularisation_impossible',
  COLOCATAIRE_REFUSE: 'colocataire_refuse',
  BAILLEUR_MANQUANT: 'bailleur_manquant',
  LIMITE_ATTEINTE: 'limite',
  FIN_BAIL_INDISPONIBLE: 'indisponible',
  GESTION_INDISPONIBLE: 'indisponible',
};

async function codeDe(reponse: Response): Promise<CodeErreurFinBail> {
  const corps = ErreurSchema.safeParse(await reponse.json().catch(() => undefined));
  const connu = corps.success ? CODES_SERVEUR[corps.data.code] : undefined;
  if (connu !== undefined) return connu;
  return reponse.status >= 500 ? 'indisponible' : 'inconnue';
}

type Methode = 'GET' | 'POST' | 'PUT' | 'DELETE';

/** Le client réel : /api/gestion/fin-bail sur l'origine du site, réponses revalidées par Zod. */
export function clientFinBailReseau(
  recuperer: Recuperateur = (url, init) => fetch(url, init),
): ClientFinBail {
  async function appeler<T>(
    methode: Methode,
    chemin: string,
    corps: unknown,
    schema: z.ZodType<T>,
  ): Promise<ResultatFinBail<T>> {
    const init: RequestInit =
      corps === undefined
        ? { method: methode }
        : {
            method: methode,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(corps),
          };
    let reponse: Response;
    try {
      reponse = await recuperer(`${RACINE}${chemin}`, init);
    } catch {
      return { ok: false, code: 'reseau' };
    }
    if (!reponse.ok) return { ok: false, code: await codeDe(reponse) };
    // 204 : aucun corps à relire (annulation d'une restitution).
    if (reponse.status === 204) {
      const vide = schema.safeParse(undefined);
      return vide.success ? { ok: true, valeur: vide.data } : { ok: false, code: 'inconnue' };
    }
    const lu = schema.safeParse(await reponse.json().catch(() => undefined));
    return lu.success ? { ok: true, valeur: lu.data } : { ok: false, code: 'inconnue' };
  }
  const id = encodeURIComponent;
  const location = (locationId: string): string => `/locations/${id(locationId)}`;

  return {
    etat: () => appeler('GET', '', undefined, EtatFinBailSchema),
    enregistrerConge: (locationId, saisie) =>
      appeler('PUT', `${location(locationId)}/conge`, saisie, CongeEnregistreSchema),
    retirerConge: (locationId) =>
      appeler('DELETE', `${location(locationId)}/conge`, undefined, CongeRetireSchema),
    enregistrerModeCharges: (locationId, mode) =>
      appeler('PUT', `${location(locationId)}/charges`, { mode }, ModeChargesLocationSchema),
    restituer: (locationId, saisie) =>
      appeler('POST', `${location(locationId)}/restitution`, saisie, RestitutionEnregistreeSchema),
    rendreDepot: (locationId, rendueLe) =>
      appeler(
        'POST',
        `${location(locationId)}/restitution/rendue`,
        { rendueLe },
        RestitutionSchema,
      ),
    annulerRestitution: (locationId) =>
      appeler('DELETE', `${location(locationId)}/restitution`, undefined, z.undefined()),
    regulariser: (locationId, annee) =>
      appeler(
        'POST',
        `${location(locationId)}/regularisations`,
        { annee },
        RegularisationValideeSchema,
      ),
    reglerRegularisation: (identifiant, regleeLe) =>
      appeler(
        'POST',
        `/regularisations/${id(identifiant)}/reglee`,
        { regleeLe },
        RegularisationSchema,
      ),
    changerColocataire: (locationId, changement) =>
      appeler('POST', `${location(locationId)}/colocataires`, changement, ColocataireChangeSchema),
    decompte: (identifiant) =>
      appeler('GET', `/decomptes/${id(identifiant)}`, undefined, DecompteCompletSchema),
  };
}
