import type { Feu, ResultatsComplets } from '@loupe/moteur';
import type { JSX, ReactNode } from 'react';

import { useModeDocument } from '@/composants/document';
import { Info } from '@/composants/info';
import { Carte, TitreCarte } from '@/composants/ui';
import { pourcentage } from '@/formatage/nombres';
import { explicationRendement } from '@/textes/explications';

const TONS_FEU: Readonly<Record<Feu, string>> = {
  bon: 'text-bon',
  surveiller: 'text-surveiller-texte',
  probleme: 'text-probleme',
  inconnu: '',
};

function Rendement({
  libelle,
  info,
  valeur,
  precision,
  ton = '',
}: {
  libelle: string;
  info: ReactNode;
  valeur: string;
  precision: string;
  ton?: string;
}): JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <div className="flex items-center gap-0.5 text-[13px] font-bold text-encre-3">
        <span>{libelle}</span>
        {info}
      </div>
      <span
        className={`font-display text-[26px] leading-tight font-bold sm:text-[30px] print:text-[30px] ${ton}`}
      >
        {valeur}
      </span>
      <span className="text-xs text-encre-3">{precision}</span>
    </div>
  );
}

/** Brut, net et net-net côte à côte, chacun avec sa définition et sa formule chiffrée. */
export function CarteRendements({ r }: { r: ResultatsComplets }): JSX.Element {
  const { brut, net, netNet } = r.rendement.rendements;
  let feuNet: Feu = 'inconnu';
  for (const f of r.verdict.feux) {
    if (f.axe === 'rendement') feuNet = f.feu;
  }
  // Sur papier, les trois explications viennent sous les chiffres, en pleine largeur : trois
  // colonnes étroites ne les laisseraient pas se lire.
  const document = useModeDocument();
  const rendements = [
    { quel: 'brut', libelle: 'Brut', valeur: brut, precision: 'loyers ÷ coût total', ton: '' },
    {
      quel: 'net',
      libelle: 'Net',
      valeur: net,
      precision: 'charges et vacance déduites',
      ton: TONS_FEU[feuNet],
    },
    {
      quel: 'netNet',
      libelle: 'Net-net',
      valeur: netNet,
      precision: 'après intérêts, assurance et impôt',
      ton: '',
    },
  ] as const;
  return (
    <Carte>
      <TitreCarte>Combien ça rapporte ?</TitreCarte>
      <div className="grid grid-cols-3 gap-3">
        {rendements.map((x) => (
          <Rendement
            key={x.quel}
            libelle={x.libelle}
            info={
              document ? null : (
                <Info
                  sujet={`Rendement ${x.libelle.toLowerCase()}`}
                  texte={explicationRendement(r, x.quel)}
                />
              )
            }
            valeur={pourcentage(x.valeur)}
            precision={x.precision}
            ton={x.ton}
          />
        ))}
      </div>
      {document && (
        <div className="flex flex-col gap-1.5 text-sm leading-relaxed text-encre-2">
          {rendements.map((x) => (
            <p key={x.quel} className="m-0">
              <span className="font-semibold text-encre">{x.libelle}.</span>{' '}
              {explicationRendement(r, x.quel)}
            </p>
          ))}
        </div>
      )}
    </Carte>
  );
}
