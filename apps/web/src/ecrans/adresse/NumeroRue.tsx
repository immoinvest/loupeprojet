import { useId, useState, type JSX } from 'react';

import { Bouton } from '@/composants/ui';
import { lireNumero } from '@/enrichissement';
import { PHRASES_ADRESSE, questionNumero } from '@/textes/adresse';

export interface PropsNumeroRue {
  /** Libellé de la rue ou du lieu-dit choisi. */
  readonly libelle: string;
  readonly occupe: boolean;
  /** Le numéro lu, ou `null` quand la personne ne le connaît pas. */
  readonly onNumero: (numero: number | null) => void;
}

/** Une rue choisie sans numéro : on demande le numéro, et l'on peut continuer sans (analyse moins précise). */
export function NumeroRue({ libelle, occupe, onNumero }: PropsNumeroRue): JSX.Element {
  const id = useId();
  const idErreur = useId();
  const [texte, setTexte] = useState('');
  const [invalide, setInvalide] = useState(false);

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const numero = lireNumero(texte);
        setInvalide(numero === null);
        if (numero !== null) onNumero(numero);
      }}
    >
      <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto">
        <label htmlFor={id} className="text-sm font-semibold text-encre-2">
          {questionNumero(libelle)}
        </label>
        <input
          id={id}
          name="numero"
          value={texte}
          inputMode="numeric"
          autoComplete="off"
          aria-invalid={invalide}
          aria-describedby={invalide ? idErreur : undefined}
          onChange={(e) => {
            setTexte(e.target.value);
          }}
          className="min-h-[44px] w-full rounded-encart border border-bordure bg-surface px-3 text-[15px] font-semibold pointer-coarse:text-base sm:w-40"
        />
      </div>
      <Bouton variante="primaire" type="submit" disabled={texte.trim() === '' || occupe}>
        Analyser avec ce numéro
      </Bouton>
      <Bouton
        variante="secondaire"
        type="button"
        disabled={occupe}
        onClick={() => {
          onNumero(null);
        }}
      >
        Je ne connais pas le numéro
      </Bouton>
      {invalide && (
        <span id={idErreur} className="w-full text-xs text-probleme">
          {PHRASES_ADRESSE.numeroInvalide}
        </span>
      )}
    </form>
  );
}
