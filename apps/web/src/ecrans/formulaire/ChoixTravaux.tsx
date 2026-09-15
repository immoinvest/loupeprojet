import { useState, type JSX } from 'react';

import { euros } from '@/formatage/nombres';
import { MENTION_TRAVAUX, fourchetteTravaux } from '@/textes/travaux';
import { travauxEstimesDe } from '@/verifier/travaux';

import { Montant } from './Commandes';
import type { ContexteFormulaire } from './contexte';
import { nombre } from './valeurs';

/**
 * Les travaux sont facultatifs. État connu et aucun montant : les travaux estimés s'affichent et le
 * champ s'ouvre pour les modifier. Sinon, le champ n'apparaît que si l'on en prévoit.
 */
export function ChoixTravaux({ c }: { c: ContexteFormulaire }): JSX.Element {
  const [ouverts, setOuverts] = useState((nombre(c.valeurs.travaux) ?? 0) > 0);
  const estimation = travauxEstimesDe(c.valeurs);
  const ouvrir = estimation === null ? '+ Ajouter des travaux' : 'Modifier les travaux';
  return (
    <div className="col-span-full flex flex-col gap-2 p-2">
      {estimation !== null && !ouverts && (
        <p className="m-0 text-[15px]">
          <span className="font-semibold">Travaux estimés {euros(estimation.estime)}</span>
          <span className="block text-sm text-encre-2">
            {fourchetteTravaux(estimation)}. {MENTION_TRAVAUX}
          </span>
        </p>
      )}
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
        {ouverts ? '− Retirer les travaux' : ouvrir}
      </button>
      {ouverts && (
        <div id="champ-travaux" className="max-w-80">
          <Montant c={c} cle="travaux" libelle="Travaux prévus" unite="€" />
        </div>
      )}
    </div>
  );
}
