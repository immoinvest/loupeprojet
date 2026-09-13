import type { JSX, ReactNode } from 'react';

import { Pastille } from '@/composants/ui';

import type { Cle, ProvenanceValeurs, Valeurs } from './valeurs';

export interface ChampProps {
  readonly cle: Cle;
  readonly libelle: string;
  readonly valeurs: Valeurs;
  readonly provenance: ProvenanceValeurs;
  readonly onChange: (cle: Cle, v: string) => void;
  readonly erreur?: string | undefined;
  readonly unite?: string | undefined;
  readonly options?: readonly { v: string; l: string }[] | undefined;
  readonly aToi?: boolean | undefined;
}

const CLASSE_SAISIE =
  'min-h-[44px] w-full rounded-encart border bg-surface px-3 text-[15px] font-semibold';

/** Un champ du formulaire Vérifier : libellé, badge de provenance, saisie ou liste, erreur. */
export function Champ({
  cle,
  libelle,
  valeurs,
  provenance,
  onChange,
  erreur,
  unite,
  options,
  aToi = false,
}: ChampProps): JSX.Element {
  const bordure = erreur === undefined ? 'border-bordure' : 'border-probleme';
  let badge: ReactNode = null;
  if (provenance[cle] === 'annonce') {
    badge = (
      <Pastille ton="neutre" compacte>
        annonce
      </Pastille>
    );
  } else if (aToi) {
    badge = (
      <Pastille ton="accent" compacte>
        à toi
      </Pastille>
    );
  }
  return (
    <label className={`flex flex-col gap-1 rounded-encart p-2 ${aToi ? 'bg-accent-fond' : ''}`}>
      <span className="flex items-center justify-between gap-2 text-xs text-encre-3">
        {libelle}
        {badge}
      </span>
      {options === undefined ? (
        <span className="flex items-center gap-2">
          <input
            name={cle}
            value={valeurs[cle]}
            onChange={(e) => {
              onChange(cle, e.target.value);
            }}
            inputMode="decimal"
            className={`${CLASSE_SAISIE} ${bordure}`}
          />
          {unite !== undefined && <span className="text-xs text-encre-3">{unite}</span>}
        </span>
      ) : (
        <select
          name={cle}
          value={valeurs[cle]}
          onChange={(e) => {
            onChange(cle, e.target.value);
          }}
          className={`${CLASSE_SAISIE} ${bordure}`}
        >
          {options.map((o) => (
            <option key={o.v} value={o.v}>
              {o.l}
            </option>
          ))}
        </select>
      )}
      {erreur !== undefined && <span className="text-xs text-probleme">{erreur}</span>}
    </label>
  );
}
