import { Check } from 'lucide-react';
import { useId, type JSX } from 'react';

import { Carte } from '@/composants/ui';
import type { NomGroupe } from '@/verifier/groupes';
import { ITEMS, ORDRE_CARTES, TITRES_CARTES, type Item } from '@/verifier/items';

import { Commande } from './Commande';
import { GRILLE, type ContexteFormulaire } from './contexte';

export const TITRES_GROUPES: Readonly<
  Record<Exclude<NomGroupe, 'essentiel'>, { readonly titre: string; readonly action: string }>
> = {
  lus: { titre: "Lu dans l'annonce", action: 'Voir / modifier' },
  estimes: { titre: 'Estimé pour vous', action: 'Modifier' },
  preciser: { titre: 'Préciser pour une analyse plus juste (facultatif)', action: 'Ouvrir' },
};

/** Les items rangés par carte (Le bien, La location, Vous, Charges connues). */
export function CartesItems({
  items,
  c,
}: {
  items: readonly Item[];
  c: ContexteFormulaire;
}): JSX.Element {
  return (
    <>
      {ORDRE_CARTES.map((carte) => {
        const ceux = items.filter((item) => ITEMS[item].carte === carte);
        if (ceux.length === 0) return null;
        return (
          <Carte key={carte}>
            <h3 className="m-0 font-display text-lg font-semibold">{TITRES_CARTES[carte]}</h3>
            <div className={GRILLE}>
              {ceux.map((item) => (
                <Commande key={item} item={item} c={c} />
              ))}
            </div>
          </Carte>
        );
      })}
    </>
  );
}

/** Un résumé d'une ligne qui se déplie en cartes : « Estimé pour vous : apport 10 %, 25 ans… Modifier ». */
export function GroupeReplie({
  nom,
  resume,
  items,
  ouvert,
  onBasculer,
  c,
}: {
  nom: Exclude<NomGroupe, 'essentiel'>;
  resume: string;
  items: readonly Item[];
  ouvert: boolean;
  onBasculer: () => void;
  c: ContexteFormulaire;
}): JSX.Element {
  const id = useId();
  const { titre, action } = TITRES_GROUPES[nom];
  return (
    <div className="flex flex-col gap-3" data-groupe={nom}>
      <button
        type="button"
        aria-expanded={ouvert}
        aria-controls={id}
        onClick={onBasculer}
        className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-carte border border-bordure bg-surface px-4 py-3 text-left survol-fond"
      >
        <span className="flex min-w-0 items-start gap-2">
          {nom === 'lus' && (
            <Check size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-bon-texte" />
          )}
          <span className="flex min-w-0 flex-col">
            <span className="font-semibold text-encre">{titre}</span>
            <span className="text-sm text-encre-3">{resume}</span>
          </span>
        </span>
        <span className="shrink-0 text-sm font-bold text-accent">
          {ouvert ? 'Replier' : action}
        </span>
      </button>
      {ouvert && (
        <div id={id} className="flex flex-col gap-4">
          <CartesItems items={items} c={c} />
        </div>
      )}
    </div>
  );
}
