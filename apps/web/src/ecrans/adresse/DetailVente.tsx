import type { JSX } from 'react';

import type { VenteProcheAdresse } from '@/enrichissement';
import { euros, nombre } from '@/formatage/nombres';
import { LIBELLES_GROUPES } from '@/textes/adresse';
import {
  phraseAnnexes,
  phraseDpe,
  phraseParcelle,
  phrasePrixDetail,
  phraseSurfaces,
  PHRASES_VENTES,
} from '@/textes/ventes';

const TERME = 'font-semibold text-encre-2';
const DEFINITION = 'm-0';

/**
 * Le détail d'une vente comparable : prix de l'acte jusqu'au prix ramené au bien, surfaces, ce qui a été vendu
 * avec, DPE probable, parcelle et place par rapport au bien. Rien sur les personnes.
 */
export function DetailVente({ vente }: { vente: VenteProcheAdresse }): JSX.Element {
  const annexes = phraseAnnexes(vente);
  const parcelle = phraseParcelle(vente);
  const place = vente.groupes.map((code) => LIBELLES_GROUPES[code]).join(' · ');
  const distance = vente.distanceMetres === null ? '' : `${nombre(vente.distanceMetres)} m du bien`;
  return (
    <dl className="m-0 grid gap-x-4 gap-y-1 text-[15px] sm:grid-cols-[max-content_1fr]">
      <dt className={TERME}>Prix</dt>
      <dd className={DEFINITION}>
        {euros(vente.prix)} · {phrasePrixDetail(vente)}
      </dd>
      <dt className={TERME}>Surface</dt>
      <dd className={DEFINITION}>{phraseSurfaces(vente)}</dd>
      {annexes !== null && (
        <>
          <dt className={TERME}>Vendu avec</dt>
          <dd className={DEFINITION}>{annexes}</dd>
        </>
      )}
      {vente.dpe != null && (
        <>
          <dt className={TERME}>DPE probable</dt>
          <dd className={DEFINITION}>
            {phraseDpe(vente.dpe)}
            <span className="block text-xs text-encre-3">{PHRASES_VENTES.dpeProbable}</span>
          </dd>
        </>
      )}
      {parcelle !== null && (
        <>
          <dt className={TERME}>Cadastre</dt>
          <dd className={DEFINITION}>{parcelle}</dd>
        </>
      )}
      <dt className={TERME}>Place</dt>
      <dd className={DEFINITION}>{[place, distance].filter((t) => t !== '').join(' · ')}</dd>
    </dl>
  );
}
