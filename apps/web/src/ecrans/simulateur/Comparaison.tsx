import {
  CODES_CRITERES,
  offresIdentiques,
  type ComparaisonOffres,
  type OffrePret,
} from '@loupe/moteur';
import type { JSX } from 'react';

import { Carte, Pastille, TitreCarte } from '@/composants/ui';
import {
  LIBELLES_CRITERES,
  PHRASES_SIMULATEUR as PHRASES,
  TITRES_SIMULATEUR,
  criteresParCode,
  formaterCritere,
  formaterEcart,
  phraseSynthese,
} from '@/textes/simulateur';

const CELLULE = 'px-3 py-2.5 align-top whitespace-nowrap';

/** Le tableau critère / A / B / écart, la meilleure valeur en avant, et la phrase de synthèse. */
export function Comparaison({
  comparaison,
  noms,
  offres,
}: {
  comparaison: ComparaisonOffres;
  noms: readonly [string, string];
  offres: readonly [OffrePret, OffrePret];
}): JSX.Element {
  const criteres = criteresParCode(comparaison);
  const identiques = offresIdentiques(comparaison);
  const dureesDifferentes = offres[0].dureeAnnees !== offres[1].dureeAnnees;

  return (
    <Carte>
      <TitreCarte>{TITRES_SIMULATEUR.comparaison}</TitreCarte>
      <p className="m-0 text-[17px] font-semibold">{phraseSynthese(comparaison, noms)}</p>
      {dureesDifferentes && <p className="m-0 text-sm text-encre-2">{PHRASES.dureesDifferentes}</p>}
      <div className="relative overflow-x-auto">
        <table className="w-full border-collapse text-[15px]">
          <caption className="sr-only">Comparaison des deux offres, critère par critère</caption>
          <thead>
            <tr className="border-b border-bordure text-left text-xs text-encre-3">
              <th scope="col" className={`${CELLULE} font-semibold`}>
                Critère
              </th>
              <th scope="col" className={`${CELLULE} font-semibold`}>
                {noms[0]}
              </th>
              <th scope="col" className={`${CELLULE} font-semibold`}>
                {noms[1]}
              </th>
              <th scope="col" className={`${CELLULE} font-semibold`}>
                Écart (A − B)
              </th>
            </tr>
          </thead>
          <tbody>
            {CODES_CRITERES.map((code) => {
              const c = criteres[code];
              return (
                <tr key={code} className="border-b border-bordure-douce last:border-b-0">
                  <th scope="row" className={`${CELLULE} text-left font-semibold`}>
                    {LIBELLES_CRITERES[code]}
                  </th>
                  {(['a', 'b'] as const).map((cote) => {
                    const meilleure = !identiques && c.meilleure === cote;
                    return (
                      <td
                        key={cote}
                        className={`${CELLULE} ${meilleure ? 'font-bold text-bon-texte' : ''}`}
                      >
                        <span className="inline-flex items-center gap-2">
                          {formaterCritere(code, c[cote])}
                          {meilleure && (
                            <Pastille ton="bon" compacte>
                              {PHRASES.meilleure}
                            </Pastille>
                          )}
                        </span>
                      </td>
                    );
                  })}
                  <td className={`${CELLULE} text-encre-2`}>{formaterEcart(code, c.ecart)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Carte>
  );
}
