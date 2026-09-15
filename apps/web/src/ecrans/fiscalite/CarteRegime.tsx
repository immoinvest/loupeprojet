import type { ResultatRegime } from '@loupe/moteur';
import type { JSX } from 'react';

import { Bouton, Carte, Pastille } from '@/composants/ui';
import { euros, eurosSignes } from '@/formatage/nombres';
import {
  REGIMES,
  anneeRepriseDeficit,
  avertissementRepriseDeficit,
  explicationRegime,
} from '@/textes/regimes';

function Ligne({
  libelle,
  valeur,
  fort = false,
}: {
  libelle: string;
  valeur: string;
  fort?: boolean;
}): JSX.Element {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 ${fort ? 'border-t border-bordure-douce pt-1.5 font-bold' : ''}`}
    >
      <dt className={fort ? 'text-encre' : 'text-encre-2'}>{libelle}</dt>
      <dd className="m-0 shrink-0 tabular-nums">{valeur}</dd>
    </div>
  );
}

/** Un régime : l'impôt pendant la location, à la revente, au total, et ce qu'il laisse. */
export function CarteRegime({
  r,
  annees,
  retenu,
  meilleurCashflow,
  meilleurTotal,
  impotAmortissements,
  onRetenir,
}: {
  r: ResultatRegime;
  annees: number;
  retenu: boolean;
  meilleurCashflow: boolean;
  meilleurTotal: boolean;
  /** Impôt à la revente dû aux amortissements réintégrés : meublé au réel seulement, 0 sinon. */
  impotAmortissements: number;
  onRetenir: () => void;
}): JSX.Element {
  const reprise = anneeRepriseDeficit(r, annees);
  return (
    <Carte className={retenu ? 'border-accent bg-accent-fond' : ''}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="m-0 font-display text-lg font-semibold">{REGIMES[r.regime]}</h2>
        {retenu && (
          <Pastille ton="accent" compacte>
            retenu
          </Pastille>
        )}
        {meilleurTotal && r.eligible && (
          <Pastille ton="bon" compacte>
            le plus avantageux au total
          </Pastille>
        )}
        {meilleurCashflow && r.eligible && (
          <Pastille ton="neutre" compacte>
            meilleur cash-flow
          </Pastille>
        )}
        {!r.eligible && (
          <Pastille ton="probleme" compacte>
            plafond dépassé
          </Pastille>
        )}
      </div>
      <div className="font-display text-[28px] leading-none font-bold sm:text-[32px] print:text-[32px]">
        {euros(r.impotGlobal)}
        <span className="ml-2 text-base font-semibold text-encre-3">d'impôt au total</span>
      </div>
      <dl className="m-0 flex flex-col gap-1 text-[15px]">
        <Ligne libelle={`Pendant ${String(annees)} ans`} valeur={euros(r.impotTotal)} />
        <Ligne libelle="À la revente" valeur={euros(r.impotRevente)} />
        {impotAmortissements > 0 && (
          <p className="m-0 text-[13px] text-encre-3">
            dont {euros(impotAmortissements)} dus aux amortissements réintégrés
          </p>
        )}
        <Ligne libelle="Impôt total" valeur={euros(r.impotGlobal)} fort />
      </dl>
      <p className="m-0 text-sm text-encre-2">
        Cash-flow après impôt cumulé : <strong>{eurosSignes(r.cashflowApresImpotTotal)}</strong>
        <br />
        Ce qu'il vous reste au total, vente nette comprise :{' '}
        <strong>{eurosSignes(r.enrichissementFinal)}</strong>
      </p>
      {reprise !== null && (
        <p className="m-0 rounded-[8px] bg-surveiller-fond px-3 py-2 text-[13px] leading-snug text-surveiller-texte">
          {avertissementRepriseDeficit(reprise)}
        </p>
      )}
      <p className="m-0 border-t border-bordure-douce pt-2 text-[13px] leading-snug text-encre-2">
        {explicationRegime(r, annees, impotAmortissements)}
      </p>
      {!retenu && r.eligible && <Bouton onClick={onRetenir}>Retenir ce régime</Bouton>}
    </Carte>
  );
}
