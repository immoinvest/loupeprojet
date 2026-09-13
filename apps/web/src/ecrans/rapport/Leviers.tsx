import type { Resultats } from '@loupe/moteur';
import type { JSX } from 'react';

import { useModeDocument } from '@/composants/document';
import { Carte } from '@/composants/ui';
import { euros, eurosParMois, pourcentage } from '@/formatage/nombres';
import { SCENARIOS } from '@/textes/regimes';

/** Les leviers du rapport : négocier le prix, passer en colocation, et les scénarios « et si ». */
export function Leviers({ r }: { r: Resultats }): JSX.Element | null {
  // Sur papier (ou en noir et blanc), la carte pleine d'encre devient une carte claire.
  const document = useModeDocument();
  const s = r.scenarios;
  if (s === null) return null;
  const negocier = s.scenarios.find((x) => x.code === 'negocier');
  const coloc = s.scenarios.find((x) => x.code === 'colocation');
  const autres = s.scenarios.filter((x) => x.code !== 'negocier' && x.code !== 'colocation');
  // Filets horizontaux quand les leviers s'empilent (téléphone), verticaux côte à côte.
  const separateur = `h-px md:h-auto md:w-px print:h-auto print:w-px ${
    document ? 'bg-bordure' : 'bg-white/25'
  }`;
  return (
    <Carte
      className={`md:flex-row md:items-stretch md:gap-5 print:flex-row print:items-stretch print:gap-5 ${
        document ? 'border-accent-bordure bg-accent-fond' : 'border-accent bg-accent text-white'
      }`}
    >
      {negocier !== undefined && (
        <div className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs font-bold tracking-wide uppercase opacity-80">
            Levier 1 · Négocier
          </span>
          <span className="font-display text-[28px] font-bold sm:text-[32px] print:text-[32px]">
            {euros(Number(negocier.parametres.prix ?? 0))}
          </span>
          <span className="text-sm leading-snug opacity-90">
            Cash-flow {eurosParMois(negocier.indicateurs.cashflowMensuel)}
            {negocier.indicateurs.tri !== null
              ? `, rendement de votre argent ${pourcentage(negocier.indicateurs.tri)}`
              : ''}
            .
          </span>
        </div>
      )}
      <div className={separateur} />
      {coloc !== undefined && (
        <div className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs font-bold tracking-wide uppercase opacity-80">
            Levier 2 · Colocation
          </span>
          <span className="font-display text-[28px] font-bold sm:text-[32px] print:text-[32px]">
            {eurosParMois(coloc.indicateurs.cashflowMensuel)}
          </span>
          <span className="text-sm leading-snug opacity-90">
            {String(coloc.parametres.chambres ?? '')} chambres à{' '}
            {euros(Number(coloc.parametres.loyerParChambre ?? 0))}
            {coloc.indicateurs.tri !== null
              ? `, rendement ${pourcentage(coloc.indicateurs.tri)}`
              : ''}
            . Plus de gestion.
          </span>
        </div>
      )}
      <div className={separateur} />
      <div className="flex flex-1 flex-col gap-1.5">
        <span className="text-xs font-bold tracking-wide uppercase opacity-80">Et si…</span>
        <div className="flex flex-col gap-1 text-sm">
          {autres.map((x) => (
            <div key={x.code} className="flex justify-between gap-3">
              <span className="opacity-85">{SCENARIOS[x.code]}</span>
              <span>{eurosParMois(x.indicateurs.cashflowMensuel)}</span>
            </div>
          ))}
        </div>
      </div>
    </Carte>
  );
}
