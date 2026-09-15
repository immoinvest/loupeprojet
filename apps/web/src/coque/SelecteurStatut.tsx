import { ChevronDown } from 'lucide-react';
import type { JSX } from 'react';

import { MenuChoix, type GroupeChoix } from '@/composants/MenuChoix';
import { STATUTS, type StatutProjet } from '@/stockage/projets';
import { ORDRE_STATUTS, PRECISIONS_STATUT, TEXTES_STATUT } from '@/textes/statut';

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

const GROUPES: readonly GroupeChoix<StatutProjet>[] = ORDRE_STATUTS.map((groupe) => ({
  nom: groupe.nom,
  options: groupe.statuts.map((s) => ({
    valeur: s,
    libelle: STATUTS[s],
    precision: PRECISIONS_STATUT[s],
  })),
}));

function PointStatut({ statut }: { statut: StatutProjet }): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={`size-2.5 shrink-0 rounded-full ${COULEURS[statut].point}`}
    />
  );
}

/**
 * Le statut du projet, en pastille colorée ; la liste ouverte suit l'ordre du parcours (En analyse →
 * Acheté), puis Scénario et Écarté à part. À l'impression, la pastille seule, sans chevron.
 */
export function SelecteurStatut({
  statut,
  onChange,
}: {
  statut: StatutProjet;
  onChange: (statut: StatutProjet) => void;
}): JSX.Element {
  return (
    <MenuChoix
      libelle={TEXTES_STATUT.libelle}
      valeur={statut}
      groupes={GROUPES}
      onChoix={onChange}
      classeBouton={`inline-flex min-h-[44px] items-center gap-2 rounded-full border pr-3 pl-3.5 text-sm font-bold survol-pastille pointer-coarse:text-base ${COULEURS[statut].pastille}`}
      avantValeur={<PointStatut statut={statut} />}
      apresValeur={<ChevronDown size={16} aria-hidden="true" className="shrink-0 print:hidden" />}
      decorOption={(s) => <PointStatut statut={s} />}
    />
  );
}
