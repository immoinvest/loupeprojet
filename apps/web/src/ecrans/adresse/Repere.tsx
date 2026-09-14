import { precisionDe } from '@loupe/moteur';
import type { JSX } from 'react';

import { Carte, Pastille } from '@/composants/ui';
import { useProjetCourant } from '@/coque/ProjetLayout';
import { ecartAuRepere } from '@/enrichissement';
import { pourcentageSigne } from '@/formatage/nombres';
import { PHRASES_CONFIANCE, phrasePrixAffiche, phraseRepere } from '@/textes/confiance';

import { badgeDeSource } from '../hypotheses/ChampHypothese';

/**
 * Sans adresse analysée : les chiffres qui servent à l'estimation (repère posé à la création du projet
 * ou saisi dans Hypothèses), leur provenance, et la mention « moins précis » d'un repère de commune.
 */
export function CarteRepere(): JSX.Element {
  const { enregistre } = useProjetCourant();
  const { projet } = enregistre;
  const dvf = projet.marche.dvf;
  const badge = badgeDeSource(projet.provenance['marche.dvf.medianM2']);
  const { prix } = projet.hypotheses.achat;
  const { surface } = projet.bien;
  return (
    <Carte>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="m-0 font-display text-[22px] font-semibold">
          {PHRASES_CONFIANCE.titreRepere}
        </h2>
        {dvf !== undefined && badge !== null && (
          <Pastille ton={badge.ton} compacte>
            {badge.libelle}
          </Pastille>
        )}
      </div>
      {dvf === undefined ? (
        <p className="m-0 text-[15px] text-encre-2">{PHRASES_CONFIANCE.sansRepere}</p>
      ) : (
        <>
          <p className="m-0 text-[17px]">{phraseRepere(dvf, projet.bien.type)}</p>
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
    </Carte>
  );
}
