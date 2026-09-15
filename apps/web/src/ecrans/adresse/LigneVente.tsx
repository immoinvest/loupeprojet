import { Fragment, type JSX } from 'react';

import { Pastille } from '@/composants/ui';
import { prixAujourdhui, type VenteProcheAdresse } from '@/enrichissement';
import { dateCourte, euros, nombre } from '@/formatage/nombres';
import { LIBELLES_GROUPES, prixM2 } from '@/textes/adresse';
import { PHRASES_CARTE } from '@/textes/carte';
import { PHRASES_VENTES } from '@/textes/ventes';

import { DetailVente } from './DetailVente';

export const CELLULE = 'border-b border-bordure-douce px-3 py-2 text-left align-top';
/** Première colonne collante : elle reste visible quand le tableau défile au doigt. */
export const COLLANTE = 'sticky left-0 z-[1]';

export type VenteNumerotee = VenteProcheAdresse & { readonly numero: number };

const BOUTON_LIGNE =
  'rounded-sm text-left text-sm font-semibold text-accent survol-texte pointer-coarse:min-h-11 pointer-coarse:min-w-11';

/**
 * Une vente du tableau et son détail dépliable. La vente sélectionnée (sur la carte ou ici) est mise en avant
 * (`aria-current`) ; « Sur la carte » n'apparaît que pour une vente placée sur la carte.
 */
export function LigneVente({
  vente: v,
  avecDpe,
  ouvert,
  selectionnee,
  surCarte,
  nombreColonnes,
  onDetail,
  onVoirCarte,
}: {
  vente: VenteNumerotee;
  avecDpe: boolean;
  ouvert: boolean;
  selectionnee: boolean;
  surCarte: boolean;
  nombreColonnes: number;
  onDetail: () => void;
  onVoirCarte: () => void;
}): JSX.Element {
  const idDetail = `vente-detail-${String(v.numero)}`;
  const fond = selectionnee ? 'bg-accent-fond' : 'bg-surface';
  return (
    <Fragment>
      <tr
        tabIndex={-1}
        aria-current={selectionnee ? 'true' : undefined}
        className={selectionnee ? 'bg-accent-fond outline-none' : 'outline-none'}
      >
        <td className={`${CELLULE} ${COLLANTE} ${fond} ${selectionnee ? 'font-semibold' : ''}`}>
          {dateCourte(v.date)}
        </td>
        <td className={CELLULE}>{v.adresse ?? PHRASES_VENTES.inconnu}</td>
        <td className={CELLULE}>{nombre(v.surface)} m²</td>
        <td className={CELLULE}>{v.pieces > 0 ? nombre(v.pieces) : PHRASES_VENTES.inconnu}</td>
        <td className={CELLULE}>{euros(v.prix)}</td>
        <td className={CELLULE}>{prixM2(v.prixM2)}</td>
        <td className={CELLULE}>{prixM2(prixAujourdhui(v))}</td>
        <td className={CELLULE}>
          {v.distanceMetres === null ? PHRASES_VENTES.inconnu : `${String(v.distanceMetres)} m`}
        </td>
        {avecDpe && <td className={CELLULE}>{v.dpe?.etiquetteDpe ?? PHRASES_VENTES.inconnu}</td>}
        <td className={CELLULE}>
          <div className="flex flex-wrap gap-1">
            {v.groupes
              .filter((code) => !code.startsWith('rayon_'))
              .map((code) => (
                <Pastille key={code} ton="neutre" compacte>
                  {LIBELLES_GROUPES[code]}
                </Pastille>
              ))}
          </div>
        </td>
        <td className={`${CELLULE} print:hidden`}>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <button
              type="button"
              aria-expanded={ouvert}
              aria-controls={idDetail}
              onClick={onDetail}
              className={BOUTON_LIGNE}
            >
              {PHRASES_VENTES.detail}
              <span className="sr-only"> {dateCourte(v.date)}</span>
            </button>
            {surCarte && (
              <button type="button" onClick={onVoirCarte} className={BOUTON_LIGNE}>
                {PHRASES_CARTE.voirCarte}
                <span className="sr-only"> : vente du {dateCourte(v.date)}</span>
              </button>
            )}
          </div>
        </td>
      </tr>
      {ouvert && (
        <tr id={idDetail}>
          <td colSpan={nombreColonnes} className={`${CELLULE} bg-accent-fond`}>
            <DetailVente vente={v} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}
