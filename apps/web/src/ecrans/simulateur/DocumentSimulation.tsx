import type { OffrePret, Regles } from '@loupe/moteur';
import type { JSX } from 'react';

import { ModeDocument } from '@/composants/document';
import { MARGES_LATERALES } from '@/composants/mise-en-page';
import { Carte, TitreCarte } from '@/composants/ui';
import { dateCourte } from '@/formatage/nombres';
import { LogotypeDeklic } from '@/marque/Logo';
import { CHAMPS_OFFRE, CHAMPS_PROJET, type Calcul } from '@/simulateur';
import { PHRASES_SIMULATEUR, TITRES_SIMULATEUR, formaterValeur } from '@/textes/simulateur';

import { Comparaison } from './Comparaison';
import { Explications } from './Explications';
import { ResultatOffre } from './ResultatOffre';
import { TableauxAmortissement, type OngletOffre } from './TableauxAmortissement';

const CELLULE = 'py-1.5 pr-4 align-top text-[15px]';

function Hypotheses({ calcul }: { calcul: Calcul }): JSX.Element {
  const { projet, offres } = calcul.conversion;
  const presentes = offres.filter((o): o is OffrePret => o !== null);
  return (
    <Carte>
      <TitreCarte>{TITRES_SIMULATEUR.parametres}</TitreCarte>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr] print:grid-cols-[auto_1fr]">
        {/* Les tableaux défilent au doigt sur téléphone plutôt que de pousser la page. */}
        <div className="relative min-w-0 self-start overflow-x-auto">
          <table className="border-collapse">
            <caption className="pb-1 text-left text-xs font-bold tracking-wider text-encre-3 uppercase">
              {TITRES_SIMULATEUR.projet}
            </caption>
            <tbody>
              {projet !== null &&
                CHAMPS_PROJET.map((d) => (
                  <tr key={d.chemin}>
                    <th scope="row" className={`${CELLULE} text-left font-normal text-encre-2`}>
                      {d.libelle}
                    </th>
                    <td className={`${CELLULE} font-semibold whitespace-nowrap`}>
                      {formaterValeur(d, projet[d.chemin])}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="relative min-w-0 self-start overflow-x-auto">
          <table className="border-collapse">
            <caption className="pb-1 text-left text-xs font-bold tracking-wider text-encre-3 uppercase">
              Les offres
            </caption>
            <thead>
              <tr>
                <td />
                {presentes.map((o, i) => (
                  <th key={o.nom} scope="col" className={`${CELLULE} text-left`}>
                    {calcul.noms[i === 0 ? 0 : 1]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CHAMPS_OFFRE.filter((d) => d.chemin !== 'nom').map((d) => (
                <tr key={d.chemin}>
                  <th scope="row" className={`${CELLULE} text-left font-normal text-encre-2`}>
                    {d.libelle}
                  </th>
                  {presentes.map((o) => (
                    <td key={o.nom} className={`${CELLULE} font-semibold whitespace-nowrap`}>
                      {formaterValeur(d, o[d.chemin])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Carte>
  );
}

/**
 * La simulation en un document : en-tête, hypothèses, résultats, comparaison, tableaux annuels
 * (les mois vont dans le CSV), pied. Rendu en mode document : lecture seule, explications visibles.
 */
export function DocumentSimulation({
  calcul,
  regles,
  date,
}: {
  calcul: Calcul;
  regles: Regles;
  date?: string;
}): JSX.Element {
  const jour = dateCourte(date ?? new Date().toISOString());
  const { offres } = calcul.conversion;
  const onglets: OngletOffre[] = [];
  calcul.resultats.forEach((r, i) => {
    const offre = offres[i];
    if (r !== null && offre !== undefined && offre !== null) {
      onglets.push({ nom: calcul.noms[i === 0 ? 0 : 1], offre, resultat: r });
    }
  });
  const [a, b] = offres;

  return (
    <ModeDocument>
      <div className="document">
        <header
          className={`flex flex-col gap-3 border-b border-bordure pt-6 pb-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:pt-8 print:flex-row print:items-end print:justify-between print:gap-6 print:pt-8 ${MARGES_LATERALES}`}
        >
          <div className="flex flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2 font-display text-sm font-bold text-encre-3">
              <LogotypeDeklic hauteur={20} />· {TITRES_SIMULATEUR.document.toLowerCase()}
            </span>
            <h1 className="m-0 font-display text-2xl leading-tight font-bold sm:text-[28px] print:text-[28px]">
              {TITRES_SIMULATEUR.document}
            </h1>
            <span className="text-[15px] text-encre-2">
              {calcul.noms[0]}
              {calcul.saisie.offres[1] !== null && ` et ${calcul.noms[1]}`}
            </span>
          </div>
          <dl className="m-0 flex flex-col gap-0.5 text-[13px] text-encre-3 sm:text-right print:text-right">
            <div>
              <dt className="inline">Imprimé le </dt>
              <dd className="inline font-semibold text-encre-2">{jour}</dd>
            </div>
            <div>
              <dt className="inline">Règles </dt>
              <dd className="inline font-semibold text-encre-2">
                {regles.version} ({dateCourte(regles.dateReference)})
              </dd>
            </div>
          </dl>
        </header>

        <div className={`flex flex-col gap-5 py-6 ${MARGES_LATERALES}`}>
          <Hypotheses calcul={calcul} />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 print:grid-cols-2">
            <ResultatOffre
              nom={calcul.noms[0]}
              offre={a}
              resultat={calcul.resultats[0]}
              regles={regles}
            />
            {calcul.saisie.offres[1] !== null && (
              <ResultatOffre
                nom={calcul.noms[1]}
                offre={b}
                resultat={calcul.resultats[1]}
                regles={regles}
              />
            )}
          </div>
          <Explications />
          {calcul.comparaison !== null && a !== null && b !== null && (
            <Comparaison comparaison={calcul.comparaison} noms={calcul.noms} offres={[a, b]} />
          )}
          {onglets.length > 0 && <TableauxAmortissement onglets={onglets} />}
        </div>

        <footer
          className={`flex flex-col gap-1 border-t border-bordure py-5 text-xs text-encre-3 ${MARGES_LATERALES}`}
        >
          <span>
            {PHRASES_SIMULATEUR.pied} Règles connues au {dateCourte(regles.dateReference)} (version{' '}
            {regles.version}).
          </span>
        </footer>
      </div>
    </ModeDocument>
  );
}
