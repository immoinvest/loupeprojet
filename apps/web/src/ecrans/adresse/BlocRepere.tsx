import { precisionDe } from '@loupe/moteur';
import type { JSX } from 'react';

import { Pastille } from '@/composants/ui';
import { useProjetCourant } from '@/coque/ProjetLayout';
import { ecartAuRepere } from '@/enrichissement';
import { pourcentageSigne } from '@/formatage/nombres';
import { PHRASES_CONFIANCE, phrasePrixAffiche, phraseRepere } from '@/textes/confiance';

import { badgeDeSource } from '../hypotheses/ChampHypothese';

/**
 * Dans la carte Estimation, le repère qui fait le prix : phrase du repère, écart du prix affiché, provenance et
 * mention « moins précis » d'un repère de commune. Remplace l'ancienne carte « Le repère utilisé » (fiche 14).
 */
export function BlocRepere(): JSX.Element {
  const { enregistre } = useProjetCourant();
  const { projet } = enregistre;
  const dvf = projet.marche.dvf;
  const badge = badgeDeSource(projet.provenance['marche.dvf.medianM2']);
  const { prix } = projet.hypotheses.achat;
  const { surface } = projet.bien;
  return (
    <div className="flex flex-col gap-1 border-t border-accent-bordure pt-3">
      <p className="m-0 flex flex-wrap items-center gap-2 text-sm font-semibold text-encre-2">
        {PHRASES_CONFIANCE.titreRepere}
        {dvf !== undefined && badge !== null && (
          <Pastille ton={badge.ton} compacte>
            {badge.libelle}
          </Pastille>
        )}
      </p>
      {dvf === undefined ? (
        <p className="m-0 text-[15px] text-encre-2">{PHRASES_CONFIANCE.sansRepere}</p>
      ) : (
        <>
          <p className="m-0 text-[15px]">{phraseRepere(dvf, projet.bien.type)}</p>
          <p className="m-0 text-[15px] text-encre-2">
            {phrasePrixAffiche(prix, surface)} Soit{' '}
            {pourcentageSigne(ecartAuRepere(prix / surface, dvf.medianM2))} par rapport à la
            médiane.
          </p>
          {precisionDe(dvf) === 'commune' && (
            <div>
              <Pastille ton="surveiller" compacte>
                {PHRASES_CONFIANCE.moinsPrecis}
              </Pastille>
            </div>
          )}
        </>
      )}
    </div>
  );
}
