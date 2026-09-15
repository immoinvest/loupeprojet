import { ETATS, recalerTravaux, type CodeCorrection, type EtatBien } from '@loupe/moteur';
import type { JSX, ReactNode } from 'react';

import { Carte, Pastille } from '@/composants/ui';
import { useProjetCourant } from '@/coque/ProjetLayout';
import { euros, pourcentageSigne } from '@/formatage/nombres';
import { useProjets } from '@/stockage/ProjetsContext';
import {
  eurosArrondis,
  libelleSemestre,
  LIBELLES_CONFIANCE,
  LIBELLES_CORRECTIONS,
  LIBELLES_ETATS,
  PHRASES_ESTIMATION,
  phraseEstimation,
  raisonCorrection,
  SOURCES_CORRECTIONS,
  TON_CONFIANCE,
} from '@/textes/estimation';
import { phraseTravauxEtat } from '@/textes/travaux';

const CELLULE = 'border-b border-bordure-douce px-3 py-2 text-left align-top';

/**
 * Le prix estimé du bien : fourchette selon l'état, corrections sourcées une à une (désactivables),
 * confiance. Calculé par le moteur à chaque modification, sans réseau. `repere` : le repère de prix qui fait
 * l'estimation (celui du projet, ou celui de l'adresse analysée), fourni par l'onglet (fiche 14).
 */
export function CarteEstimation({ repere }: { repere: ReactNode }): JSX.Element {
  const { enregistre, resultats } = useProjetCourant();
  const { mettreAJour } = useProjets();
  const { projet } = enregistre;
  const e = resultats.estimation;

  if (e === null) {
    return (
      <Carte>
        <h2 className="m-0 font-display text-[22px] font-semibold">L'estimation du bien</h2>
        <p className="m-0 text-[15px] text-encre-2">{PHRASES_ESTIMATION.sansVentes}</p>
        {repere}
      </Carte>
    );
  }

  // Les travaux qui suivent l'estimation suivent aussi l'état choisi ici.
  const choisirEtat = (etat: EtatBien): void => {
    mettreAJour(
      enregistre.id,
      recalerTravaux({
        ...projet,
        bien: { ...projet.bien, etat },
        provenance: { ...projet.provenance, 'bien.etat': 'utilisateur' },
      }),
    );
  };
  const travauxEtat = e.etatSuppose ? null : phraseTravauxEtat(resultats.travaux);

  const basculer = (code: CodeCorrection): void => {
    const ignorees = projet.estimation.correctionsIgnorees;
    mettreAJour(enregistre.id, {
      ...projet,
      estimation: {
        correctionsIgnorees: ignorees.includes(code)
          ? ignorees.filter((c) => c !== code)
          : [...ignorees, code],
      },
    });
  };

  return (
    <Carte className="border-accent-bordure bg-accent-fond">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="m-0 font-display text-[22px] font-semibold">L'estimation du bien</h2>
        <Pastille ton={TON_CONFIANCE[e.confiance.niveau]} compacte>
          {LIBELLES_CONFIANCE[e.confiance.niveau]}
        </Pastille>
      </div>
      <p
        className="m-0 font-display text-[32px] leading-none font-bold sm:text-[40px] print:text-[40px]"
        aria-label="Prix estimé"
      >
        {eurosArrondis(e.centre)}
      </p>
      <p className="m-0 text-[17px]">{phraseEstimation(e)}</p>
      {e.etatSuppose && (
        <p className="m-0 text-sm text-encre-2">{PHRASES_ESTIMATION.etatSuppose}</p>
      )}

      {repere}

      <div role="group" aria-label="État du bien" className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {ETATS.map((etat) => {
          const choisi = !e.etatSuppose && e.etat === etat;
          return (
            <button
              key={etat}
              type="button"
              aria-pressed={choisi}
              onClick={() => {
                choisirEtat(etat);
              }}
              className={`flex min-h-[64px] flex-col items-start justify-center rounded-encart border px-3 py-2 text-left ${
                choisi ? 'border-accent bg-surface' : 'border-bordure bg-surface/60 survol-fond'
              }`}
            >
              <span className="text-sm font-semibold text-encre-2">{LIBELLES_ETATS[etat]}</span>
              <span className="font-display text-lg font-bold">
                {eurosArrondis(e.selonEtat[etat])}
              </span>
            </button>
          );
        })}
      </div>
      {travauxEtat !== null && <p className="m-0 text-sm text-encre-2">{travauxEtat}</p>}

      {e.corrections.length === 0 ? (
        <p className="m-0 text-sm text-encre-2">{PHRASES_ESTIMATION.aucuneCorrection}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[15px]">
            <caption className="text-left text-sm font-semibold text-encre-2">
              Prix de marché {euros(e.prixM2Marche)}/m², puis les corrections
            </caption>
            <tbody>
              {e.corrections.map((c) => (
                <tr key={c.code} className={c.ignoree ? 'opacity-60' : ''}>
                  <th scope="row" className={`${CELLULE} font-semibold`}>
                    {LIBELLES_CORRECTIONS[c.code]}
                    <span className="block text-sm font-normal text-encre-2">
                      {raisonCorrection(c, projet.bien, e)}
                    </span>
                    <span className="block text-xs font-normal text-encre-3">
                      Source : {SOURCES_CORRECTIONS[c.code]}
                    </span>
                  </th>
                  <td className={CELLULE}>{pourcentageSigne(c.taux, 1)}</td>
                  <td className={CELLULE}>{euros(c.montant)}</td>
                  <td className={CELLULE}>
                    <label className="-mx-1.5 inline-flex items-center gap-2 rounded-encart px-1.5 text-sm survol-fond pointer-coarse:min-h-11">
                      <input
                        type="checkbox"
                        checked={!c.ignoree}
                        onChange={() => {
                          basculer(c.code);
                        }}
                      />
                      <span>Compter</span>
                      <span className="sr-only">{LIBELLES_CORRECTIONS[c.code]}</span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="m-0 text-xs text-encre-3">
        {e.actualiseAu === null
          ? PHRASES_ESTIMATION.prixDesActes
          : `Ventes ramenées au ${libelleSemestre(e.actualiseAu)}.`}{' '}
        {PHRASES_ESTIMATION.limites}
      </p>
    </Carte>
  );
}
