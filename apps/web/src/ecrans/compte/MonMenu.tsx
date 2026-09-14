import type { JSX } from 'react';
import { useState } from 'react';

import { Carte, TitreCarte } from '@/composants/ui';
import { basculer, estFigee, type Section } from '@/gestion/menu';
import { useGestion } from '@/gestion/GestionContext';
import { ERREURS_GESTION, TEXTES_MON_MENU as T } from '@/textes/gerer';

function Interrupteur({
  libelle,
  detail,
  actif,
  fige,
  onBasculer,
}: {
  libelle: string;
  detail: string;
  actif: boolean;
  fige: boolean;
  onBasculer: () => void;
}): JSX.Element {
  return (
    <label
      className={`flex min-h-[52px] items-center gap-4 border-b border-bordure-douce py-2 last:border-b-0 ${
        fige ? 'cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      <input
        type="checkbox"
        role="switch"
        checked={actif}
        disabled={fige}
        onChange={onBasculer}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative h-[26px] w-[46px] shrink-0 rounded-full bg-encre-4 transition-colors peer-checked:bg-accent peer-disabled:opacity-45 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent after:absolute after:top-[3px] after:left-[3px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-[left] peer-checked:after:left-[23px] motion-reduce:transition-none"
      />
      <span className="flex min-w-0 flex-col">
        <span className="text-[15px] font-bold text-encre">{libelle}</span>
        <span className="text-sm text-encre-3">{detail}</span>
      </span>
    </label>
  );
}

/** Carte « Mon menu » : masquer la section Analyser ou Gérer ; au moins une reste affichée. */
export function MonMenu(): JSX.Element {
  const { statut, preferences, changerPreferences } = useGestion();
  const [occupe, setOccupe] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);

  const changer = async (section: Section): Promise<void> => {
    const suivantes = basculer(preferences, section);
    if (suivantes === null) return;
    setOccupe(true);
    const r = await changerPreferences(suivantes);
    setOccupe(false);
    setEchec(r.ok ? null : ERREURS_GESTION[r.code]);
  };

  return (
    <Carte>
      <TitreCarte>{T.titre}</TitreCarte>
      {statut === 'pret' ? (
        <>
          <p className="m-0 text-sm text-encre-2">{T.phrase}</p>
          <div className="flex flex-col">
            <Interrupteur
              libelle={T.analyser}
              detail={T.analyserDetail}
              actif={preferences.analyser}
              fige={occupe || estFigee(preferences, 'analyser')}
              onBasculer={() => void changer('analyser')}
            />
            <Interrupteur
              libelle={T.gerer}
              detail={T.gererDetail}
              actif={preferences.gerer}
              fige={occupe || estFigee(preferences, 'gerer')}
              onBasculer={() => void changer('gerer')}
            />
          </div>
          {echec !== null && (
            <p
              role="alert"
              className="m-0 rounded-encart bg-probleme-fond p-3 text-sm text-probleme-texte"
            >
              {echec}
            </p>
          )}
          <p className="m-0 text-xs text-encre-3">{T.auMoinsUne}</p>
        </>
      ) : (
        <p className="m-0 text-sm text-encre-3">
          {statut === 'erreur' ? ERREURS_GESTION.indisponible : T.chargement}
        </p>
      )}
    </Carte>
  );
}
