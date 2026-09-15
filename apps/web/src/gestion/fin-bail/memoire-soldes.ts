import {
  anneesARegulariser,
  contenuRegularisation,
  contenuRestitution,
  dateLimiteRestitution,
  echeanceRegularisation,
  periodeDe,
  refusRestitution,
  RenduDepotSchema,
  RestitutionSaisieSchema,
  regularisationDeLAnnee,
  type DecompteComplet,
  type Depense,
  type EtatFinBail,
  type IdentitesDecompte,
  type LocationGeree,
  type RefusRestitution,
  type Regularisation,
  type RegularisationValidee,
  type Restitution,
  type RestitutionEnregistree,
  type RestitutionSaisie,
} from '@loupe/gestion';

import type { CodeErreurFinBail, ResultatFinBail } from './types';

/*
 * Dépôt de garantie et régularisation des charges du client mémoire : les mêmes règles que l'API
 * (`apps/comptes/src/gestion/fin-bail/depot-soldes.ts`), sur les données tenues par `memoire.ts`.
 */

export interface ContexteSoldes {
  readonly etat: () => EtatFinBail;
  readonly poser: (etat: EtatFinBail) => void;
  /** La location du compte, telle que nos écritures l'ont laissée. */
  readonly lireLocation: (locationId: string) => Promise<LocationGeree | undefined>;
  readonly locationsDuBien: (bienId: string) => Promise<LocationGeree[]>;
  /** Bailleur, présents du mois et logement, ou `null` sans identité de bailleur. */
  readonly identites: (
    location: LocationGeree,
    periode: string,
  ) => Promise<IdentitesDecompte | null>;
  readonly ajouterDecompte: (decompte: DecompteComplet) => void;
  readonly retirerDecompte: (id: string) => void;
  readonly identifiant: (prefixe: string) => string;
  readonly maintenant: string;
  readonly aujourdhui: string;
  readonly depenses: readonly Depense[];
}

const INVALIDE = { ok: false, code: 'invalide' } as const;
const INTROUVABLE = { ok: false, code: 'introuvable' } as const;
const IMPOSSIBLE = { ok: false, code: 'regularisation_impossible' } as const;

/** Tous les refus possibles d'une restitution, traduits en codes de l'interface. */
const CODES_RESTITUTION: Readonly<Record<RefusRestitution, CodeErreurFinBail>> = {
  LOCATION_EN_COURS: 'location_en_cours',
  DATE_INVALIDE: 'date_invalide',
  RETENUES_TROP_ELEVEES: 'retenues_trop_elevees',
};

export interface SoldesEnMemoire {
  readonly restituer: (
    locationId: string,
    saisie: RestitutionSaisie,
  ) => Promise<ResultatFinBail<RestitutionEnregistree>>;
  readonly rendreDepot: (locationId: string, rendueLe: string) => ResultatFinBail<Restitution>;
  readonly annulerRestitution: (locationId: string) => ResultatFinBail;
  readonly regulariser: (
    locationId: string,
    annee: number,
  ) => Promise<ResultatFinBail<RegularisationValidee>>;
  readonly reglerRegularisation: (id: string, regleeLe: string) => ResultatFinBail<Regularisation>;
}

export function soldesEnMemoire(contexte: ContexteSoldes): SoldesEnMemoire {
  const { etat, poser, identifiant, maintenant, aujourdhui } = contexte;

  const decompteDe = (
    locationId: string,
    type: 'restitution' | 'regularisation',
    contenu: DecompteComplet['contenu'],
  ): DecompteComplet => ({
    id: identifiant('decompte'),
    type,
    locationId,
    numero: contenu.numero,
    emisLe: maintenant,
    contenu,
  });

  return {
    restituer: async (locationId, saisie) => {
      const lu = RestitutionSaisieSchema.safeParse(saisie);
      if (!lu.success) return INVALIDE;
      const location = await contexte.lireLocation(locationId);
      if (location === undefined) return INTROUVABLE;
      const refus = refusRestitution(location, lu.data, aujourdhui);
      if (refus !== null) return { ok: false, code: CODES_RESTITUTION[refus] };
      if (etat().restitutions.some((r) => r.locationId === locationId)) {
        return { ok: false, code: 'deja_enregistre' };
      }
      const qui = await contexte.identites(location, periodeDe(lu.data.clesLe));
      if (qui === null) return { ok: false, code: 'bailleur_manquant' };
      const dateLimite = dateLimiteRestitution(lu.data.clesLe, lu.data.conforme);
      const contenu = contenuRestitution(qui, location, { ...lu.data, dateLimite });
      const decompte = decompteDe(locationId, 'restitution', contenu);
      const restitution: Restitution = {
        locationId,
        ...lu.data,
        depot: location.depot,
        aRendre: contenu.aRendre,
        dateLimite,
        decompteId: decompte.id,
        rendueLe: null,
        modifieLe: maintenant,
      };
      contexte.ajouterDecompte(decompte);
      poser({ ...etat(), restitutions: [...etat().restitutions, restitution] });
      return { ok: true, valeur: { restitution, decompte } };
    },

    rendreDepot: (locationId, rendueLe) => {
      const lu = RenduDepotSchema.safeParse({ rendueLe });
      if (!lu.success) return INVALIDE;
      const avant = etat().restitutions.find((r) => r.locationId === locationId);
      if (avant === undefined) return INTROUVABLE;
      if (rendueLe > aujourdhui || rendueLe < avant.clesLe) {
        return { ok: false, code: 'date_invalide' };
      }
      const rendue: Restitution = { ...avant, rendueLe, modifieLe: maintenant };
      poser({
        ...etat(),
        restitutions: etat().restitutions.map((r) => (r === avant ? rendue : r)),
      });
      return { ok: true, valeur: rendue };
    },

    annulerRestitution: (locationId) => {
      const avant = etat().restitutions.find((r) => r.locationId === locationId);
      if (avant === undefined) return INTROUVABLE;
      if (avant.rendueLe !== null) return { ok: false, code: 'depot_rendu' };
      contexte.retirerDecompte(avant.decompteId);
      poser({
        ...etat(),
        restitutions: etat().restitutions.filter((r) => r !== avant),
        decomptes: etat().decomptes.filter((d) => d.id !== avant.decompteId),
      });
      return { ok: true, valeur: undefined };
    },

    regulariser: async (locationId, annee) => {
      const location = await contexte.lireLocation(locationId);
      if (location === undefined) return INTROUVABLE;
      if (!anneesARegulariser(location, aujourdhui).includes(annee)) return IMPOSSIBLE;
      if (etat().regularisations.some((r) => r.locationId === locationId && r.annee === annee)) {
        return { ok: false, code: 'deja_enregistre' };
      }
      const proposition = regularisationDeLAnnee({
        location,
        locationsDuBien: await contexte.locationsDuBien(location.bienId),
        depenses: contexte.depenses,
        annee,
        mode: etat().charges.find((c) => c.locationId === locationId)?.mode ?? 'provision',
      });
      if (proposition.statut !== 'proposee') return IMPOSSIBLE;
      const qui = await contexte.identites(location, periodeDe(proposition.fin));
      if (qui === null) return { ok: false, code: 'bailleur_manquant' };
      const aPartirDe = echeanceRegularisation(aujourdhui);
      const contenu = contenuRegularisation(qui, locationId, proposition, aPartirDe);
      const decompte = decompteDe(locationId, 'regularisation', contenu);
      const regularisation: Regularisation = {
        id: identifiant('regularisation'),
        locationId,
        annee,
        solde: proposition.solde,
        aPartirDe,
        decompteId: decompte.id,
        regleeLe: null,
        creeLe: maintenant,
      };
      contexte.ajouterDecompte(decompte);
      poser({ ...etat(), regularisations: [...etat().regularisations, regularisation] });
      return { ok: true, valeur: { regularisation, decompte } };
    },

    reglerRegularisation: (id, regleeLe) => {
      const avant = etat().regularisations.find((r) => r.id === id);
      if (avant === undefined) return INTROUVABLE;
      if (regleeLe > aujourdhui) return { ok: false, code: 'date_invalide' };
      const reglee: Regularisation = { ...avant, regleeLe };
      poser({
        ...etat(),
        regularisations: etat().regularisations.map((r) => (r === avant ? reglee : r)),
      });
      return { ok: true, valeur: reglee };
    },
  };
}
