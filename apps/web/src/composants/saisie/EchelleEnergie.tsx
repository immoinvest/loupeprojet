import type { JSX } from 'react';

import { useModeDocument } from '@/composants/document';

import {
  LETTRES_ENERGIE,
  classesLettre,
  estLettreEnergie,
  type LettreEnergie,
  type VarianteEnergie,
} from './energie';

export interface PropsEchelleEnergie {
  /** Nom du groupe de boutons radio, unique dans la page. */
  readonly nom: string;
  readonly variante: VarianteEnergie;
  /** Une lettre de A à G, ou `''` (inconnu). */
  readonly valeur: string;
  readonly onChange: (valeur: LettreEnergie | '') => void;
  /** Id de l'élément qui nomme l'échelle (« DPE »). */
  readonly idLibelle: string;
  readonly decritPar?: string | undefined;
}

/**
 * L'étiquette que tout acheteur connaît : sept lettres colorées, un clic choisit, un second clic sur la
 * lettre choisie revient à « inconnu ». Boutons radio natifs (flèches du clavier, lecteurs d'écran).
 */
export function EchelleEnergie({
  nom,
  variante,
  valeur,
  onChange,
  idLibelle,
  decritPar,
}: PropsEchelleEnergie): JSX.Element {
  const document = useModeDocument();
  if (document) {
    return <span className="text-[15px] font-semibold">{valeur === '' ? '—' : valeur}</span>;
  }
  const choisie = estLettreEnergie(valeur) ? valeur : null;
  return (
    <div
      role="radiogroup"
      aria-labelledby={idLibelle}
      aria-describedby={decritPar}
      // Sept lettres de 44 px au moins : dans une colonne étroite (téléphone, liste de visite), l'échelle passe
      // sur deux lignes plutôt que de rétrécir ses cibles.
      className="grid grid-cols-[repeat(auto-fit,minmax(2.75rem,1fr))] gap-1"
    >
      {LETTRES_ENERGIE.map((lettre) => {
        const choisi = lettre === choisie;
        return (
          <label
            key={lettre}
            data-lettre={lettre}
            className={`flex min-h-[44px] items-center justify-center rounded-lg text-base font-bold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${classesLettre(variante, lettre)} ${
              choisi
                ? 'ring-3 ring-encre ring-offset-2'
                : `survol-pastille ${choisie === null ? '' : 'opacity-45'}`
            }`}
          >
            <input
              type="radio"
              name={nom}
              value={lettre}
              checked={choisi}
              onChange={() => {
                onChange(lettre);
              }}
              onClick={() => {
                if (choisi) onChange('');
              }}
              className="sr-only"
            />
            {lettre}
          </label>
        );
      })}
    </div>
  );
}
