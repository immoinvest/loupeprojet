import type { Feu, Resultats } from '@loupe/moteur';
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
  const document = useModeDocument();
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <div className="flex items-center gap-0.5 text-[13px] font-bold text-encre-3">
        <span>{libelle}</span>
        {document ? null : info}
      </div>
      <span
        className={`font-display text-[26px] leading-tight font-bold sm:text-[30px] print:text-[30px] ${ton}`}
      >
        {valeur}
      </span>
      <span className="text-xs text-encre-3">{precision}</span>
      {document ? info : null}
    </div>
  );
}

/** Brut, net et net-net côte à côte, chacun avec sa définition et sa formule chiffrée. */
export function CarteRendements({ r }: { r: Resultats }): JSX.Element {
  const { brut, net, netNet } = r.rendement.rendements;
  let feuNet: Feu = 'inconnu';
  for (const f of r.verdict.feux) {
    if (f.axe === 'rendement') feuNet = f.feu;
  }
  return (
    <Carte>
      <TitreCarte>Combien ça rapporte ?</TitreCarte>
      <div className="grid grid-cols-3 gap-3">
        <Rendement
          libelle="Brut"
          info={<Info sujet="Rendement brut" texte={explicationRendement(r, 'brut')} />}
          valeur={pourcentage(brut)}
          precision="loyers ÷ coût total"
        />
        <Rendement
          libelle="Net"
          info={<Info sujet="Rendement net" texte={explicationRendement(r, 'net')} />}
          valeur={pourcentage(net)}
          precision="charges et vacance déduites"
          ton={TONS_FEU[feuNet]}
        />
        <Rendement
          libelle="Net-net"
          info={<Info sujet="Rendement net-net" texte={explicationRendement(r, 'netNet')} />}
          valeur={pourcentage(netNet)}
          precision="après intérêts, assurance et impôt"
        />
      </div>
      <p className="m-0 text-[15px] leading-relaxed text-encre-2">
        Le brut est le chiffre des annonces ; le net, celui du feu ; le net-net, ce qui vous reste.
      </p>
    </Carte>
  );
}
