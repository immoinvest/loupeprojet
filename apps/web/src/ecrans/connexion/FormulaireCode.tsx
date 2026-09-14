import type { JSX } from 'react';

import { codeComplet, normaliserCode } from '@/compte/saisie';
import { codeEnvoyeA, TEXTES_CONNEXION } from '@/textes/connexion';

import { CLASSE_LIEN, CLASSE_PRIMAIRE, CLASSE_SAISIE } from './styles';

export function FormulaireCode({
  email,
  code,
  occupe,
  onCode,
  onVerifier,
  onRenvoyer,
  onChangerAdresse,
}: {
  email: string;
  code: string;
  occupe: boolean;
  onCode: (code: string) => void;
  onVerifier: () => void;
  onRenvoyer: () => void;
  onChangerAdresse: () => void;
}): JSX.Element {
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onVerifier();
      }}
      className="flex flex-col gap-3"
    >
      <p className="m-0 text-center text-[15px] text-encre-2">{codeEnvoyeA(email)}</p>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-encre-2">{TEXTES_CONNEXION.libelleCode}</span>
        <input
          name="code"
          autoComplete="one-time-code"
          inputMode="numeric"
          placeholder="••••••"
          value={code}
          onChange={(e) => {
            onCode(normaliserCode(e.target.value));
          }}
          className={`${CLASSE_SAISIE} text-center font-display text-[26px] font-bold tracking-[0.35em]`}
        />
      </label>
      <button type="submit" disabled={occupe || !codeComplet(code)} className={CLASSE_PRIMAIRE}>
        {TEXTES_CONNEXION.meConnecter}
      </button>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
        <button
          type="button"
          disabled={occupe}
          onClick={onRenvoyer}
          className={`${CLASSE_LIEN} pointer-coarse:min-h-11`}
        >
          {TEXTES_CONNEXION.renvoyer}
        </button>
        <button
          type="button"
          onClick={onChangerAdresse}
          className="font-semibold text-encre-3 survol-discret pointer-coarse:min-h-11"
        >
          {TEXTES_CONNEXION.changerAdresse}
        </button>
      </div>
    </form>
  );
}
