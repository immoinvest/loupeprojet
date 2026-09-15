import type { EstimationTravaux, ProjetEntree } from '@loupe/moteur';
import type { JSX } from 'react';

import { useModeDocument } from '@/composants/document';
import { Bouton } from '@/composants/ui';
import { euros } from '@/formatage/nombres';
import { CHEMIN_CHOIX_TRAVAUX, type Descripteur } from '@/hypotheses';
import {
  LIBELLES_CHOIX_TRAVAUX,
  MENTION_TRAVAUX,
  PHRASES_TRAVAUX,
  fourchetteTravaux,
  libelleLigneTravaux,
} from '@/textes/travaux';

/** Pseudo-champ des tuiles : `appliquerSaisie` recalcule les travaux selon le choix. */
const CHOIX: Descripteur = { chemin: CHEMIN_CHOIX_TRAVAUX, libelle: 'Travaux', type: 'enum' };
const ORDRE = ['bas', 'estime', 'haut'] as const;

/**
 * Les travaux estimés selon l'état : détail du calcul, fourchette, tuiles Bas · Estimé · Haut et
 * « Revenir à l'estimation » quand le montant a été saisi. Rien d'autre qu'une phrase sans état connu.
 */
export function TravauxEstimes({
  projet,
  estimation,
  changer,
}: {
  projet: ProjetEntree;
  estimation: EstimationTravaux | null;
  changer: (d: Descripteur, texte: string) => void;
}): JSX.Element {
  const document = useModeDocument();
  if (estimation === null) {
    return <p className="m-0 text-sm text-encre-2">{PHRASES_TRAVAUX.sansEtat}</p>;
  }
  const choix = projet.hypotheses.achat.travauxChoix;
  const suitEstimation = choix !== undefined && choix !== 'saisi';

  return (
    <div
      role="group"
      aria-label="Travaux estimés"
      className="flex flex-col gap-2 rounded-encart border border-bordure p-2 sm:p-3"
    >
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[15px]">
        {estimation.lignes.map((l) => (
          <li key={l.code} className="flex flex-wrap justify-between gap-x-4">
            <span>{libelleLigneTravaux(l, estimation)}</span>
            <span className="font-semibold">{euros(l.montant.estime)}</span>
          </li>
        ))}
      </ul>
      <p className="m-0 text-[15px] font-semibold">
        Estimé {euros(estimation.estime)} · {fourchetteTravaux(estimation).toLowerCase()}
      </p>
      {!document && (
        <div className="grid grid-cols-3 gap-2">
          {ORDRE.map((cle) => {
            const choisi = choix === cle;
            return (
              <button
                key={cle}
                type="button"
                aria-pressed={choisi}
                onClick={() => {
                  changer(CHOIX, cle);
                }}
                className={`flex min-h-[56px] flex-col items-start justify-center rounded-encart border px-3 py-2 text-left ${
                  choisi ? 'border-accent bg-accent-fond' : 'border-bordure bg-surface survol-fond'
                }`}
              >
                <span className="text-sm font-semibold text-encre-2">
                  {LIBELLES_CHOIX_TRAVAUX[cle]}
                </span>
                <span className="font-display text-base font-bold">{euros(estimation[cle])}</span>
              </button>
            );
          })}
        </div>
      )}
      {!suitEstimation && (
        <div className="flex flex-wrap items-center gap-2">
          {choix === 'saisi' && (
            <span className="text-sm text-encre-2">{PHRASES_TRAVAUX.saisi}</span>
          )}
          <Bouton
            onClick={() => {
              changer(CHOIX, 'estime');
            }}
          >
            {PHRASES_TRAVAUX.revenir}
          </Bouton>
        </div>
      )}
      <p className="m-0 text-xs text-encre-3">
        {MENTION_TRAVAUX} {PHRASES_TRAVAUX.source}
        {(estimation.etat === 'a_renover' || estimation.etat === 'a_rafraichir') &&
          ` ${PHRASES_TRAVAUX.prixEtTravaux}`}
      </p>
    </div>
  );
}
