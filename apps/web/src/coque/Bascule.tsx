import { useEffect, useRef } from 'react';

import { decisionBascule } from '@/application/bascule';
import { useProjets } from '@/stockage/ProjetsContext';
import {
  lienTransfert,
  marquerTransfertFait,
  projetsATransferer,
  transfertDejaFait,
} from '@/stockage/transfert';

export interface ProprietesBascule {
  /** `DEKLIC_TRANSFERT=1` au build. */
  readonly actif: boolean;
  /** L'adresse de production du build (`DEKLIC_ORIGINE`). */
  readonly origineCible: string;
  readonly stockage?: Storage;
  readonly fenetre?: Pick<Window, 'location'>;
}

/**
 * Au chargement de l'ancienne adresse, quand la bascule est activée : envoie une fois les projets de
 * l'appareil vers la nouvelle adresse, puis redirige chaque visite. N'affiche rien.
 */
export function Bascule({
  actif,
  origineCible,
  stockage = window.localStorage,
  fenetre = window,
}: ProprietesBascule): null {
  const { projets } = useProjets();
  const lance = useRef(false);

  useEffect(() => {
    if (lance.current) return;
    const { origin, pathname, search, hash } = fenetre.location;
    const aEmporter = projetsATransferer(projets);
    const decision = decisionBascule({
      actif,
      origineCourante: origin,
      origineCible,
      chemin: `${pathname}${search}${hash}`,
      aTransferer: aEmporter.length > 0 && !transfertDejaFait(stockage),
    });
    if (decision.type === 'rester') return;
    lance.current = true;
    if (decision.type === 'rediriger') {
      fenetre.location.replace(decision.url);
      return;
    }
    void lienTransfert(decision.cible, aEmporter).then((lien) => {
      // Marqué avant de partir : rien n'est supprimé ici, les projets restent sur l'ancienne adresse.
      marquerTransfertFait(stockage, new Date().toISOString());
      fenetre.location.replace(lien);
    });
  }, [actif, origineCible, projets, stockage, fenetre]);

  return null;
}
