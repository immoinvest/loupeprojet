import type { HTMLInputTypeAttribute, JSX } from 'react';

/** Bordure séparée de la classe de base : deux couleurs de bordure ne s'annulent pas selon leur ordre. */
const CLASSE_SAISIE =
  'min-h-[48px] w-full min-w-0 rounded-encart border bg-surface px-4 text-[16px] text-encre';

export interface ChampGererProps {
  readonly id: string;
  readonly libelle: string;
  readonly valeur: string;
  readonly onChange: (valeur: string) => void;
  readonly erreur?: string | undefined;
  readonly aide?: string | undefined;
  readonly unite?: string | undefined;
  readonly type?: HTMLInputTypeAttribute | undefined;
  readonly inputMode?: 'text' | 'decimal' | 'numeric' | 'email' | 'tel' | undefined;
  readonly autoComplete?: string | undefined;
  readonly placeholder?: string | undefined;
}

/** Un champ des écrans de Gérer : libellé, saisie, unité, aide ou erreur reliées au champ. */
export function ChampGerer({
  id,
  libelle,
  valeur,
  onChange,
  erreur,
  aide,
  unite,
  type = 'text',
  inputMode,
  autoComplete,
  placeholder,
}: ChampGererProps): JSX.Element {
  const message = erreur ?? aide;
  const idMessage = `${id}-message`;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-encre-2">
        {libelle}
      </label>
      <span className="flex items-center gap-2">
        <input
          id={id}
          name={id}
          type={type}
          value={valeur}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          inputMode={inputMode}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={erreur !== undefined}
          aria-describedby={message === undefined ? undefined : idMessage}
          className={`${CLASSE_SAISIE} ${erreur === undefined ? 'border-bordure' : 'border-probleme'}`}
        />
        {unite !== undefined && (
          <span className="text-sm whitespace-nowrap text-encre-3">{unite}</span>
        )}
      </span>
      {message !== undefined && (
        <span
          id={idMessage}
          className={`text-sm ${erreur === undefined ? 'text-encre-3' : 'text-probleme-texte'}`}
        >
          {message}
        </span>
      )}
    </div>
  );
}
