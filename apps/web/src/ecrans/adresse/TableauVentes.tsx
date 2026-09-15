import { useEffect, useMemo, useRef, useState, type JSX } from 'react';

import { Bouton, Carte, Pastille } from '@/composants/ui';
import { useProjetCourant } from '@/coque/ProjetLayout';
import {
  CLES_TRI,
  cleVente,
  pageDe,
  pageDeLaVente,
  TRI_DEFAUT,
  trierVentes,
  triSuivant,
  ventesVisibles,
  type CleTri,
  type FiltresVentes,
  type ReponseAdresse,
  type Tri,
} from '@/enrichissement';
import { phrasePage, PHRASES_VENTES, LIBELLES_COLONNES, phraseTronquees } from '@/textes/ventes';

import { FiltresTableauVentes } from './FiltresTableauVentes';
import { COLLANTE, LigneVente, type VenteNumerotee } from './LigneVente';
import type { LiaisonVentes } from './useLiaisonVentes';

const ENTETE =
  'border-b border-bordure px-3 py-2 text-left text-xs font-bold text-encre-3 uppercase';

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
        className={`inline-flex items-center gap-1 rounded-sm text-left uppercase survol-texte pointer-coarse:min-h-11 pointer-coarse:min-w-11 ${
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
 * Les ventes comparables autour du bien (jusqu'à 300) : tri par colonne, filtres rapides et rayon partagés avec la
 * carte, 20 par page, détail dépliable. « Voir dans le tableau » depuis la carte amène la ligne à l'écran.
 * Tri, pages et détails reviennent à zéro quand l'analyse change.
 */
export function TableauVentes({
  analyse,
  liaison,
}: {
  analyse: ReponseAdresse;
  liaison: LiaisonVentes;
}): JSX.Element | null {
  const { enregistre } = useProjetCourant();
  const piecesBien = enregistre.projet.bien.pieces;
  const { etat, envoyer, clesCarte } = liaison;
  const [source, setSource] = useState(analyse);
  const [tri, setTri] = useState<Tri>(TRI_DEFAUT);
  const [page, setPage] = useState(1);
  const [ouverts, setOuverts] = useState<ReadonlySet<number>>(new Set());
  const conteneur = useRef<HTMLDivElement>(null);
  const derniereDemande = useRef(etat.demande);
  const [aAmener, setAAmener] = useState(false);
  if (source !== analyse) {
    setSource(analyse);
    setTri(TRI_DEFAUT);
    setPage(1);
    setOuverts(new Set());
  }

  const numerotees = useMemo<VenteNumerotee[]>(
    () => analyse.ventesProches.map((v, numero) => ({ ...v, numero })),
    [analyse],
  );
  const avecDpe = analyse.dpeVentes !== undefined;
  const colonnes = CLES_TRI.filter((cle) => cle !== 'dpe' || avecDpe);
  const affichees = useMemo(
    () => trierVentes(ventesVisibles(numerotees, etat, piecesBien), tri),
    [numerotees, etat, piecesBien, tri],
  );
  const pagee = pageDe(affichees, page);

  // « Voir dans le tableau » : la page de la vente, puis la ligne amenée à l'écran une fois affichée.
  useEffect(() => {
    if (etat.demande === derniereDemande.current) return;
    derniereDemande.current = etat.demande;
    if (etat.afficher !== 'tableau' || etat.selection === null) return;
    const pageVente = pageDeLaVente(affichees, etat.selection);
    if (pageVente !== null) setPage(pageVente);
    setAAmener(true);
  }, [etat.demande]);
  useEffect(() => {
    if (!aAmener) return;
    setAAmener(false);
    const ligne = conteneur.current?.querySelector<HTMLElement>('tr[aria-current="true"]');
    if (typeof ligne?.scrollIntoView === 'function') ligne.scrollIntoView({ block: 'center' });
    ligne?.focus({ preventScroll: true });
  }, [aAmener, pagee.page]);

  if (numerotees.length === 0) return null;

  const trier = (cle: CleTri): void => {
    setTri(triSuivant(tri, cle));
    setPage(1);
  };
  const basculerFiltre = (cle: keyof FiltresVentes): void => {
    envoyer({ type: 'filtres', filtres: { ...etat.filtres, [cle]: !etat.filtres[cle] } });
    setPage(1);
  };
  const basculerDetail = (numero: number): void => {
    const suivants = new Set(ouverts);
    if (suivants.has(numero)) suivants.delete(numero);
    else suivants.add(numero);
    setOuverts(suivants);
  };
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

      <FiltresTableauVentes
        filtres={etat.filtres}
        rayon={etat.rayon}
        piecesBien={piecesBien}
        dpeConnus={numerotees.some((v) => v.dpe != null)}
        avecDistances={numerotees.some((v) => v.distanceMetres !== null)}
        nombreAffichees={affichees.length}
        cleTri={tri.cle}
        croissant={tri.sens === 'croissant'}
        onFiltre={basculerFiltre}
        onRayon={(rayon) => {
          envoyer({ type: 'rayon', rayon });
          setPage(1);
        }}
      />
      {analyse.dpeVentes === 'indisponible' && (
        <Pastille ton="surveiller" compacte>
          {PHRASES_VENTES.dpeIndisponible}
        </Pastille>
      )}

      {affichees.length === 0 ? (
        <p className="m-0 text-[15px] text-encre-2">{PHRASES_VENTES.aucune}</p>
      ) : (
        // `relative` : les textes pour lecteurs d'écran (sr-only, en position absolue) restent dans le
        // conteneur qui défile au lieu d'élargir la page sur téléphone.
        <div ref={conteneur} className="relative overflow-x-auto">
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
                const cle = cleVente(v);
                return (
                  <LigneVente
                    key={v.numero}
                    vente={v}
                    avecDpe={avecDpe}
                    ouvert={ouverts.has(v.numero)}
                    selectionnee={etat.selection === cle}
                    surCarte={clesCarte.has(cle)}
                    nombreColonnes={nombreColonnes}
                    onDetail={() => {
                      basculerDetail(v.numero);
                    }}
                    onVoirCarte={() => {
                      envoyer({ type: 'voir', cle, dans: 'carte' });
                    }}
                  />
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
