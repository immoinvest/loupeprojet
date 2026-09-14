import {
  CreationLocationSchema,
  NouveauPaiementSchema,
  occupationDe,
  PREFERENCES_PAR_DEFAUT,
  PreferencesMenuSchema,
  type BienGere,
  type EtatGestion,
  type Locataire,
  type LocationGeree,
  type NouveauLocataire,
  type Paiement,
} from '@loupe/gestion';

import type { ClientGestion, CodeErreurGestion, ResultatGestion } from './types';

export type ActionGestion = keyof ClientGestion;

export interface OptionsGestionMemoire {
  readonly etat?: EtatGestion;
  /** Force une erreur sur une action, pour vérifier son affichage. */
  readonly erreurs?: Partial<Record<ActionGestion, CodeErreurGestion>>;
  /** Horodatage des créations. */
  readonly maintenant?: string;
}

export interface ClientGestionMemoire extends ClientGestion {
  /** Les données telles que le serveur les aurait enregistrées. */
  readonly donnees: () => EtatGestion;
  /** Chaque action appelée, dans l'ordre. */
  readonly appels: ActionGestion[];
}

export const ETAT_GESTION_VIDE: EtatGestion = {
  biens: [],
  locataires: [],
  locations: [],
  paiements: [],
  bailleur: null,
  documents: [],
  preferences: PREFERENCES_PAR_DEFAUT,
};

const INVALIDE = { ok: false, code: 'invalide' } as const;
const INTROUVABLE = { ok: false, code: 'introuvable' } as const;

/** Un client de gestion sans réseau, qui applique les mêmes règles que l'API : tests et aperçu. */
export function clientGestionMemoire(options: OptionsGestionMemoire = {}): ClientGestionMemoire {
  let donnees = options.etat ?? ETAT_GESTION_VIDE;
  const maintenant = options.maintenant ?? '2026-09-14T09:00:00.000Z';
  const appels: ActionGestion[] = [];
  let compteur = 0;
  const identifiant = (prefixe: string): string => `${prefixe}-${String((compteur += 1))}`;

  function executer<T>(
    action: ActionGestion,
    faire: () => ResultatGestion<T>,
  ): Promise<ResultatGestion<T>> {
    appels.push(action);
    const erreur = options.erreurs?.[action];
    return Promise.resolve(erreur === undefined ? faire() : { ok: false, code: erreur });
  }

  return {
    appels,
    donnees: () => donnees,
    etat: () => executer('etat', () => ({ ok: true, valeur: donnees })),
    creer: (creation) =>
      executer('creer', () => {
        const lu = CreationLocationSchema.safeParse(creation);
        if (!lu.success) return INVALIDE;
        const bien: BienGere = {
          id: identifiant('bien'),
          ...lu.data.bien,
          creeLe: maintenant,
          modifieLe: maintenant,
        };
        const occupation = occupationDe(lu.data);
        let locataire: Locataire | null = null;
        let location: LocationGeree | null = null;
        let colocataires: Locataire[] = [];
        if (occupation !== null) {
          const enregistrer = (l: NouveauLocataire): Locataire => ({
            id: identifiant('locataire'),
            ...l,
            creeLe: maintenant,
          });
          locataire = enregistrer(occupation.locataire);
          colocataires = occupation.colocataires.map(enregistrer);
          location = {
            id: identifiant('location'),
            bienId: bien.id,
            locataireId: locataire.id,
            colocataireIds: colocataires.map((c) => c.id),
            ...occupation.location,
            creeLe: maintenant,
          };
        }
        donnees = {
          ...donnees,
          biens: [...donnees.biens, bien],
          locataires: [
            ...donnees.locataires,
            ...(locataire === null ? [] : [locataire]),
            ...colocataires,
          ],
          locations: location === null ? donnees.locations : [...donnees.locations, location],
        };
        return { ok: true, valeur: { bien, locataire, location, colocataires } };
      }),
    payer: (nouveau) =>
      executer('payer', () => {
        const lu = NouveauPaiementSchema.safeParse(nouveau);
        if (!lu.success) return INVALIDE;
        const { locationId, periode } = lu.data;
        if (!donnees.locations.some((l) => l.id === locationId)) return INTROUVABLE;
        if (donnees.paiements.some((p) => p.locationId === locationId && p.periode === periode)) {
          return { ok: false, code: 'deja_recu' };
        }
        const paiement: Paiement = {
          id: identifiant('paiement'),
          ...lu.data,
          source: 'manuel',
          creeLe: maintenant,
        };
        donnees = { ...donnees, paiements: [...donnees.paiements, paiement] };
        return { ok: true, valeur: paiement };
      }),
    annulerPaiement: (id) =>
      executer('annulerPaiement', () => {
        if (!donnees.paiements.some((p) => p.id === id)) return INTROUVABLE;
        donnees = { ...donnees, paiements: donnees.paiements.filter((p) => p.id !== id) };
        return { ok: true, valeur: undefined };
      }),
    enregistrerPreferences: (preferences) =>
      executer('enregistrerPreferences', () => {
        const lu = PreferencesMenuSchema.safeParse(preferences);
        if (!lu.success) return INVALIDE;
        donnees = { ...donnees, preferences: lu.data };
        return { ok: true, valeur: lu.data };
      }),
  };
}
