import { useMemo, useReducer, useState, type Dispatch } from 'react';

import {
  cleVente,
  ETAT_LIAISON_INITIAL,
  liaisonVentes,
  type ActionLiaison,
  type EtatLiaison,
  type ReponseAdresse,
} from '@/enrichissement';

export interface LiaisonVentes {
  readonly etat: EtatLiaison;
  readonly envoyer: Dispatch<ActionLiaison>;
  /** Clés des ventes placées sur la carte : seules ces lignes du tableau proposent « Sur la carte ». */
  readonly clesCarte: ReadonlySet<string>;
}

/**
 * La carte et le tableau des ventes partagent la vente sélectionnée, les filtres et le rayon ; tout revient à zéro
 * quand l'analyse change.
 */
export function useLiaisonVentes(analyse: ReponseAdresse | null): LiaisonVentes {
  const [etat, envoyer] = useReducer(liaisonVentes, ETAT_LIAISON_INITIAL);
  const [source, setSource] = useState(analyse);
  if (source !== analyse) {
    setSource(analyse);
    envoyer({ type: 'reinitialiser' });
  }
  const clesCarte = useMemo(() => new Set((analyse?.ventesCarte ?? []).map(cleVente)), [analyse]);
  return { etat, envoyer, clesCarte };
}
