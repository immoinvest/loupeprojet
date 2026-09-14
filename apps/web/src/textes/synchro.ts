import { LIMITE_PROJETS } from '@loupe/projets';

import type { StatutSynchro } from '@/stockage/synchro/types';

/** Où sont les projets, et l'état de leur envoi au compte (Mes projets, Mon compte). */
export const ETATS_SYNCHRO: Readonly<Record<Exclude<StatutSynchro, 'local'>, string>> = {
  en_cours: 'envoi en cours…',
  a_jour: 'à jour',
  hors_ligne: 'hors ligne : envoi au retour du réseau',
  indisponible: 'sauvegarde du compte indisponible, projets gardés sur cet appareil',
  limite: `limite de ${String(LIMITE_PROJETS)} projets atteinte`,
  reconnexion: 'session expirée : reconnectez-vous',
};

/** « 3 projets · sauvegardés sur votre compte · à jour » ; sans compte : « … sur cet appareil ». */
export function ligneSauvegarde(nombre: number, statut: StatutSynchro): string {
  const compte = `${String(nombre)} ${nombre > 1 ? 'projets' : 'projet'}`;
  if (statut === 'local') return `${compte} · sauvegardés sur cet appareil`;
  return `${compte} · sauvegardés sur votre compte · ${ETATS_SYNCHRO[statut]}`;
}
