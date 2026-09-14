import type { ModeLocation } from '@loupe/moteur';
import type { JSX } from 'react';

import { useModeDocument } from '@/composants/document';
import { Pastille } from '@/composants/ui';
import { TYPES_LOCATION } from '@/textes/regimes';

const ORDRE: readonly ModeLocation[] = [
  'nu',
  'meuble',
  'colocation',
  'courte_duree',
  'moyenne_duree',
];

/**
 * Le type d'exploitation en boutons : première question de la carte « La location » (Hypothèses et
 * Vérifier). Des boutons radio natifs, pour le clavier et les lecteurs d'écran ; 44 px de cible.
 * Sur papier, seul le type retenu est écrit.
 */
export function SelecteurMode({
  valeur,
  onChange,
  nom,
}: {
  valeur: ModeLocation;
  onChange: (mode: ModeLocation) => void;
  /** Nom du groupe de boutons radio, unique dans la page. */
  nom: string;
}): JSX.Element {
  const document = useModeDocument();
  if (document) {
    return (
      <Pastille ton="accent" compacte>
        {TYPES_LOCATION[valeur]}
      </Pastille>
    );
  }
  return (
    <div role="radiogroup" aria-label="Type de location" className="flex flex-wrap gap-2">
      {ORDRE.map((mode) => {
        const choisi = mode === valeur;
        return (
          <label
            key={mode}
            className={`inline-flex min-h-[44px] cursor-pointer items-center rounded-full border px-4 text-sm font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
              choisi
                ? 'border-accent bg-accent text-white'
                : 'border-bordure bg-surface text-encre-2 hover:bg-accent-fond'
            }`}
          >
            <input
              type="radio"
              name={nom}
              value={mode}
              checked={choisi}
              onChange={() => {
                onChange(mode);
              }}
              className="sr-only"
            />
            {TYPES_LOCATION[mode]}
          </label>
        );
      })}
    </div>
  );
}
