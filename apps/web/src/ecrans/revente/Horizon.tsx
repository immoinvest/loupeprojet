import { obtenirRegles, type Regles, type VersionRegles } from '@loupe/moteur';
import { useMemo, type JSX } from 'react';

import {
  HORIZON_MAX,
  HORIZON_MIN,
  impositionPlusValue,
  seuilsExoneration,
  type VarianteRevente,
} from '@/analyses';
import { Curseur, type SeuilCurseur } from '@/composants/Curseur';
import { useModeDocument } from '@/composants/document';
import { Carte } from '@/composants/ui';
import { euros, eurosSignes, pourcentage } from '@/formatage/nombres';

/** Graduations de la piste ; les seuils fiscaux viennent des règles. */
const REPERES: readonly number[] = [5, 10, 15, 20, 25, 30];

const ans = (v: number): string => `${String(v)} ans`;
const dans = (v: number): string => `Dans ${String(v)} ans`;

/** Juste les décimales utiles : « 30 % », « 26,4 % », « 8,25 % ». */
function pct(taux: number): string {
  const centiemes = Math.round(taux * 10_000) / 100;
  if (Number.isInteger(centiemes)) return pourcentage(taux, 0);
  return pourcentage(taux, Number.isInteger(centiemes * 10) ? 1 : 2);
}

function seuilsCurseur(regles: Regles): readonly SeuilCurseur[] {
  const { ir, ps } = seuilsExoneration(regles, HORIZON_MAX);
  const seuils: SeuilCurseur[] = [];
  if (ir !== null) seuils.push({ valeur: ir, libelle: "plus d'impôt sur le revenu" });
  if (ps !== null) seuils.push({ valeur: ps, libelle: 'plus de prélèvements sociaux' });
  return seuils;
}

/** Le curseur d'horizon et, dessous, ce que la plus-value paierait cette année-là. */
export function CarteHorizon({
  horizon,
  versionRegles,
  onChangement,
  onValidation,
}: {
  horizon: number;
  versionRegles: VersionRegles;
  onChangement: (annees: number) => void;
  onValidation: (annees: number) => void;
}): JSX.Element {
  const regles = useMemo(() => obtenirRegles(versionRegles), [versionRegles]);
  const seuils = useMemo(() => seuilsCurseur(regles), [regles]);
  const imposition = impositionPlusValue(horizon, regles);

  return (
    <Carte>
      <Curseur
        libelle="Revente dans"
        valeur={horizon}
        min={HORIZON_MIN}
        max={HORIZON_MAX}
        formater={ans}
        texteValeur={dans}
        reperes={REPERES}
        seuils={seuils}
        onChangement={onChangement}
        onValidation={onValidation}
      />
      <p className="m-0 text-[15px] text-encre-2">
        Plus-value imposée à{' '}
        <span className="font-bold text-encre">{pourcentage(imposition.tauxGlobal)}</span> à{' '}
        {ans(horizon)} : impôt sur le revenu après {pct(imposition.abattementIr)} d'abattement,
        prélèvements sociaux après {pct(imposition.abattementPs)}, hors surtaxe.
      </p>
    </Carte>
  );
}

/** Les quatre horizons repères, en cartes compactes : la trajectoire d'un coup d'œil, et des raccourcis. */
export function BandeauHorizons({
  variantes,
  horizon,
  onChoix,
}: {
  variantes: readonly VarianteRevente[];
  horizon: number;
  onChoix: (annees: number) => void;
}): JSX.Element {
  const document = useModeDocument();
  return (
    <div
      className={`grid grid-cols-2 gap-3 ${document ? 'print:grid-cols-2' : 'xl:grid-cols-4'}`}
      role="group"
      aria-label="Horizons repères"
    >
      {variantes.map((v) => {
        const actif = v.annees === horizon;
        return (
          <button
            key={v.annees}
            type="button"
            aria-pressed={actif}
            disabled={document}
            onClick={() => {
              onChoix(v.annees);
            }}
            className={`flex min-h-11 flex-col gap-0.5 rounded-encart border px-3 py-2.5 text-left ${
              actif
                ? 'border-accent bg-accent-fond'
                : 'border-bordure bg-surface hover:bg-accent-fond'
            }`}
          >
            <span className="text-xs font-bold tracking-wide text-encre-3 uppercase">
              {dans(v.annees)}
            </span>
            <span className="font-display text-lg leading-tight font-bold">
              {euros(v.cashNetVendeur)}
            </span>
            <span className="text-xs text-encre-2">
              TRI {v.tri === null ? '—' : pourcentage(v.tri)} · {eurosSignes(v.enrichissement)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
