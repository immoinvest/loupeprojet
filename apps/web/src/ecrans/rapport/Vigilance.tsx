import { questionsPourProjet, type Resultats } from '@loupe/moteur';
import { useMemo, type JSX } from 'react';
import { Link } from 'react-router';

import { useModeDocument } from '@/composants/document';
import { Carte, TitreCarte } from '@/composants/ui';
import { useProjetCourant } from '@/coque/ProjetLayout';
import { phraseVigilance } from '@/textes/vigilance';
import { phraseVisite } from '@/textes/visite';
import { progression, visiteDe } from '@/visite';

/**
 * Sous les feux : les points financiers à régler avant l'offre (ils ne se vérifient pas en
 * visite), et l'état de la visite avec le lien vers sa liste ou son compte rendu.
 */
export function CarteVigilance({ r }: { r: Resultats }): JSX.Element {
  const { enregistre } = useProjetCourant();
  const document = useModeDocument();
  const visite = visiteDe(enregistre);
  const questions = useMemo(() => questionsPourProjet(r.projet, r), [r]);
  const phrase = phraseVisite(visite, progression(questions, visite));
  const points = r.verdict.vigilance;
  return (
    <Carte>
      <TitreCarte>Avant de faire une offre</TitreCarte>
      {points.length === 0 ? (
        <p className="m-0 text-[15px] text-encre-2">
          Rien à régler côté banque ni fiscalité avec ces hypothèses.
        </p>
      ) : (
        <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-[15px] text-encre-2">
          {points.map((p, i) => (
            <li key={`${p.code}-${String(i)}`}>{phraseVigilance(p)}</li>
          ))}
        </ul>
      )}
      <p className="m-0 text-[15px]">
        {document ? (
          <span className="font-semibold text-encre-2">{phrase}</span>
        ) : (
          <Link
            to={`/projets/${enregistre.id}/visite`}
            className="inline-flex min-h-11 items-center font-bold"
          >
            {phrase}
          </Link>
        )}
      </p>
    </Carte>
  );
}
