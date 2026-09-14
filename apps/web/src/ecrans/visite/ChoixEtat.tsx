import type { JSX } from 'react';

import type { EtatReponse } from '@/stockage/projets';
import { ETATS_REPONSE, ORDRE_ETATS } from '@/textes/visite';

const ACTIF: Readonly<Record<EtatReponse, string>> = {
  a_verifier: 'border-encre-3 bg-bordure-douce text-encre',
  ok: 'border-bon bg-bon-fond text-bon-texte',
  probleme: 'border-probleme bg-probleme-fond text-probleme-texte',
  sans_objet: 'border-encre-4 bg-surface text-encre-2',
};

const INACTIF = 'border-bordure bg-surface text-encre-3 survol-fond';

/** Les quatre réponses possibles, en boutons radio (un seul choix, flèches du clavier, 44 px au doigt). */
export function ChoixEtat({
  id,
  texte,
  etat,
  onChange,
}: {
  id: string;
  texte: string;
  etat: EtatReponse;
  onChange: (etat: EtatReponse) => void;
}): JSX.Element {
  return (
    <fieldset className="m-0 flex flex-wrap gap-1.5 border-0 p-0">
      <legend className="sr-only">Réponse : {texte}</legend>
      {ORDRE_ETATS.map((e) => {
        const actif = e === etat;
        return (
          <label
            key={e}
            className={`inline-flex min-h-[44px] cursor-pointer items-center rounded-full border px-3.5 text-sm font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
              actif ? ACTIF[e] : INACTIF
            }`}
          >
            <input
              type="radio"
              name={`reponse-${id}`}
              value={e}
              checked={actif}
              onChange={() => {
                onChange(e);
              }}
              className="sr-only"
            />
            {ETATS_REPONSE[e]}
          </label>
        );
      })}
    </fieldset>
  );
}
