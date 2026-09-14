import type { QuestionPosee } from '@loupe/moteur';

import {
  LONGUEUR_MAX_NOTE,
  type EtatReponse,
  type ProjetEnregistre,
  type ReponseVisite,
  type Visite,
} from '@/stockage/projets';

/** Un projet enregistré avant cette feature, ou jamais visité. */
export const VISITE_VIDE: Visite = { faite: false, reponses: {} };

/** Ce que vaut une question à laquelle personne n'a répondu. */
export const REPONSE_PAR_DEFAUT: ReponseVisite = { etat: 'a_verifier' };

export function visiteDe(enregistre: Pick<ProjetEnregistre, 'visite'>): Visite {
  return enregistre.visite ?? VISITE_VIDE;
}

export function reponseDe(visite: Visite, id: string): ReponseVisite {
  return visite.reponses[id] ?? REPONSE_PAR_DEFAUT;
}

function estParDefaut(reponse: ReponseVisite): boolean {
  return reponse.etat === 'a_verifier' && reponse.note === undefined;
}

/** Écrit la réponse ; une réponse par défaut est retirée du dictionnaire (lien de partage plus court). */
function avecReponse(visite: Visite, id: string, reponse: ReponseVisite): Visite {
  const autres = Object.fromEntries(Object.entries(visite.reponses).filter(([cle]) => cle !== id));
  return {
    ...visite,
    reponses: estParDefaut(reponse) ? autres : { ...autres, [id]: reponse },
  };
}

/** Change l'état d'une question, note conservée. */
export function repondre(visite: Visite, id: string, etat: EtatReponse): Visite {
  const { note } = reponseDe(visite, id);
  return avecReponse(visite, id, note === undefined ? { etat } : { etat, note });
}

/** Change la note d'une question (espaces des bords retirés, longueur bornée) ; vide = pas de note. */
export function noter(visite: Visite, id: string, note: string): Visite {
  const { etat } = reponseDe(visite, id);
  const propre = note.trim().slice(0, LONGUEUR_MAX_NOTE);
  return avecReponse(visite, id, propre === '' ? { etat } : { etat, note: propre });
}

export function marquerFaite(visite: Visite, date: string): Visite {
  return { ...visite, faite: true, date };
}

/** Rouvre la visite : la date disparaît, les réponses restent. */
export function rouvrir(visite: Visite): Visite {
  return { faite: false, reponses: visite.reponses };
}

export interface Progression {
  readonly total: number;
  /** Questions dont l'état n'est plus « à vérifier ». */
  readonly repondues: number;
  readonly problemes: number;
}

/** Compte sur les questions posées seulement : une réponse orpheline ne compte pas. */
export function progression(
  questions: readonly Pick<QuestionPosee, 'id'>[],
  visite: Visite,
): Progression {
  let repondues = 0;
  let problemes = 0;
  for (const q of questions) {
    const { etat } = reponseDe(visite, q.id);
    if (etat !== 'a_verifier') repondues += 1;
    if (etat === 'probleme') problemes += 1;
  }
  return { total: questions.length, repondues, problemes };
}

export function aDesReponses(visite: Visite): boolean {
  return Object.keys(visite.reponses).length > 0;
}
