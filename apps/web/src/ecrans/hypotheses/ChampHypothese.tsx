import type { JSX } from 'react';

import { Pastille, type TonPastille } from '@/composants/ui';
import type { Descripteur } from '@/hypotheses';

export interface BadgeProvenance {
  readonly ton: TonPastille;
  readonly libelle: string;
}

const CLASSE_SAISIE =
  'min-h-[44px] w-full rounded-encart border bg-surface px-3 text-[15px] font-semibold';

export function ChampHypothese({
  descripteur: d,
  texte,
  erreur,
  badge,
  onChange,
}: {
  descripteur: Descripteur;
  texte: string;
  erreur?: string | undefined;
  badge: BadgeProvenance | null;
  onChange: (texte: string) => void;
}): JSX.Element {
  const bordure = erreur === undefined ? 'border-bordure' : 'border-probleme';
  const aToi = badge?.libelle === 'à toi';
  return (
    <label className={`flex flex-col gap-1 rounded-encart p-2 ${aToi ? 'bg-accent-fond' : ''}`}>
      <span className="flex items-center justify-between gap-2 text-xs text-encre-3">
        {d.libelle}
        {badge !== null && (
          <Pastille ton={badge.ton} compacte>
            {badge.libelle}
          </Pastille>
        )}
      </span>
      {d.options === undefined ? (
        <span className="flex items-center gap-2">
          <input
            name={d.chemin}
            value={texte}
            inputMode={d.type === 'texte' ? 'text' : 'decimal'}
            onChange={(e) => {
              onChange(e.target.value);
            }}
            className={`${CLASSE_SAISIE} ${bordure}`}
          />
          {d.unite !== undefined && (
            <span className="text-xs whitespace-nowrap text-encre-3">{d.unite}</span>
          )}
        </span>
      ) : (
        <select
          name={d.chemin}
          value={texte}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          className={`${CLASSE_SAISIE} ${bordure}`}
        >
          {d.obligatoire !== true && <option value="">?</option>}
          {d.options.map((o) => (
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
