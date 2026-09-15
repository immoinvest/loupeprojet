import {
  accordValide,
  BailleurBienSchema,
  TelephoneSchema,
  type AccordLocataire,
  type EtatEnvois,
  type LectureAccord,
} from '@loupe/gestion';

import type {
  ClientAccord,
  ClientEnvois,
  CodeErreurEnvois,
  ResultatEnvois,
  TypeReponseAccord,
} from './types';

export const ETAT_ENVOIS_VIDE: EtatEnvois = {
  mode: 'reel',
  invitations: true,
  accords: [],
  envois: [],
  contacts: [],
  bailleursBiens: [],
};

export type ActionEnvois = keyof ClientEnvois;

export interface OptionsEnvoisMemoire {
  readonly etat?: EtatEnvois;
  /** Force une erreur sur une action (`indisponible` sur `etat` : migration absente). */
  readonly erreurs?: Partial<Record<ActionEnvois, CodeErreurEnvois>>;
  readonly maintenant?: string;
}

export interface ClientEnvoisMemoire extends ClientEnvois {
  readonly donnees: () => EtatEnvois;
  readonly appels: ActionEnvois[];
}

const INVALIDE = { ok: false, code: 'invalide' } as const;

function remplacerAccord(etat: EtatEnvois, accord: AccordLocataire): EtatEnvois {
  return {
    ...etat,
    accords: [...etat.accords.filter((a) => a.locataireId !== accord.locataireId), accord],
  };
}

/** Un client des envois sans réseau, aux mêmes règles que l'API (tests et aperçu). */
export function clientEnvoisMemoire(options: OptionsEnvoisMemoire = {}): ClientEnvoisMemoire {
  let donnees = options.etat ?? ETAT_ENVOIS_VIDE;
  const maintenant = options.maintenant ?? '2026-09-14T09:00:00.000Z';
  const appels: ActionEnvois[] = [];

  function executer<T>(
    action: ActionEnvois,
    faire: () => ResultatEnvois<T>,
  ): Promise<ResultatEnvois<T>> {
    appels.push(action);
    const erreur = options.erreurs?.[action];
    return Promise.resolve(erreur === undefined ? faire() : { ok: false, code: erreur });
  }
  const accordDe = (id: string): AccordLocataire | undefined =>
    donnees.accords.find((a) => a.locataireId === id);

  return {
    appels,
    donnees: () => donnees,
    etat: () => executer('etat', () => ({ ok: true, valeur: donnees })),
    declarerAccord: (id) =>
      executer('declarerAccord', () => {
        const accord = accordDe(id);
        if (accord === undefined) return { ok: false, code: 'introuvable' };
        if (accord.statut === 'sans_email') return { ok: false, code: 'sans_email' };
        const declare: AccordLocataire = {
          locataireId: id,
          statut: 'declare_par_bailleur',
          le: maintenant,
        };
        donnees = remplacerAccord(donnees, declare);
        return { ok: true, valeur: declare };
      }),
    inviter: (id) =>
      executer('inviter', () => {
        const accord = accordDe(id);
        if (accord === undefined) return { ok: false, code: 'introuvable' };
        if (accord.statut === 'sans_email') return { ok: false, code: 'sans_email' };
        if (!donnees.invitations) return { ok: false, code: 'inactifs' };
        if (accordValide(accord.statut)) return { ok: true, valeur: accord };
        if (accord.invitationLe !== undefined) return { ok: false, code: 'invitation_recente' };
        const invite: AccordLocataire = {
          locataireId: id,
          statut: 'en_attente',
          invitationLe: maintenant,
        };
        donnees = remplacerAccord(donnees, invite);
        return { ok: true, valeur: invite };
      }),
    enregistrerContact: (id, telephone) =>
      executer('enregistrerContact', () => {
        const lu = telephone === null ? null : TelephoneSchema.safeParse(telephone);
        if (lu?.success === false) return INVALIDE;
        const autres = donnees.contacts.filter((c) => c.locataireId !== id);
        const valeur = lu === null ? null : lu.data;
        donnees = {
          ...donnees,
          contacts: valeur === null ? autres : [...autres, { locataireId: id, telephone: valeur }],
        };
        return { ok: true, valeur: { telephone: valeur } };
      }),
    enregistrerBailleurBien: (bienId, bailleur) =>
      executer('enregistrerBailleurBien', () => {
        const lu = bailleur === null ? null : BailleurBienSchema.safeParse(bailleur);
        if (lu?.success === false) return INVALIDE;
        const autres = donnees.bailleursBiens.filter((b) => b.bienId !== bienId);
        const valeur = lu === null ? null : lu.data;
        donnees = {
          ...donnees,
          bailleursBiens: valeur === null ? autres : [...autres, { bienId, ...valeur }],
        };
        return { ok: true, valeur: { bailleur: valeur } };
      }),
    renvoyer: (documentId) =>
      executer('renvoyer', () => {
        const traces = donnees.envois.filter((e) => e.documentId === documentId);
        if (traces.length === 0) return { ok: false, code: 'sans_accord' };
        const renvoyees = traces.map((e) => ({
          ...e,
          statut: 'envoye' as const,
          tentatives: e.tentatives + 1,
          dernierEssaiLe: maintenant,
          envoyeLe: maintenant,
        }));
        donnees = {
          ...donnees,
          envois: [...donnees.envois.filter((e) => e.documentId !== documentId), ...renvoyees],
        };
        return { ok: true, valeur: renvoyees };
      }),
  };
}

const INDISPONIBLE = { ok: false, code: 'indisponible' } as const;

/** Sans migration 0009 : chaque action répond « indisponible ». */
export function clientEnvoisIndisponible(): ClientEnvois {
  const repondre = (): Promise<typeof INDISPONIBLE> => Promise.resolve(INDISPONIBLE);
  return {
    etat: repondre,
    declarerAccord: repondre,
    inviter: repondre,
    enregistrerContact: repondre,
    enregistrerBailleurBien: repondre,
    renvoyer: repondre,
  };
}

export interface OptionsAccordMemoire {
  /** Ce que la page affiche pour les jetons valides. */
  readonly lecture?: LectureAccord;
  readonly jetonsValides?: readonly string[];
  readonly erreur?: CodeErreurEnvois;
}

export interface ClientAccordMemoire extends ClientAccord {
  readonly reponses: { readonly jeton: string; readonly reponse: TypeReponseAccord }[];
}

/** La page publique sans réseau : un jeton valide sert une seule fois. */
export function clientAccordMemoire(options: OptionsAccordMemoire = {}): ClientAccordMemoire {
  const valides = new Set(options.jetonsValides ?? []);
  const lecture = options.lecture ?? { prenom: 'Julie', bailleur: null, logement: null };
  const reponses: { jeton: string; reponse: TypeReponseAccord }[] = [];
  const echec = (): ResultatEnvois<never> => ({
    ok: false,
    code: options.erreur ?? 'lien_invalide',
  });
  return {
    reponses,
    lire: (jeton) =>
      Promise.resolve(
        options.erreur === undefined && valides.has(jeton)
          ? { ok: true, valeur: lecture }
          : echec(),
      ),
    repondre: (jeton, reponse) => {
      if (options.erreur !== undefined || !valides.delete(jeton)) return Promise.resolve(echec());
      reponses.push({ jeton, reponse });
      return Promise.resolve({ ok: true, valeur: { statut: reponse } });
    },
  };
}
