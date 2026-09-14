import type { AnneeCredit, LigneAmortissement, OffrePret, ResultatPret } from '@loupe/moteur';
import { Fragment, useState, type JSX } from 'react';

import { useModeDocument } from '@/composants/document';
import { Bouton, Carte, TitreCarte } from '@/composants/ui';
import { euros, eurosCentimes, pourcentage } from '@/formatage/nombres';
import { LIBELLES_PHASES, csvAmortissement, nomFichierCsv } from '@/simulateur';
import {
  BOUTONS_SIMULATEUR as B,
  PHRASES_SIMULATEUR as PHRASES,
  TITRES_SIMULATEUR,
} from '@/textes/simulateur';

import { telechargerTexte } from './telecharger';

export interface OngletOffre {
  readonly nom: string;
  readonly offre: OffrePret;
  readonly resultat: ResultatPret;
}

const CELLULE = 'px-2 py-2 align-top whitespace-nowrap text-right';
const ENTETE = `${CELLULE} text-xs font-semibold text-encre-3`;

function TableauMois({
  annee,
  lignes,
}: {
  annee: number;
  lignes: readonly LigneAmortissement[];
}): JSX.Element {
  return (
    <table className="w-full border-collapse bg-accent-fond text-sm">
      <caption className="sr-only">Mois de l'année {annee}</caption>
      <thead>
        <tr>
          {[
            'Mois',
            'Phase',
            'Reste dû début',
            'Intérêts',
            'Capital',
            'Mensualité hors assurance',
            'Assurance',
            'Mensualité totale',
            'Reste dû fin',
          ].map((t) => (
            <th key={t} scope="col" className={`${ENTETE} ${t === 'Phase' ? 'text-left' : ''}`}>
              {t}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lignes.map((l) => (
          <tr key={l.mois} className="border-t border-bordure-douce">
            <th scope="row" className={`${CELLULE} font-semibold`}>
              {l.mois}
            </th>
            <td className={`${CELLULE} text-left`}>{LIBELLES_PHASES[l.phase]}</td>
            <td className={CELLULE}>{eurosCentimes(l.crdDebut)}</td>
            <td className={CELLULE}>{eurosCentimes(l.interets)}</td>
            <td className={CELLULE}>{eurosCentimes(l.capital)}</td>
            <td className={CELLULE}>{eurosCentimes(l.mensualite)}</td>
            <td className={CELLULE}>{eurosCentimes(l.assurance)}</td>
            <td className={CELLULE}>{eurosCentimes(l.mensualite + l.assurance)}</td>
            <td className={CELLULE}>{eurosCentimes(l.crdFin)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LigneAnnee({
  a,
  tableau,
  ouverte,
  onBasculer,
}: {
  a: AnneeCredit;
  tableau: readonly LigneAmortissement[];
  ouverte: boolean;
  onBasculer: (() => void) | null;
}): JSX.Element {
  return (
    <Fragment>
      <tr className="border-t border-bordure-douce">
        <th scope="row" className={`${CELLULE} text-left font-semibold`}>
          {a.annee}
        </th>
        <td className={CELLULE}>{euros(a.interets)}</td>
        <td className={CELLULE}>{euros(a.capital)}</td>
        <td className={CELLULE}>{euros(a.mensualites)}</td>
        <td className={CELLULE}>{euros(a.assurance)}</td>
        <td className={CELLULE}>{euros(a.crdFin)}</td>
        {onBasculer !== null && (
          <td className={`${CELLULE} py-1`}>
            <button
              type="button"
              aria-expanded={ouverte}
              aria-label={`${ouverte ? B.masquerMois : B.voirMois} de l'année ${String(a.annee)}`}
              onClick={onBasculer}
              className="inline-flex min-h-9 items-center rounded-full border border-bordure px-3 text-xs font-semibold text-encre-2 survol-fond pointer-coarse:min-h-11"
            >
              {ouverte ? B.masquerMois : B.voirMois}
            </button>
          </td>
        )}
      </tr>
      {ouverte && (
        <tr>
          <td colSpan={7} className="p-0">
            <TableauMois annee={a.annee} lignes={tableau.filter((l) => l.annee === a.annee)} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function TableauAnnees({
  onglet,
  depliees,
  onBasculer,
}: {
  onglet: OngletOffre;
  depliees: ReadonlySet<number>;
  onBasculer: ((annee: number) => void) | null;
}): JSX.Element {
  const { nom, offre, resultat: r } = onglet;
  if (!r.aEmprunter) return <p className="m-0 text-[15px] text-encre-2">{PHRASES.pasDeTableau}</p>;
  const colonnes = [
    'Année',
    'Intérêts',
    'Capital remboursé',
    'Mensualités',
    'Assurance',
    'Reste à rembourser',
  ];
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full border-collapse text-[15px]">
        <caption className="pb-2 text-left text-sm font-semibold text-encre-2">
          Tableau d'amortissement, {nom}, {offre.dureeAnnees} ans à{' '}
          {pourcentage(offre.tauxNominal, 2)}
        </caption>
        <thead>
          <tr>
            {colonnes.map((c, i) => (
              <th key={c} scope="col" className={`${ENTETE} ${i === 0 ? 'text-left' : ''}`}>
                {c}
              </th>
            ))}
            {onBasculer !== null && (
              <th scope="col" className={ENTETE}>
                <span className="sr-only">Détail par mois</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {r.parAnnee.map((a) => (
            <LigneAnnee
              key={a.annee}
              a={a}
              tableau={r.tableau}
              ouverte={depliees.has(a.annee)}
              onBasculer={
                onBasculer === null
                  ? null
                  : () => {
                      onBasculer(a.annee);
                    }
              }
            />
          ))}
          <tr className="border-t border-bordure font-bold">
            <th scope="row" className={`${CELLULE} text-left`}>
              Total
            </th>
            <td className={CELLULE}>{euros(r.totalInterets)}</td>
            <td className={CELLULE}>{euros(r.parAnnee.reduce((acc, a) => acc + a.capital, 0))}</td>
            <td className={CELLULE}>
              {euros(r.parAnnee.reduce((acc, a) => acc + a.mensualites, 0))}
            </td>
            <td className={CELLULE}>{euros(r.totalAssurance)}</td>
            <td className={CELLULE}>{euros(0)}</td>
            {onBasculer !== null && <td className={CELLULE} />}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/**
 * Les tableaux d'amortissement : un onglet par offre, présentés par année, chaque année dépliable
 * en douze mois ; le CSV mensuel se télécharge. En mode document, toutes les offres se suivent,
 * années seulement.
 */
export function TableauxAmortissement({
  onglets,
}: {
  onglets: readonly OngletOffre[];
}): JSX.Element {
  const document = useModeDocument();
  const [actif, setActif] = useState(0);
  const [depliees, setDepliees] = useState<ReadonlySet<string>>(() => new Set());
  const index = Math.min(actif, onglets.length - 1);
  const courant = onglets[index];

  const basculer = (annee: number): void => {
    setDepliees((prev) => {
      const suivant = new Set(prev);
      const cle = `${String(index)}:${String(annee)}`;
      if (suivant.has(cle)) suivant.delete(cle);
      else suivant.add(cle);
      return suivant;
    });
  };
  const anneesDepliees = new Set(
    [...depliees]
      .filter((cle) => cle.startsWith(`${String(index)}:`))
      .map((cle) => Number(cle.split(':')[1])),
  );

  if (document) {
    return (
      <Carte>
        <TitreCarte>{TITRES_SIMULATEUR.tableaux}</TitreCarte>
        {onglets.map((o) => (
          <TableauAnnees key={o.nom} onglet={o} depliees={new Set()} onBasculer={null} />
        ))}
      </Carte>
    );
  }
  if (courant === undefined) return <Fragment />;

  return (
    <Carte>
      <TitreCarte
        action={
          courant.resultat.aEmprunter && (
            <Bouton
              onClick={() => {
                telechargerTexte(
                  nomFichierCsv(courant.offre),
                  csvAmortissement(courant.resultat),
                  'text/csv;charset=utf-8',
                );
              }}
            >
              {B.telecharger}
            </Bouton>
          )
        }
      >
        {TITRES_SIMULATEUR.tableaux}
      </TitreCarte>
      {onglets.length > 1 && (
        <div role="group" aria-label="Offre affichée" className="flex flex-wrap gap-2">
          {onglets.map((o, i) => (
            <button
              key={o.nom}
              type="button"
              aria-pressed={i === index}
              onClick={() => {
                setActif(i);
              }}
              className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold ${
                i === index
                  ? 'border-accent bg-accent-doux text-encre'
                  : 'border-bordure bg-surface text-encre-2 survol-fond'
              }`}
            >
              {o.nom}
            </button>
          ))}
        </div>
      )}
      <TableauAnnees onglet={courant} depliees={anneesDepliees} onBasculer={basculer} />
    </Carte>
  );
}
