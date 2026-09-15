import type { ModeLocation } from '@loupe/moteur';
import type { JSX } from 'react';

import { useModeDocument } from '@/composants/document';
import { Tuiles } from '@/composants/saisie/Tuiles';
import { Pastille } from '@/composants/ui';
import { TYPES_LOCATION } from '@/textes/regimes';

const OPTIONS = (
  [
    'nu',
    'meuble',
    'colocation',
    'courte_duree',
    'moyenne_duree',
  ] as const satisfies readonly ModeLocation[]
).map((mode) => ({ valeur: mode, libelle: TYPES_LOCATION[mode] }));

/**
 * Le type d'exploitation en tuiles : première question de la carte « La location » (Hypothèses et
 * Vérifier). Toujours un type choisi ; sur papier, seul le type retenu est écrit.
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
    <Tuiles
      nom={nom}
      libelle="Type de location"
      options={OPTIONS}
      valeur={valeur}
      onChange={(mode) => {
        if (mode !== '') onChange(mode);
      }}
    />
  );
}
