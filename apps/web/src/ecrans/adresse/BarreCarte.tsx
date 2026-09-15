import { useId, type JSX } from 'react';

import { FONDS_CARTE, type FondCarte, type ModeCouleur, type NiveauPoint } from '@/enrichissement';
import {
  LIBELLES_FONDS,
  LIBELLES_MODES,
  PHRASES_CARTE,
  type EntreeLegendeCouleur,
} from '@/textes/carte';

const PASTILLE: Readonly<Record<NiveauPoint, string>> = {
  bas: 'bg-bon',
  milieu: 'bg-encre-4',
  haut: 'bg-surveiller',
  inconnu: 'border border-encre-4 bg-surface',
};

const CHOIX =
  'inline-flex min-h-[36px] cursor-pointer items-center rounded-full border px-3 text-sm font-semibold survol-fond has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent pointer-coarse:min-h-11';
const CHOISI = 'border-accent bg-accent-fond text-accent';
const LIBRE = 'border-bordure bg-surface text-encre-2';
const BOUTON =
  'min-h-[36px] rounded-encart border border-bordure bg-surface px-3 text-sm font-semibold text-encre-2 survol-fond pointer-coarse:min-h-11';
const TITRE_GROUPE = 'float-left mr-2 py-2 text-sm font-semibold text-encre-2';

function Choix<T extends string>({
  nom,
  titre,
  valeurs,
  valeur,
  libelles,
  onChoix,
}: {
  nom: string;
  titre: string;
  valeurs: readonly T[];
  valeur: T;
  libelles: Readonly<Record<T, string>>;
  onChoix: (valeur: T) => void;
}): JSX.Element {
  return (
    <fieldset className="m-0 flex min-w-0 flex-wrap items-center gap-2 border-0 p-0">
      <legend className={TITRE_GROUPE}>{titre}</legend>
      {valeurs.map((v) => (
        <label key={v} className={`${CHOIX} ${v === valeur ? CHOISI : LIBRE}`}>
          <input
            type="radio"
            name={nom}
            value={v}
            checked={v === valeur}
            onChange={() => {
              onChoix(v);
            }}
            className="sr-only"
          />
          {libelles[v]}
        </label>
      ))}
    </fieldset>
  );
}

/**
 * Les réglages de la carte des ventes, hors de Leaflet : couleur des pastilles, fond, parcelles, recentrer, plein
 * écran ; puis la légende des couleurs.
 */
export function BarreCarte({
  modes,
  mode,
  onMode,
  fond,
  onFond,
  parcelles,
  onParcelles,
  pleinEcran,
  onPleinEcran,
  onRecentrer,
  legende,
}: {
  modes: readonly ModeCouleur[];
  mode: ModeCouleur;
  onMode: (mode: ModeCouleur) => void;
  fond: FondCarte;
  onFond: (fond: FondCarte) => void;
  parcelles: boolean;
  onParcelles: (parcelles: boolean) => void;
  pleinEcran: boolean;
  onPleinEcran: () => void;
  onRecentrer: () => void;
  legende: readonly EntreeLegendeCouleur[];
}): JSX.Element {
  const id = useId();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Choix
          nom={`${id}-couleur`}
          titre={PHRASES_CARTE.couleur}
          valeurs={modes}
          valeur={mode}
          libelles={LIBELLES_MODES}
          onChoix={onMode}
        />
        <Choix
          nom={`${id}-fond`}
          titre={PHRASES_CARTE.fond}
          valeurs={FONDS_CARTE}
          valeur={fond}
          libelles={LIBELLES_FONDS}
          onChoix={onFond}
        />
        <label className="inline-flex min-h-[36px] cursor-pointer items-center gap-2 text-sm font-semibold text-encre-2 pointer-coarse:min-h-11">
          <input
            type="checkbox"
            checked={parcelles}
            onChange={(e) => {
              onParcelles(e.target.checked);
            }}
            className="h-4 w-4 accent-accent"
          />
          {PHRASES_CARTE.parcelles}
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ul
          aria-label="Légende de la carte"
          className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-sm text-encre-2"
        >
          <li className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full bg-accent" />
            {PHRASES_CARTE.bien}
          </li>
          {legende.map((entree) => (
            <li key={entree.niveau} className="inline-flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`inline-block h-3 w-3 rounded-full ${PASTILLE[entree.niveau]}`}
              />
              {entree.libelle}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onRecentrer} className={BOUTON}>
            {PHRASES_CARTE.recentrer}
          </button>
          <button type="button" onClick={onPleinEcran} className={BOUTON}>
            {pleinEcran ? PHRASES_CARTE.fermer : PHRASES_CARTE.pleinEcran}
          </button>
        </div>
      </div>
    </div>
  );
}
