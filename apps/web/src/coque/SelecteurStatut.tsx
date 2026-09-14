import { ChevronDown } from 'lucide-react';
import type { JSX } from 'react';

import { STATUTS, StatutProjetSchema, type StatutProjet } from '@/stockage/projets';

/** Chaque statut a sa couleur : on voit d'un coup d'œil où en est le projet. */
const COULEURS: Readonly<Record<StatutProjet, { pastille: string; point: string }>> = {
  analyse: { pastille: 'border-accent-bordure bg-accent-doux text-accent', point: 'bg-accent' },
  visite: {
    pastille: 'border-surveiller/30 bg-surveiller-fond text-surveiller-texte',
    point: 'bg-surveiller',
  },
  offre: { pastille: 'border-flash/30 bg-flash-fond text-encre', point: 'bg-flash' },
  achete: { pastille: 'border-bon/30 bg-bon-fond text-bon-texte', point: 'bg-bon' },
  ecarte: { pastille: 'border-bordure bg-bordure-douce text-encre-3', point: 'bg-encre-4' },
  scenario: { pastille: 'border-bordure bg-surface text-encre-2', point: 'bg-encre-3' },
};

/** Le statut du projet, en pastille colorée : une liste native, lisible au clavier et au doigt. */
export function SelecteurStatut({
  statut,
  onChange,
}: {
  statut: StatutProjet;
  onChange: (statut: StatutProjet) => void;
}): JSX.Element {
  const couleur = COULEURS[statut];
  return (
    <label
      className={`relative inline-flex min-h-[44px] items-center rounded-full border font-semibold ${couleur.pastille}`}
    >
      <span className="sr-only">Statut du projet</span>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute left-3.5 size-2.5 rounded-full ${couleur.point}`}
      />
      <select
        value={statut}
        onChange={(e) => {
          onChange(StatutProjetSchema.parse(e.target.value));
        }}
        className="min-h-[44px] cursor-pointer appearance-none rounded-full bg-transparent pr-9 pl-8 text-sm font-bold outline-none pointer-coarse:text-base"
      >
        {StatutProjetSchema.options.map((s) => (
          <option key={s} value={s}>
            {STATUTS[s]}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute right-3 shrink-0"
      />
    </label>
  );
}
