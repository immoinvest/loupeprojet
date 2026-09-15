import type { JSX } from 'react';

import { Pastille } from '@/composants/ui';
import { ecartAuRepere, type ReferenceAdresse, type ReponseAdresse } from '@/enrichissement';
import { PHRASES_ADRESSE, phraseReference } from '@/textes/adresse';

import { LigneRepere, type EtatLigneRepere } from './LigneRepere';

/**
 * Dans la carte Estimation, après l'analyse de l'adresse : ce qu'est devenu le repère (appliqué, protégé,
 * annulé), où il a été pris et l'écart du prix, ou pourquoi il n'y en a pas ; cadastre indisponible.
 */
export function RepereAnalyse({
  analyse,
  etat,
  prixM2Bien,
  onAnnuler,
  onAppliquer,
}: {
  analyse: ReponseAdresse;
  /** `null` quand l'analyse n'a pas de repère. */
  etat: EtatLigneRepere | null;
  prixM2Bien: number;
  onAnnuler: () => void;
  onAppliquer: (reference: ReferenceAdresse) => void;
}): JSX.Element {
  const reference = analyse.reference;
  return (
    <div className="flex flex-col gap-2 border-t border-accent-bordure pt-3">
      {reference !== null && etat !== null && (
        <LigneRepere
          etat={etat}
          reference={reference}
          onAnnuler={onAnnuler}
          onAppliquer={() => {
            onAppliquer(reference);
          }}
        />
      )}
      <p className="m-0 text-[15px]">
        {reference !== null
          ? phraseReference(reference, ecartAuRepere(prixM2Bien, reference.statistiques.medianeM2))
          : analyse.ventesCommune === 0
            ? PHRASES_ADRESSE.sansVentes
            : PHRASES_ADRESSE.sansRepere}
      </p>
      {analyse.cadastre === 'indisponible' && (
        <div>
          <Pastille ton="surveiller" compacte>
            {PHRASES_ADRESSE.cadastreIndisponible}
          </Pastille>
        </div>
      )}
    </div>
  );
}
