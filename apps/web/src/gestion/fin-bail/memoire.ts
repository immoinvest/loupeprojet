import {
  ChangementColocataireSchema,
  CongeSaisieSchema,
  DecompteSchema,
  locatairesDuMois,
  ModeChargesSchema,
  refusChangementColocataire,
  refusConge,
  type ChangementColocataire,
  type Conge,
  type DecompteComplet,
  type Depense,
  type EtatFinBail,
  type EtatGestion,
  type IdentitesDecompte,
  type Locataire,
  type LocationGeree,
  type MouvementColocation,
  type RefusColocataire,
  type RefusConge,
} from '@loupe/gestion';

import { ETAT_GESTION_VIDE } from '../memoire';
import type { ClientGestion } from '../types';
import { soldesEnMemoire } from './memoire-soldes';
import type { ClientFinBail, CodeErreurFinBail, ResultatFinBail } from './types';

export type ActionFinBailClient = keyof ClientFinBail;

export interface OptionsFinBailMemoire {
  readonly etat?: EtatFinBail;
  /** Le contenu des décomptes de `etat.decomptes`. */
  readonly decomptes?: readonly DecompteComplet[];
  /** Le client de gestion : biens, locations, paiements et bailleur. */
  readonly gestion?: ClientGestion;
  /** Les dépenses du compte (A1), pour la régularisation des charges. */
  readonly depenses?: readonly Depense[];
  /** Horodatage des écritures ; son jour est « aujourd'hui ». */
  readonly maintenant?: string;
  readonly erreurs?: Partial<Record<ActionFinBailClient, CodeErreurFinBail>>;
}

export interface ClientFinBailMemoire extends ClientFinBail {
  readonly donnees: () => EtatFinBail;
  readonly appels: ActionFinBailClient[];
}

export const ETAT_FIN_BAIL_MEMOIRE: EtatFinBail = {
  conges: [],
  charges: [],
  restitutions: [],
  regularisations: [],
  mouvements: [],
  decomptes: [],
};

const INVALIDE = { ok: false, code: 'invalide' } as const;
const INTROUVABLE = { ok: false, code: 'introuvable' } as const;
const INDISPONIBLE = { ok: false, code: 'indisponible' } as const;

/** Les refus du calcul pur, traduits en codes de l'interface (toutes les valeurs possibles). */
const CODES_CONGE: Readonly<Record<RefusConge, CodeErreurFinBail>> = {
  DATE_INVALIDE: 'date_invalide',
  CONGE_INVALIDE: 'conge_invalide',
  FIN_AVANT_ENTREE: 'fin_avant_entree',
  PAIEMENTS_APRES_SORTIE: 'paiements_apres_sortie',
};

const CODES_COLOCATAIRE: Readonly<Record<RefusColocataire, CodeErreurFinBail>> = {
  HORS_LOCATION: 'colocataire_refuse',
  PAS_DANS_LE_BAIL: 'colocataire_refuse',
  DEJA_PARTI: 'colocataire_refuse',
  DERNIER_LOCATAIRE: 'colocataire_refuse',
  LIMITE_ATTEINTE: 'limite',
};

/**
 * Comme en production tant que la migration 0011 n'est pas appliquée : tout répond « indisponible ».
 * C'est le client par défaut d'`AppEnMemoire`, pour que les écrans existants de Gérer ne bougent pas.
 */
export const clientFinBailIndisponible: ClientFinBail = {
  etat: () => Promise.resolve(INDISPONIBLE),
  enregistrerConge: () => Promise.resolve(INDISPONIBLE),
  retirerConge: () => Promise.resolve(INDISPONIBLE),
  enregistrerModeCharges: () => Promise.resolve(INDISPONIBLE),
  restituer: () => Promise.resolve(INDISPONIBLE),
  rendreDepot: () => Promise.resolve(INDISPONIBLE),
  annulerRestitution: () => Promise.resolve(INDISPONIBLE),
  regulariser: () => Promise.resolve(INDISPONIBLE),
  reglerRegularisation: () => Promise.resolve(INDISPONIBLE),
  changerColocataire: () => Promise.resolve(INDISPONIBLE),
  decompte: () => Promise.resolve(INDISPONIBLE),
};

/** Un client de la fin du bail sans réseau, aux mêmes règles que l'API. */
export function clientFinBailMemoire(options: OptionsFinBailMemoire = {}): ClientFinBailMemoire {
  let donnees = options.etat ?? ETAT_FIN_BAIL_MEMOIRE;
  const complets = new Map((options.decomptes ?? []).map((d) => [d.id, d]));
  /** Les locations telles que nos écritures les ont changées (sortie du congé, colocataire arrivé). */
  const modifiees = new Map<string, LocationGeree>();
  const nouveaux: Locataire[] = [];
  const maintenant = options.maintenant ?? '2026-09-14T09:00:00.000Z';
  const aujourdhui = maintenant.slice(0, 10);
  const appels: ActionFinBailClient[] = [];
  let compteur = 0;
  const identifiant = (prefixe: string): string => `${prefixe}-${String((compteur += 1))}`;

  async function executer<T>(
    action: ActionFinBailClient,
    faire: () => Promise<ResultatFinBail<T>> | ResultatFinBail<T>,
  ): Promise<ResultatFinBail<T>> {
    appels.push(action);
    const erreur = options.erreurs?.[action];
    return erreur === undefined ? faire() : { ok: false, code: erreur };
  }

  const etatGestion = async (): Promise<EtatGestion> => {
    if (options.gestion === undefined) return ETAT_GESTION_VIDE;
    const lu = await options.gestion.etat();
    return lu.ok ? lu.valeur : ETAT_GESTION_VIDE;
  };

  /** La location du compte, avec nos propres modifications ; `undefined` si elle n'existe pas. */
  const lireLocation = async (locationId: string): Promise<LocationGeree | undefined> => {
    const etat = await etatGestion();
    const location = etat.locations.find((l) => l.id === locationId);
    if (location === undefined) return undefined;
    return modifiees.get(locationId) ?? location;
  };

  const changerLocation = (location: LocationGeree): LocationGeree => {
    modifiees.set(location.id, location);
    return location;
  };

  /** Le bailleur, les présents du mois et le logement : comme l'API les compose. */
  const identites = async (
    location: LocationGeree,
    periode: string,
  ): Promise<IdentitesDecompte | null> => {
    const etat = await etatGestion();
    const bien = etat.biens.find((b) => b.id === location.bienId);
    if (etat.bailleur === null || bien === undefined) return null;
    const tous = [...etat.locataires, ...nouveaux];
    return {
      bailleur: etat.bailleur,
      locataires: locatairesDuMois(location, donnees.mouvements, periode).flatMap((id) =>
        tous.filter((l) => l.id === id).map(({ prenom, nom }) => ({ prenom, nom })),
      ),
      logement: {
        nom: bien.nom,
        adresse: bien.adresse,
        ...(location.libelle === undefined ? {} : { libelle: location.libelle }),
      },
      emisLe: aujourdhui,
    };
  };

  const soldes = soldesEnMemoire({
    etat: () => donnees,
    poser: (etat) => {
      donnees = etat;
    },
    lireLocation,
    locationsDuBien: async (bienId) =>
      (await etatGestion()).locations.filter((l) => l.bienId === bienId),
    identites,
    ajouterDecompte: (decompte) => {
      complets.set(decompte.id, decompte);
      donnees = { ...donnees, decomptes: [...donnees.decomptes, DecompteSchema.parse(decompte)] };
    },
    retirerDecompte: (id) => {
      complets.delete(id);
    },
    identifiant,
    maintenant,
    aujourdhui,
    depenses: options.depenses ?? [],
  });

  return {
    appels,
    donnees: () => donnees,
    etat: () => executer('etat', () => ({ ok: true, valeur: donnees })),

    enregistrerConge: (locationId, saisie) =>
      executer('enregistrerConge', async () => {
        const lu = CongeSaisieSchema.safeParse(saisie);
        if (!lu.success) return INVALIDE;
        const location = await lireLocation(locationId);
        if (location === undefined) return INTROUVABLE;
        const { paiements } = await etatGestion();
        const refus = refusConge(location, lu.data, paiements, aujourdhui);
        if (refus !== null) return { ok: false, code: CODES_CONGE[refus] };
        const conge: Conge = { locationId, ...lu.data, modifieLe: maintenant };
        donnees = {
          ...donnees,
          conges: [...donnees.conges.filter((c) => c.locationId !== locationId), conge],
        };
        return {
          ok: true,
          valeur: { conge, location: changerLocation({ ...location, fin: lu.data.fin }) },
        };
      }),

    retirerConge: (locationId) =>
      executer('retirerConge', async () => {
        const location = await lireLocation(locationId);
        if (location === undefined) return INTROUVABLE;
        if (!donnees.conges.some((c) => c.locationId === locationId)) return INTROUVABLE;
        donnees = { ...donnees, conges: donnees.conges.filter((c) => c.locationId !== locationId) };
        const sansFin = Object.fromEntries(
          Object.entries(location).filter(([cle]) => cle !== 'fin'),
        ) as LocationGeree;
        return { ok: true, valeur: { location: changerLocation(sansFin) } };
      }),

    enregistrerModeCharges: (locationId, mode) =>
      executer('enregistrerModeCharges', async () => {
        const lu = ModeChargesSchema.safeParse(mode);
        if (!lu.success) return INVALIDE;
        if ((await lireLocation(locationId)) === undefined) return INTROUVABLE;
        const ligne = { locationId, mode: lu.data, modifieLe: maintenant };
        donnees = {
          ...donnees,
          charges: [...donnees.charges.filter((c) => c.locationId !== locationId), ligne],
        };
        return { ok: true, valeur: ligne };
      }),

    restituer: (locationId, saisie) =>
      executer('restituer', () => soldes.restituer(locationId, saisie)),
    rendreDepot: (locationId, rendueLe) =>
      executer('rendreDepot', () => soldes.rendreDepot(locationId, rendueLe)),
    annulerRestitution: (locationId) =>
      executer('annulerRestitution', () => soldes.annulerRestitution(locationId)),
    regulariser: (locationId, annee) =>
      executer('regulariser', () => soldes.regulariser(locationId, annee)),
    reglerRegularisation: (id, regleeLe) =>
      executer('reglerRegularisation', () => soldes.reglerRegularisation(id, regleeLe)),

    changerColocataire: (locationId, changement: ChangementColocataire) =>
      executer('changerColocataire', async () => {
        const lu = ChangementColocataireSchema.safeParse(changement);
        if (!lu.success) return INVALIDE;
        const location = await lireLocation(locationId);
        if (location === undefined) return INTROUVABLE;
        const refus = refusChangementColocataire(location, donnees.mouvements, lu.data);
        if (refus !== null) return { ok: false, code: CODES_COLOCATAIRE[refus] };
        const mouvements: MouvementColocation[] = [];
        const noter = (locataireId: string, sens: 'arrivee' | 'depart', date: string): void => {
          mouvements.push({
            id: identifiant('mouvement'),
            locationId,
            locataireId,
            sens,
            date,
            creeLe: maintenant,
          });
        };
        const { depart, arrivee } = lu.data;
        if (depart !== undefined) noter(depart.locataireId, 'depart', depart.date);
        let locataire: Locataire | null = null;
        let suivante = location;
        if (arrivee !== undefined) {
          locataire = { id: identifiant('locataire'), ...arrivee.locataire, creeLe: maintenant };
          nouveaux.push(locataire);
          suivante = { ...location, colocataireIds: [...location.colocataireIds, locataire.id] };
          noter(locataire.id, 'arrivee', arrivee.date);
        }
        donnees = { ...donnees, mouvements: [...donnees.mouvements, ...mouvements] };
        return {
          ok: true,
          valeur: { location: changerLocation(suivante), locataire, mouvements },
        };
      }),

    decompte: (id) =>
      executer('decompte', () => {
        const complet = complets.get(id);
        return complet === undefined ? INTROUVABLE : { ok: true, valeur: complet };
      }),
  };
}
