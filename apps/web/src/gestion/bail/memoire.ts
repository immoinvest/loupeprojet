import {
  changementRefuse,
  contenuLettreRevision,
  LegalBienSaisieSchema,
  LettreRevisionSchema,
  montantsDuMois,
  RevisionSaisieSchema,
  type EtatBail,
  type EtatGestion,
  type LettreRevisionComplete,
  type RevisionAppliquee,
  type RevisionLocation,
} from '@loupe/gestion';

import type { ClientGestion, CodeErreurGestion } from '../types';
import type { ClientBail, CodeErreurBail, ResultatBail } from './types';
import { propositionDe, revisionDeLaLocation, type RevisionEffective } from './vue';

export type ActionBailClient = keyof ClientBail;

export interface OptionsBailMemoire {
  readonly etat?: EtatBail;
  /** Le contenu des lettres de `etat.lettres`. */
  readonly lettres?: readonly LettreRevisionComplete[];
  /** Le client de gestion : biens, locations, paiements et bailleur, et l'écriture des nouveaux montants. */
  readonly gestion?: ClientGestion;
  /** Horodatage des écritures ; son jour est « aujourd'hui ». */
  readonly maintenant?: string;
  /** Force une erreur sur une action, pour vérifier son affichage. */
  readonly erreurs?: Partial<Record<ActionBailClient, CodeErreurBail>>;
}

export interface ClientBailMemoire extends ClientBail {
  readonly donnees: () => EtatBail;
  readonly appels: ActionBailClient[];
}

export const ETAT_BAIL_VIDE: EtatBail = { biens: [], revisions: [], lettres: [] };

const INVALIDE = { ok: false, code: 'invalide' } as const;
const INTROUVABLE = { ok: false, code: 'introuvable' } as const;
const CODES_COMMUNS: readonly string[] = ['periode_payee', 'limite', 'introuvable', 'reseau'];

/** Les codes qu'une écriture de montants de la gestion peut rendre, vus par la vie du bail. */
export function codeDepuisGestion(code: CodeErreurGestion): CodeErreurBail {
  return CODES_COMMUNS.includes(code) ? (code as CodeErreurBail) : 'inconnue';
}

/** Les réglages tels que l'API les enregistre : sans la provenance, calculée à l'affichage. */
function enregistree(effective: RevisionEffective): RevisionLocation {
  const { locationId, active, anniversaire, trimestre, formeBail, derniereRevision, modifieLe } =
    effective;
  return { locationId, active, anniversaire, trimestre, formeBail, derniereRevision, modifieLe };
}

const INDISPONIBLE = { ok: false, code: 'indisponible' } as const;

/**
 * Comme en production tant que la migration 0008 n'est pas appliquée : tout répond « indisponible ».
 * C'est le client par défaut d'`AppEnMemoire`, pour que les écrans de Gérer restent inchangés.
 */
export const clientBailIndisponible: ClientBail = {
  etat: () => Promise.resolve(INDISPONIBLE),
  enregistrerBien: () => Promise.resolve(INDISPONIBLE),
  enregistrerRevision: () => Promise.resolve(INDISPONIBLE),
  appliquerRevision: () => Promise.resolve(INDISPONIBLE),
  lettre: () => Promise.resolve(INDISPONIBLE),
};

/** Un client de la vie du bail sans réseau, aux mêmes règles que l'API. */
export function clientBailMemoire(options: OptionsBailMemoire = {}): ClientBailMemoire {
  let donnees = options.etat ?? ETAT_BAIL_VIDE;
  const complets = new Map((options.lettres ?? []).map((l) => [l.id, l]));
  const maintenant = options.maintenant ?? '2026-09-14T09:00:00.000Z';
  const aujourdhui = maintenant.slice(0, 10);
  const appels: ActionBailClient[] = [];
  let compteur = 0;

  async function executer<T>(
    action: ActionBailClient,
    faire: () => Promise<ResultatBail<T>> | ResultatBail<T>,
  ): Promise<ResultatBail<T>> {
    appels.push(action);
    const erreur = options.erreurs?.[action];
    return erreur === undefined ? faire() : { ok: false, code: erreur };
  }

  /** L'état de la gestion, ou `null` sans client de gestion ou s'il échoue. */
  const etatGestion = async (): Promise<EtatGestion | null> => {
    if (options.gestion === undefined) return null;
    const lu = await options.gestion.etat();
    return lu.ok ? lu.valeur : null;
  };

  const appliquer = async (
    client: ClientGestion,
    etat: EtatGestion,
    locationId: string,
    anniversaire: string,
  ): Promise<ResultatBail<RevisionAppliquee>> => {
    const location = etat.locations.find((l) => l.id === locationId);
    const bien = etat.biens.find((b) => b.id === location?.bienId);
    if (location === undefined || bien === undefined) return INTROUVABLE;
    const deja = [...complets.values()].find(
      (l) => l.locationId === locationId && l.anniversaire === anniversaire,
    );
    if (deja !== undefined) {
      const revision = enregistree(revisionDeLaLocation(location, donnees, aujourdhui));
      return { ok: true, valeur: { lettre: deja, revision, location } };
    }
    const proposition = propositionDe(location, etat, donnees, aujourdhui);
    if (proposition.statut !== 'proposee' || proposition.anniversaire !== anniversaire) {
      return { ok: false, code: 'revision_impossible' };
    }
    if (etat.bailleur === null) return { ok: false, code: 'bailleur_manquant' };
    const { aPartirDe } = proposition;
    if (changementRefuse(location, [], aPartirDe, aujourdhui) !== null) {
      return { ok: false, code: 'hors_location' };
    }
    const ecrite = await client.modifierLocation(locationId, {
      montants: {
        aPartirDe,
        loyerHorsCharges: proposition.nouveauLoyer,
        charges: proposition.charges,
        apl: montantsDuMois(location, aPartirDe).apl,
      },
    });
    if (!ecrite.ok) return { ok: false, code: codeDepuisGestion(ecrite.code) };

    const locataires = [location.locataireId, ...location.colocataireIds].flatMap((id) =>
      etat.locataires.filter((l) => l.id === id).map(({ prenom, nom }) => ({ prenom, nom })),
    );
    const contenu = contenuLettreRevision({
      locationId,
      bailleur: etat.bailleur,
      locataires,
      logement: {
        nom: bien.nom,
        adresse: bien.adresse,
        ...(location.libelle === undefined ? {} : { libelle: location.libelle }),
      },
      proposition,
      emisLe: aujourdhui,
    });
    compteur += 1;
    const lettre: LettreRevisionComplete = {
      id: `lettre-${String(compteur)}`,
      locationId,
      numero: contenu.numero,
      anniversaire,
      emisLe: maintenant,
      contenu,
    };
    const revision: RevisionLocation = {
      ...enregistree(revisionDeLaLocation(location, donnees, aujourdhui)),
      active: true,
      trimestre: proposition.indiceNouveau.trimestre,
      derniereRevision: anniversaire,
      modifieLe: maintenant,
    };
    complets.set(lettre.id, lettre);
    donnees = {
      ...donnees,
      revisions: [...donnees.revisions.filter((r) => r.locationId !== locationId), revision],
      lettres: [...donnees.lettres, LettreRevisionSchema.parse(lettre)],
    };
    return { ok: true, valeur: { lettre, revision, location: ecrite.valeur } };
  };

  return {
    appels,
    donnees: () => donnees,
    etat: () => executer('etat', () => ({ ok: true, valeur: donnees })),
    enregistrerBien: (bienId, saisie) =>
      executer('enregistrerBien', async () => {
        const lu = LegalBienSaisieSchema.safeParse(saisie);
        if (!lu.success) return INVALIDE;
        const etat = await etatGestion();
        if (etat !== null && !etat.biens.some((b) => b.id === bienId)) return INTROUVABLE;
        const legal = { bienId, ...lu.data, modifieLe: maintenant };
        donnees = {
          ...donnees,
          biens: [...donnees.biens.filter((b) => b.bienId !== bienId), legal],
        };
        return { ok: true, valeur: legal };
      }),
    enregistrerRevision: (locationId, saisie) =>
      executer('enregistrerRevision', async () => {
        const lu = RevisionSaisieSchema.safeParse(saisie);
        if (!lu.success) return INVALIDE;
        const etat = await etatGestion();
        if (etat !== null && !etat.locations.some((l) => l.id === locationId)) {
          return INTROUVABLE;
        }
        const avant = donnees.revisions.find((r) => r.locationId === locationId);
        const revision: RevisionLocation = {
          locationId,
          ...lu.data,
          derniereRevision: avant === undefined ? null : avant.derniereRevision,
          modifieLe: maintenant,
        };
        donnees = {
          ...donnees,
          revisions: [...donnees.revisions.filter((r) => r.locationId !== locationId), revision],
        };
        return { ok: true, valeur: revision };
      }),
    appliquerRevision: (locationId, anniversaire) =>
      executer('appliquerRevision', async () => {
        const etat = await etatGestion();
        if (options.gestion === undefined || etat === null) return INTROUVABLE;
        return appliquer(options.gestion, etat, locationId, anniversaire);
      }),
    lettre: (id) =>
      executer('lettre', () => {
        const lettre = complets.get(id);
        return lettre === undefined ? INTROUVABLE : { ok: true, valeur: lettre };
      }),
  };
}
