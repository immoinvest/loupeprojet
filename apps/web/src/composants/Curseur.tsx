import type { JSX, ReactNode } from 'react';

import { useModeDocument } from './document';

export interface CurseurProps {
  readonly id: string;
  readonly libelle: ReactNode;
  /** Valeur dans l'unité affichée (5 pour « −5 % », 12 pour « 12 ans »). */
  readonly valeur: number;
  readonly min: number;
  readonly max: number;
  readonly pas: number;
  /** Texte lu et affiché pour une valeur : « −5 % », « 12 ans ». */
  readonly formater: (valeur: number) => string;
  readonly onChange: (valeur: number) => void;
  readonly className?: string;
}

/**
 * Curseur accessible : libellé visible, valeur lue (`aria-valuetext`), piste de 44 px au doigt.
 * Une valeur hors bornes (saisie au clavier au-delà du curseur) se place en butée, sans être perdue.
 * En mode document (impression, partage), la valeur seule est écrite : rien ne se règle sur le papier.
 */
export function Curseur({
  id,
  libelle,
  valeur,
  min,
  max,
  pas,
  formater,
  onChange,
  className = '',
}: CurseurProps): JSX.Element {
  const document = useModeDocument();
  const texte = formater(valeur);
  if (document) {
    return (
      <p className={`m-0 text-[15px] ${className}`}>
        {libelle} {texte}
      </p>
    );
  }
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-center justify-between gap-2 text-xs text-encre-3">
        <label htmlFor={id}>{libelle}</label>
        <output htmlFor={id} className="text-sm font-semibold text-encre">
          {texte}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={pas}
        value={Math.min(max, Math.max(min, valeur))}
        aria-valuetext={texte}
        onChange={(e) => {
          onChange(Number(e.target.value));
        }}
        className="h-11 w-full cursor-pointer accent-accent"
      />
    </div>
  );
}
