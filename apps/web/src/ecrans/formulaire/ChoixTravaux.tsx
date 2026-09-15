import { useState, type JSX } from 'react';

import { Montant } from './Commandes';
import type { ContexteFormulaire } from './contexte';
import { nombre } from './valeurs';

/** Les travaux sont facultatifs : le champ n'apparaît que si l'on en prévoit. */
export function ChoixTravaux({ c }: { c: ContexteFormulaire }): JSX.Element {
  const [ouverts, setOuverts] = useState((nombre(c.valeurs.travaux) ?? 0) > 0);
  return (
    <div className="col-span-full flex flex-col gap-2 p-2">
      <button
        type="button"
        aria-expanded={ouverts}
        aria-controls="champ-travaux"
        onClick={() => {
          if (ouverts) c.changer('travaux', '');
          setOuverts(!ouverts);
        }}
        className="inline-flex min-h-[44px] items-center gap-2 self-start rounded-full border border-bordure bg-surface px-4 text-sm font-semibold text-encre-2 survol-fond"
      >
        {ouverts ? '− Retirer les travaux' : '+ Ajouter des travaux'}
      </button>
      {ouverts && (
        <div id="champ-travaux" className="max-w-80">
          <Montant c={c} cle="travaux" libelle="Travaux prévus" unite="€" />
        </div>
      )}
    </div>
  );
}
