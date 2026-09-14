import { Minus, Plus } from 'lucide-react';
import type { JSX } from 'react';

import { useModeDocument } from '@/composants/document';

import { bornesAtteintes, lireEntier, valeurApresPas, type BornesCompteur } from './pas';

export interface PropsCompteur extends BornesCompteur {
  /** Id de la saisie : le libellé du champ la nomme par `htmlFor`. */
  readonly id: string;
  readonly nom?: string | undefined;
  /** `''` : inconnu. */
  readonly valeur: string;
  readonly onChange: (valeur: string) => void;
  /** Noms des boutons pour les lecteurs d'écran : « Une pièce de moins », « Une pièce de plus ». */
  readonly nomMoins: string;
  readonly nomPlus: string;
  /** Texte affiché à côté d'une valeur (« RDC » à 0) ; rien si `undefined`. */
  readonly suffixe?: ((valeur: number) => string | undefined) | undefined;
  readonly decritPar?: string | undefined;
  readonly invalide?: boolean;
}

const CLASSE_BOUTON =
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-bordure bg-surface text-encre-2 survol-fond disabled:opacity-40';

/**
 * Compter : − / valeur / +. La valeur reste une saisie numérique qu'on peut vider (inconnu) ou taper ;
 * les boutons bornent, la saisie non (la validation du formulaire dit ce qui ne va pas).
 */
export function Compteur({
  id,
  nom,
  valeur,
  onChange,
  nomMoins,
  nomPlus,
  suffixe,
  decritPar,
  invalide = false,
  ...bornes
}: PropsCompteur): JSX.Element {
  const document = useModeDocument();
  const n = lireEntier(valeur);
  const texteSuffixe = n === null ? undefined : suffixe?.(n);
  if (document) {
    return (
      <span className="text-[15px] font-semibold">
        {valeur === '' ? '—' : (texteSuffixe ?? valeur)}
      </span>
    );
  }
  const { moins, plus } = bornesAtteintes(valeur, bornes.min, bornes.max);
  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        aria-label={nomMoins}
        aria-controls={id}
        disabled={moins}
        onClick={() => {
          onChange(valeurApresPas(valeur, -1, bornes));
        }}
        className={CLASSE_BOUTON}
      >
        <Minus size={18} aria-hidden="true" />
      </button>
      <input
        id={id}
        name={nom}
        value={valeur}
        inputMode="numeric"
        autoComplete="off"
        aria-describedby={decritPar}
        aria-invalid={invalide}
        onChange={(e) => {
          onChange(e.target.value.replace(/\D/g, ''));
        }}
        className={`min-h-[44px] w-16 min-w-0 rounded-encart border bg-surface px-2 text-center text-[15px] font-semibold pointer-coarse:text-base ${
          invalide ? 'border-probleme' : 'border-bordure'
        }`}
      />
      <button
        type="button"
        aria-label={nomPlus}
        aria-controls={id}
        disabled={plus}
        onClick={() => {
          onChange(valeurApresPas(valeur, 1, bornes));
        }}
        className={CLASSE_BOUTON}
      >
        <Plus size={18} aria-hidden="true" />
      </button>
      {texteSuffixe !== undefined && (
        <span className="text-sm font-semibold text-encre-2">{texteSuffixe}</span>
      )}
    </span>
  );
}
