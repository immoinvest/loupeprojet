import type { JSX } from 'react';

import { TEXTES_CONNEXION } from '@/textes/connexion';

import { CLASSE_PRIMAIRE, CLASSE_SAISIE } from './styles';

export function FormulaireEmail({
  email,
  occupe,
  onEmail,
  onEnvoyer,
}: {
  email: string;
  occupe: boolean;
  onEmail: (email: string) => void;
  onEnvoyer: () => void;
}): JSX.Element {
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onEnvoyer();
      }}
      className="flex flex-col gap-3"
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-encre-2">{TEXTES_CONNEXION.libelleEmail}</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="camille@exemple.fr"
          value={email}
          onChange={(e) => {
            onEmail(e.target.value);
          }}
          className={CLASSE_SAISIE}
        />
      </label>
      <button type="submit" disabled={occupe} className={CLASSE_PRIMAIRE}>
        {TEXTES_CONNEXION.recevoirCode}
      </button>
    </form>
  );
}
