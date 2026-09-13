import type { JSX } from 'react';

import type { Fournisseurs, FournisseurSocial } from '@/compte/types';
import { IconeApple, IconeGoogle } from '@/composants/IconesFournisseurs';
import { libelleContinuerAvec } from '@/textes/connexion';

import { CLASSE_FOURNISSEUR } from './styles';

const ICONES: Readonly<Record<FournisseurSocial, () => JSX.Element>> = {
  google: () => <IconeGoogle />,
  apple: () => <IconeApple />,
};

/** « Continuer avec Google », « Continuer avec Apple » : seulement ceux que le serveur propose. */
export function BoutonsFournisseurs({
  fournisseurs,
  occupe,
  onChoisir,
}: {
  fournisseurs: Fournisseurs;
  occupe: boolean;
  onChoisir: (fournisseur: FournisseurSocial) => void;
}): JSX.Element | null {
  const proposes = (['google', 'apple'] as const).filter((f) => fournisseurs[f]);
  if (proposes.length === 0) return null;
  return (
    <div className="flex flex-col gap-2.5">
      {proposes.map((fournisseur) => (
        <button
          key={fournisseur}
          type="button"
          disabled={occupe}
          onClick={() => {
            onChoisir(fournisseur);
          }}
          className={CLASSE_FOURNISSEUR}
        >
          {ICONES[fournisseur]()}
          {libelleContinuerAvec(fournisseur)}
        </button>
      ))}
    </div>
  );
}
