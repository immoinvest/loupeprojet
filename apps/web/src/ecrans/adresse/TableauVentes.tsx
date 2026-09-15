import { Fragment, useMemo, useState, type JSX } from 'react';

import { Bouton, Carte, Pastille } from '@/composants/ui';
import { useProjetCourant } from '@/coque/ProjetLayout';
import {
  CLES_TRI,
  filtrerVentes,
  pageDe,
  prixAujourdhui,
  SANS_FILTRE,
  TRI_DEFAUT,
  trierVentes,
  triSuivant,
  type CleTri,
  type FiltresVentes,
  type ReponseAdresse,
  type Tri,
  type VenteProcheAdresse,
} from '@/enrichissement';
import { dateCourte, euros, nombre } from '@/formatage/nombres';
import { LIBELLES_GROUPES, prixM2 } from '@/textes/adresse';
import {
  LIBELLES_COLONNES,
  LIBELLES_FILTRES,
  libelleFiltrePieces,
  phraseNombreVentes,
  phrasePage,
  PHRASES_VENTES,
  phraseTri,
  phraseTronquees,
} from '@/textes/ventes';

import { DetailVente } from './DetailVente';

const CELLULE = 'border-b border-bordure-douce px-3 py-2 text-left align-top';
const ENTETE =
  'border-b border-bordure px-3 py-2 text-left text-xs font-bold text-encre-3 uppercase';
/** Première colonne collante : elle reste visible quand le tableau défile au doigt. */
const COLLANTE = 'sticky left-0 z-[1]';

type VenteNumerotee = VenteProcheAdresse & { readonly numero: number };

const ARIA_SORT = { croissant: 'ascending', decroissant: 'descending' } as const;
const FLECHE = { croissant: '↑', decroissant: '↓' } as const;

function EnteteTriable({
  cle,
  tri,
  onTri,
  collante = false,
}: {
  cle: CleTri;
  tri: Tri;
  onTri: (cle: CleTri) => void;
  collante?: boolean;
}): JSX.Element {
  const actif = tri.cle === cle;
  return (
    <th
      scope="col"
      aria-sort={actif ? ARIA_SORT[tri.sens] : 'none'}
      className={`${ENTETE} ${collante ? `${COLLANTE} bg-surface` : ''}`}
    >
      <button
        type="button"
        onClick={() => {
          onTri(cle);
        }}
        className={`inline-flex items-center gap-1 rounded-sm text-left uppercase survol-texte pointer-coarse:min-h-11 ${
          actif ? 'text-accent' : ''
        }`}
      >
        {LIBELLES_COLONNES[cle]}
        {actif && <span aria-hidden="true">{FLECHE[tri.sens]}</span>}
      </button>
    </th>
  );
}

/**
 * Les ventes comparables autour du bien (jusqu'à 300) : tri par colonne, filtres rapides, 20 par page, détail
 * dépliable. Tri, filtres et pages reviennent à zéro quand l'analyse change.
 */
export function TableauVentes({ analyse }: { analyse: ReponseAdresse }): JSX.Element | null {
  const { enregistre } = useProjetCourant();
  const piecesBien = enregistre.projet.bien.pieces;
  const [source, setSource] = useState(analyse);
  const [tri, setTri] = useState<Tri>(TRI_DEFAUT);
  const [filtres, setFiltres] = useState<FiltresVentes>(SANS_FILTRE);
  const [page, setPage] = useState(1);
  const [ouverts, setOuverts] = useState<ReadonlySet<number>>(new Set());
  if (source !== analyse) {
    setSource(analyse);
    setTri(TRI_DEFAUT);
    setFiltres(SANS_FILTRE);
    setPage(1);
    setOuverts(new Set());
  }

  const numerotees = useMemo<VenteNumerotee[]>(
    () => analyse.ventesProches.map((v, numero) => ({ ...v, numero })),
    [analyse],
  );
  const avecDpe = analyse.dpeVentes !== undefined;
  const dpeConnus = numerotees.some((v) => v.dpe != null);
  const colonnes = CLES_TRI.filter((cle) => cle !== 'dpe' || avecDpe);
  const affichees = useMemo(
    () => trierVentes(filtrerVentes(numerotees, filtres, piecesBien), tri),
    [numerotees, filtres, piecesBien, tri],
  );
  if (numerotees.length === 0) return null;
  const pagee = pageDe(affichees, page);

  const trier = (cle: CleTri): void => {
    setTri(triSuivant(tri, cle));
    setPage(1);
  };
  const basculerFiltre = (cle: keyof FiltresVentes): void => {
    setFiltres({ ...filtres, [cle]: !filtres[cle] });
    setPage(1);
  };
  const basculerDetail = (numero: number): void => {
    const suivants = new Set(ouverts);
    if (suivants.has(numero)) suivants.delete(numero);
    else suivants.add(numero);
    setOuverts(suivants);
  };

  const boutonsFiltres: [keyof FiltresVentes, string][] = [
    ['memeImmeuble', LIBELLES_FILTRES.memeImmeuble],
    ['recentes', LIBELLES_FILTRES.recentes],
    ...(piecesBien > 0
      ? [['memesPieces', libelleFiltrePieces(piecesBien)] as [keyof FiltresVentes, string]]
      : []),
    ...(dpeConnus
      ? [['passoires', LIBELLES_FILTRES.passoires] as [keyof FiltresVentes, string]]
      : []),
  ];
  // Date, adresse, colonnes triables sauf la date, place, détail.
  const nombreColonnes = colonnes.length + 3;

  return (
    <Carte>
      <h2 className="m-0 font-display text-[22px] font-semibold">{PHRASES_VENTES.titre}</h2>
      {analyse.ventesProchesTronquees === true && analyse.ventesProchesTotal !== undefined && (
        <p className="m-0 text-[15px] text-encre-2">
          {phraseTronquees(numerotees.length, analyse.ventesProchesTotal)}
        </p>
      )}

      <div
        role="group"
        aria-label={PHRASES_VENTES.filtres}
        className="flex flex-wrap items-center gap-2 print:hidden"
      >
        {boutonsFiltres.map(([cle, libelle]) => (
          <button
            key={cle}
            type="button"
            aria-pressed={filtres[cle]}
            onClick={() => {
              basculerFiltre(cle);
            }}
            className={`min-h-[36px] rounded-full border px-3 text-sm font-semibold survol-fond pointer-coarse:min-h-11 ${
              filtres[cle]
                ? 'border-accent bg-accent-fond text-accent'
                : 'border-bordure bg-surface text-encre-2'
            }`}
          >
            {libelle}
          </button>
        ))}
        <span className="text-sm text-encre-3" aria-live="polite">
          {phraseNombreVentes(affichees.length)} · {phraseTri(tri.cle, tri.sens === 'croissant')}
        </span>
      </div>
      {analyse.dpeVentes === 'indisponible' && (
        <Pastille ton="surveiller" compacte>
          {PHRASES_VENTES.dpeIndisponible}
        </Pastille>
      )}

      {affichees.length === 0 ? (
        <p className="m-0 text-[15px] text-encre-2">{PHRASES_VENTES.aucune}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[15px]">
            <thead>
              <tr>
                <EnteteTriable cle="date" tri={tri} onTri={trier} collante />
                <th scope="col" className={ENTETE}>
                  Adresse
                </th>
                {colonnes
                  .filter((cle) => cle !== 'date')
                  .map((cle) => (
                    <EnteteTriable key={cle} cle={cle} tri={tri} onTri={trier} />
                  ))}
                <th scope="col" className={ENTETE}>
                  Place
                </th>
                <th scope="col" className={`${ENTETE} print:hidden`}>
                  <span className="sr-only">{PHRASES_VENTES.detail}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pagee.lignes.map((v) => {
                const ouvert = ouverts.has(v.numero);
                const idDetail = `vente-detail-${String(v.numero)}`;
                return (
                  <Fragment key={v.numero}>
                    <tr>
                      <td className={`${CELLULE} ${COLLANTE} bg-surface`}>{dateCourte(v.date)}</td>
                      <td className={CELLULE}>{v.adresse ?? PHRASES_VENTES.inconnu}</td>
                      <td className={CELLULE}>{nombre(v.surface)} m²</td>
                      <td className={CELLULE}>
                        {v.pieces > 0 ? nombre(v.pieces) : PHRASES_VENTES.inconnu}
                      </td>
                      <td className={CELLULE}>{euros(v.prix)}</td>
                      <td className={CELLULE}>{prixM2(v.prixM2)}</td>
                      <td className={CELLULE}>{prixM2(prixAujourdhui(v))}</td>
                      <td className={CELLULE}>
                        {v.distanceMetres === null
                          ? PHRASES_VENTES.inconnu
                          : `${String(v.distanceMetres)} m`}
                      </td>
                      {avecDpe && (
                        <td className={CELLULE}>{v.dpe?.etiquetteDpe ?? PHRASES_VENTES.inconnu}</td>
                      )}
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
                        <button
                          type="button"
                          aria-expanded={ouvert}
                          aria-controls={idDetail}
                          onClick={() => {
                            basculerDetail(v.numero);
                          }}
                          className="rounded-sm text-sm font-semibold text-accent survol-texte pointer-coarse:min-h-11"
                        >
                          {PHRASES_VENTES.detail}
                          <span className="sr-only"> {dateCourte(v.date)}</span>
                        </button>
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
              })}
            </tbody>
          </table>
        </div>
      )}

      {pagee.pages > 1 && (
        <nav
          aria-label={PHRASES_VENTES.pagination}
          className="flex flex-wrap items-center justify-between gap-3 print:hidden"
        >
          <Bouton
            disabled={pagee.page === 1}
            onClick={() => {
              setPage(pagee.page - 1);
            }}
          >
            {PHRASES_VENTES.precedent}
          </Bouton>
          <span className="text-sm text-encre-2">{phrasePage(pagee.page, pagee.pages)}</span>
          <Bouton
            disabled={pagee.page === pagee.pages}
            onClick={() => {
              setPage(pagee.page + 1);
            }}
          >
            {PHRASES_VENTES.suivant}
          </Bouton>
        </nav>
      )}
    </Carte>
  );
}
