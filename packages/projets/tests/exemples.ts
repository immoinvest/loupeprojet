import { projetExemple, ProjetSchema } from '@loupe/moteur';

import { NOM_EXEMPLE, type ProjetEnregistre } from '../src/enregistre';
import { JOURNAL_VIDE, type JournalSynchro } from '../src/journal';

export const DIX_HEURES = '2026-09-14T10:00:00.000Z';
export const DIX_HEURES_UNE = '2026-09-14T10:01:00.000Z';

/** Un projet enregistré valide, créé et modifié à 10 h, sauf surcharge. */
export function enregistre(
  id: string,
  surcharges: Partial<ProjetEnregistre> = {},
): ProjetEnregistre {
  return {
    id,
    nom: `Projet ${id}`,
    statut: 'analyse',
    creeLe: DIX_HEURES,
    modifieLe: DIX_HEURES,
    projet: ProjetSchema.parse({ ...projetExemple, id }),
    ...surcharges,
  };
}

/** Le projet d'exemple posé au premier lancement, jamais touché. */
export function exemple(id = 'exemple'): ProjetEnregistre {
  return enregistre(id, { nom: NOM_EXEMPLE, statut: 'visite' });
}

/** Un journal lié au compte `compte`, sans rien en attente, sauf surcharge. */
export function journal(compte: string, surcharges: Partial<JournalSynchro> = {}): JournalSynchro {
  return { ...JOURNAL_VIDE, compte, ...surcharges };
}
