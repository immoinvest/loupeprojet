import type { BilanArgent, EtatGestion } from '@loupe/gestion';
import type { JSX } from 'react';
import { Link } from 'react-router';

import { Carte, TitreCarte } from '@/composants/ui';
import { dateEnLettres, montant } from '@/gestion/format';
import { lienDepense, lienFicheBien } from '@/gestion/parcours';
import {
  CATEGORIES_TEXTE,
  montantDuBien,
  montantSigne,
  recurrenceEnLettres,
  TEXTES_ARGENT as T,
} from '@/textes/gerer-argent';

type LigneBien = BilanArgent['parBien'][number];

const CLASSE_MONTANT_LIE =
  'inline-flex items-center justify-end text-encre no-underline survol-texte pointer-coarse:min-h-11 pointer-coarse:min-w-11';

const COLONNES: readonly { readonly libelle: string; readonly valeur: (l: LigneBien) => string }[] =
  [
    { libelle: T.loyers, valeur: (l) => montant(l.loyers) },
    { libelle: T.depenses, valeur: (l) => montant(l.depenses) },
    { libelle: T.mensualites, valeur: (l) => montant(l.mensualites) },
    { libelle: T.cashflow, valeur: (l) => montantSigne(l.cashflow) },
  ];

/** « Par bien » : chaque montant d'un bien mène à sa fiche (nom accessible complet). */
export function ParBien({
  bilan,
  gestion,
}: {
  readonly bilan: BilanArgent;
  readonly gestion: EtatGestion;
}): JSX.Element {
  return (
    <Carte>
      <TitreCarte>{T.parBien}</TitreCarte>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm tabular-nums">
          <thead>
            <tr className="text-left text-xs text-encre-3">
              <th scope="col" className="py-2 pr-3 font-semibold">
                {T.bien}
              </th>
              {COLONNES.map((c) => (
                <th key={c.libelle} scope="col" className="py-2 pl-3 text-right font-semibold">
                  {c.libelle}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bilan.parBien.map((ligne) => {
              const nom = gestion.biens.find((b) => b.id === ligne.bienId)?.nom ?? '';
              const fiche = lienFicheBien(ligne.bienId);
              return (
                <tr key={ligne.bienId} className="border-t border-bordure-douce">
                  <th scope="row" className="py-1 pr-3 text-left font-bold">
                    <Link to={fiche} className={`${CLASSE_MONTANT_LIE} justify-start`}>
                      {nom}
                    </Link>
                  </th>
                  {COLONNES.map((c) => (
                    <td key={c.libelle} className="py-1 pl-3 text-right">
                      <Link
                        to={fiche}
                        aria-label={montantDuBien(c.libelle, nom, c.valeur(ligne))}
                        className={CLASSE_MONTANT_LIE}
                      >
                        {c.valeur(ligne)}
                      </Link>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Carte>
  );
}

/** « Les dépenses de la période » : le nom ouvre « Modifier », le bien ouvre sa fiche. */
export function DepensesDeLaPeriode({
  bilan,
  gestion,
  ici,
}: {
  readonly bilan: BilanArgent;
  readonly gestion: EtatGestion;
  readonly ici: string;
}): JSX.Element {
  return (
    <Carte>
      <TitreCarte>{T.depensesDeLaPeriode}</TitreCarte>
      {bilan.occurrences.length === 0 ? (
        <p className="m-0 text-encre-2">{T.aucuneDepense}</p>
      ) : (
        <ul aria-label={T.depensesDeLaPeriode} className="m-0 flex list-none flex-col p-0">
          {bilan.occurrences.map(({ depense, date }) => {
            const bien = gestion.biens.find((b) => b.id === depense.bienId);
            const recurrence = recurrenceEnLettres(depense);
            return (
              <li
                key={`${depense.id}-${date}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-bordure-douce py-2 first:border-t-0"
              >
                <div className="flex min-w-0 flex-1 basis-56 flex-col">
                  <Link
                    to={lienDepense(depense.id, ici)}
                    className="inline-flex min-w-0 items-center font-bold text-encre no-underline survol-texte pointer-coarse:min-h-11"
                  >
                    {depense.libelle ?? CATEGORIES_TEXTE[depense.categorie]}
                  </Link>
                  <small className="text-sm text-encre-3">
                    {[dateEnLettres(date), CATEGORIES_TEXTE[depense.categorie], recurrence]
                      .filter((t) => t !== '')
                      .join(' · ')}
                  </small>
                </div>
                {bien === undefined ? (
                  <small className="text-sm text-encre-3">{T.commune}</small>
                ) : (
                  <Link
                    to={lienFicheBien(bien.id)}
                    className="inline-flex items-center text-sm text-encre-2 survol-texte pointer-coarse:min-h-11"
                  >
                    {bien.nom}
                  </Link>
                )}
                <b className="tabular-nums">{montant(depense.montant)}</b>
              </li>
            );
          })}
        </ul>
      )}
    </Carte>
  );
}
