import type { JSX } from 'react';
import { useState } from 'react';

import { Carte, TitreCarte } from '@/composants/ui';
import { useGestion } from '@/gestion/GestionContext';
import { CHOIX_MENU, choixDe, preferencesDe, type ChoixMenu } from '@/gestion/menu';
import { ERREURS_GESTION, TEXTES_CHOIX_MENU, TEXTES_MON_MENU as T } from '@/textes/gerer';

function Choix({
  choix,
  actif,
  occupe,
  onChoisir,
}: {
  choix: ChoixMenu;
  actif: boolean;
  occupe: boolean;
  onChoisir: () => void;
}): JSX.Element {
  const { libelle, detail } = TEXTES_CHOIX_MENU[choix];
  return (
    <label
      className={`flex min-h-[52px] items-center gap-4 rounded-encart border px-3 py-2 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent ${
        actif ? 'border-accent-bordure bg-accent-fond' : 'border-bordure hover:bg-accent-fond'
      } ${occupe ? 'cursor-wait' : 'cursor-pointer'}`}
    >
      <input
        type="radio"
        name="menu"
        value={choix}
        checked={actif}
        disabled={occupe}
        onChange={onChoisir}
        className="h-5 w-5 shrink-0 accent-accent"
      />
      <span className="flex min-w-0 flex-col">
        <span className="text-[15px] font-bold text-encre">{libelle}</span>
        <span className="text-sm text-encre-3">{detail}</span>
      </span>
    </label>
  );
}

/** Carte « Mon menu » : Analyser et Gérer, Analyser seulement ou Gérer seulement. */
export function MonMenu(): JSX.Element {
  const { statut, preferences, changerPreferences } = useGestion();
  const [occupe, setOccupe] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);
  const courant = choixDe(preferences);

  const choisir = async (choix: ChoixMenu): Promise<void> => {
    if (choix === courant) return;
    setOccupe(true);
    const r = await changerPreferences(preferencesDe(choix));
    setOccupe(false);
    setEchec(r.ok ? null : ERREURS_GESTION[r.code]);
  };

  return (
    <Carte>
      <TitreCarte>{T.titre}</TitreCarte>
      {statut === 'pret' ? (
        <>
          <p className="m-0 text-sm text-encre-2">{T.phrase}</p>
          <div role="radiogroup" aria-label={T.titre} className="flex flex-col gap-2">
            {CHOIX_MENU.map((choix) => (
              <Choix
                key={choix}
                choix={choix}
                actif={choix === courant}
                occupe={occupe}
                onChoisir={() => void choisir(choix)}
              />
            ))}
          </div>
          {echec !== null && (
            <p
              role="alert"
              className="m-0 rounded-encart bg-probleme-fond p-3 text-sm text-probleme-texte"
            >
              {echec}
            </p>
          )}
          <p className="m-0 text-xs text-encre-3">{T.partout}</p>
        </>
      ) : (
        <p className="m-0 text-sm text-encre-3">
          {statut === 'erreur' ? ERREURS_GESTION.indisponible : T.chargement}
        </p>
      )}
    </Carte>
  );
}
