import { ChevronDown } from 'lucide-react';
import type { JSX } from 'react';

import { MenuChoix, type OptionChoix } from '@/composants/MenuChoix';

const CLASSE_BOUTON =
  'flex min-h-[48px] w-full min-w-0 items-center justify-between gap-3 rounded-encart border border-bordure bg-surface px-4 text-left text-[16px] font-semibold text-encre survol-fond';

/** Une liste de choix des écrans Argent : libellé visible au-dessus, `MenuChoix` dessous. */
export function ListeChoix<V extends string>({
  libelle,
  valeur,
  options,
  onChoix,
}: {
  readonly libelle: string;
  readonly valeur: V;
  readonly options: readonly OptionChoix<V>[];
  readonly onChoix: (valeur: V) => void;
}): JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span aria-hidden="true" className="text-sm font-semibold text-encre-2">
        {libelle}
      </span>
      <MenuChoix
        libelle={libelle}
        valeur={valeur}
        groupes={[{ nom: libelle, options }]}
        onChoix={onChoix}
        classeBouton={CLASSE_BOUTON}
        apresValeur={<ChevronDown size={18} aria-hidden="true" className="shrink-0 text-encre-3" />}
      />
    </div>
  );
}
