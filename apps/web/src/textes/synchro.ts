import { LIMITE_PROJETS } from '@loupe/projets';

import type { StatutSynchro } from '@/stockage/synchro/types';

/** Les états de l'envoi au compte qui demandent l'attention (Mes projets, Mon compte). */
export const ETATS_SYNCHRO: Readonly<
  Record<Exclude<StatutSynchro, 'local' | 'en_cours' | 'a_jour'>, string>
> = {
  hors_ligne: 'Hors ligne : envoi au retour du réseau',
  indisponible: 'Sauvegarde du compte indisponible, projets gardés sur cet appareil',
  limite: `Limite de ${String(LIMITE_PROJETS)} projets atteinte`,
  reconnexion: 'Session expirée : reconnectez-vous',
};

/** Rien quand tout va bien ; sinon la phrase à afficher. */
export function alerteSynchro(statut: StatutSynchro): string | null {
  if (statut === 'local' || statut === 'en_cours' || statut === 'a_jour') return null;
  return ETATS_SYNCHRO[statut];
}
