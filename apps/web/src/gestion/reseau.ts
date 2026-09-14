import {
  CreationReponseSchema,
  DocumentCompletSchema,
  EtatGestionSchema,
  IdentiteBailleurSchema,
  LocataireSchema,
  LocationGereeSchema,
  OccupationCreeeSchema,
  PaiementSchema,
  PreferencesMenuSchema,
} from '@loupe/gestion';
import { z } from 'zod';

import type { ClientGestion, CodeErreurGestion, ResultatGestion } from './types';

export type Recuperateur = (url: string, init?: RequestInit) => Promise<Response>;

const RACINE = '/api/gestion';

/** « Exporter mes données de gestion » : un lien suffit, la réponse est une pièce jointe JSON. */
export const CHEMIN_EXPORT = `${RACINE}/export`;
const ErreurSchema = z.object({ code: z.string() });

/** Codes de l'API de gestion (apps/comptes) vers les codes de l'interface. */
const CODES_SERVEUR: Readonly<Record<string, CodeErreurGestion>> = {
  NON_CONNECTE: 'non_connecte',
  CHAMPS_INVALIDES: 'invalide',
  CORPS_TROP_GROS: 'invalide',
  INTROUVABLE: 'introuvable',
  HORS_LOCATION: 'invalide',
  MONTANT_DEPASSE: 'montant_depasse',
  DATE_INVALIDE: 'date_invalide',
  DOCUMENT_EMIS: 'document_emis',
  BAILLEUR_MANQUANT: 'bailleur_manquant',
  LOYER_NON_REGLE: 'loyer_non_regle',
  LOYER_REGLE: 'loyer_regle',
  BIEN_OCCUPE: 'bien_occupe',
  FIN_AVANT_ENTREE: 'fin_avant_entree',
  PAIEMENTS_APRES_SORTIE: 'paiements_apres_sortie',
  PERIODE_PAYEE: 'periode_payee',
  LIMITE_ATTEINTE: 'limite',
  GESTION_INDISPONIBLE: 'indisponible',
};

async function codeDe(reponse: Response): Promise<CodeErreurGestion> {
  const corps = ErreurSchema.safeParse(await reponse.json().catch(() => undefined));
  const connu = corps.success ? CODES_SERVEUR[corps.data.code] : undefined;
  if (connu !== undefined) return connu;
  return reponse.status >= 500 ? 'indisponible' : 'inconnue';
}

type Methode = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Le client réel : l'API /api/gestion servie par le worker des comptes, sur l'origine du site (le cookie
 * de session part tout seul ; le navigateur ajoute l'en-tête Origin aux écritures). Réponses revalidées.
 */
export function clientGestionReseau(
  recuperer: Recuperateur = (url, init) => fetch(url, init),
): ClientGestion {
  async function appeler<T>(
    methode: Methode,
    chemin: string,
    corps: unknown,
    schema: z.ZodType<T>,
  ): Promise<ResultatGestion<T>> {
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
    const lu = schema.safeParse(await reponse.json().catch(() => undefined));
    return lu.success ? { ok: true, valeur: lu.data } : { ok: false, code: 'inconnue' };
  }

  return {
    etat: () => appeler('GET', '/etat', undefined, EtatGestionSchema),
    creer: (creation) => appeler('POST', '/locations', creation, CreationReponseSchema),
    payer: (paiement) => appeler('POST', '/paiements', paiement, PaiementSchema),
    annulerPaiement: (id) =>
      appeler('DELETE', `/paiements/${encodeURIComponent(id)}`, undefined, z.undefined()),
    enregistrerPreferences: (preferences) =>
      appeler('PUT', '/preferences', preferences, PreferencesMenuSchema),
    enregistrerBailleur: (identite) =>
      appeler('PUT', '/bailleur', identite, IdentiteBailleurSchema),
    // 201 pour un document émis, 200 pour un document qui existait : même corps.
    emettreDocument: (demande) => appeler('POST', '/documents', demande, DocumentCompletSchema),
    document: (id) =>
      appeler('GET', `/documents/${encodeURIComponent(id)}`, undefined, DocumentCompletSchema),
    terminerLocation: (locationId, fin) =>
      appeler(
        'POST',
        `/locations/${encodeURIComponent(locationId)}/fin`,
        { fin },
        LocationGereeSchema,
      ),
    louer: (bienId, occupation) =>
      appeler(
        'POST',
        `/biens/${encodeURIComponent(bienId)}/locations`,
        occupation,
        OccupationCreeeSchema,
      ),
    modifierLocation: (locationId, modification) =>
      appeler(
        'PATCH',
        `/locations/${encodeURIComponent(locationId)}`,
        modification,
        LocationGereeSchema,
      ),
    supprimerBien: (bienId) =>
      appeler('DELETE', `/biens/${encodeURIComponent(bienId)}`, undefined, z.undefined()),
    modifierLocataire: (locataireId, locataire) =>
      appeler(
        'PATCH',
        `/locataires/${encodeURIComponent(locataireId)}`,
        locataire,
        LocataireSchema,
      ),
  };
}
