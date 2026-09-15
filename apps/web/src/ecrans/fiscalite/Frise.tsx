import type { AnneeFiscale } from '@loupe/moteur';
import type { JSX } from 'react';

import { euros } from '@/formatage/nombres';

const IMPOSEE = 'border-surveiller/50 bg-surveiller-fond';
const LIBRE = 'border-bon/40 bg-bon-fond';

/** Une case par année de location, puis une case « revente ». */
export function Frise({
  annees,
  impotRevente,
}: {
  annees: readonly AnneeFiscale[];
  impotRevente: number;
}): JSX.Element {
  const imposees = annees.filter((a) => a.impot > 0).length;
  const revente = impotRevente > 0 ? 'puis impôt à la revente' : 'sans impôt à la revente';
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${String(annees.length)}, minmax(0, 1fr)) 2fr` }}
        role="img"
        aria-label={`${String(imposees)} années imposées sur ${String(annees.length)}, ${revente}`}
      >
        {annees.map((a) => (
          <div
            key={a.annee}
            title={`Année ${String(a.annee)} : ${euros(a.impot)}`}
            className={`h-6 rounded-[4px] border ${a.impot > 0 ? IMPOSEE : LIBRE}`}
          />
        ))}
        <div
          title={`Revente : ${euros(impotRevente)}`}
          className={`ml-1 h-6 rounded-[4px] border border-dashed ${impotRevente > 0 ? IMPOSEE : LIBRE}`}
        />
      </div>
      <div className="flex justify-between text-[11px] text-encre-3">
        <span>année 1</span>
        <span>année {annees.length}</span>
        <span>revente</span>
      </div>
    </div>
  );
}
