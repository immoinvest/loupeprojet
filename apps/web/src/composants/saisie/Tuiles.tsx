import type { JSX, ReactNode } from 'react';

import { useModeDocument } from '@/composants/document';

export interface OptionTuile<V extends string> {
  readonly valeur: V;
  readonly libelle: string;
  /** Pictogramme décoratif placé avant le libellé (`aria-hidden` à la charge de l'appelant). */
  readonly icone?: ReactNode;
  readonly desactivee?: boolean;
}

export interface PropsTuiles<V extends string> {
  /** Nom du groupe de boutons radio, unique dans la page. */
  readonly nom: string;
  readonly options: readonly OptionTuile<V>[];
  /** `''` : aucune tuile choisie (inconnu). */
  readonly valeur: V | '';
  /** Reçoit `''` seulement si `effacable` : un second clic sur la tuile choisie la décoche. */
  readonly onChange: (valeur: V | '') => void;
  readonly effacable?: boolean;
  /** Id de l'élément qui nomme le groupe ; à défaut, `libelle` sert de nom accessible. */
  readonly idLibelle?: string | undefined;
  readonly libelle?: string | undefined;
  readonly decritPar?: string | undefined;
}

/**
 * Choisir parmi peu : des boutons radio natifs habillés en tuiles de 44 px (clavier, lecteurs d'écran).
 * Aucune connaissance du formulaire : la valeur est une chaîne, `''` quand rien n'est choisi.
 * Dans un document, seul le libellé retenu est écrit.
 */
export function Tuiles<V extends string>({
  nom,
  options,
  valeur,
  onChange,
  effacable = false,
  idLibelle,
  libelle,
  decritPar,
}: PropsTuiles<V>): JSX.Element {
  const document = useModeDocument();
  if (document) {
    const choisie = options.find((o) => o.valeur === valeur);
    return <span className="text-[15px] font-semibold">{choisie?.libelle ?? '—'}</span>;
  }
  return (
    <div
      role="radiogroup"
      aria-labelledby={idLibelle}
      aria-label={idLibelle === undefined ? libelle : undefined}
      aria-describedby={decritPar}
      className="flex flex-wrap gap-2"
    >
      {options.map((o) => {
        const choisi = o.valeur === valeur;
        return (
          <label
            key={o.valeur}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-sm font-semibold has-[:disabled]:opacity-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
              choisi
                ? 'border-accent bg-accent text-white'
                : 'border-bordure bg-surface text-encre-2 survol-fond'
            }`}
          >
            <input
              type="radio"
              name={nom}
              value={o.valeur}
              checked={choisi}
              disabled={o.desactivee === true}
              onChange={() => {
                onChange(o.valeur);
              }}
              // Un clic sur la tuile déjà choisie ne déclenche pas `change` : c'est ici qu'on la décoche.
              onClick={() => {
                if (choisi && effacable) onChange('');
              }}
              className="sr-only"
            />
            {o.icone}
            {o.libelle}
          </label>
        );
      })}
    </div>
  );
}
