import {
  useEffect,
  useId,
  useRef,
  type ChangeEvent,
  type CSSProperties,
  type JSX,
  type KeyboardEvent,
} from 'react';

import { useModeDocument } from './document';

/** Une valeur mise en avant sur la piste, expliquée dans la légende sous le curseur. */
export interface SeuilCurseur {
  readonly valeur: number;
  readonly libelle: string;
}

export interface PropsCurseur {
  /** Libellé visible, qui nomme aussi le curseur pour les lecteurs d'écran. */
  readonly libelle: string;
  /** `null` : pas encore de valeur ; le pouce reste au minimum et le texte dit `texteSansValeur`. */
  readonly valeur: number | null;
  /** Texte d'un curseur sans valeur (défaut « Je ne sais pas »). */
  readonly texteSansValeur?: string;
  readonly min: number;
  readonly max: number;
  /** Pas du curseur et des flèches du clavier (défaut 1). */
  readonly pas?: number;
  /** Valeur affichée à côté du libellé et dans la légende des seuils (« 12 ans », « −5 % »). */
  readonly formater: (valeur: number) => string;
  /** Texte annoncé par les lecteurs d'écran (« Dans 12 ans ») ; défaut : `formater`. */
  readonly texteValeur?: (valeur: number) => string;
  /** Graduations sous la piste. */
  readonly reperes?: readonly number[];
  /** Libellé d'une graduation ; défaut : le nombre tel quel. */
  readonly formaterRepere?: (valeur: number) => string;
  readonly seuils?: readonly SeuilCurseur[];
  /** À chaque mouvement, au pointeur comme au clavier. */
  readonly onChangement: (valeur: number) => void;
  /** Au relâchement du pointeur ou de la touche : le moment d'enregistrer. */
  readonly onValidation?: (valeur: number) => void;
}

const TOUCHES = new Set([
  'ArrowRight',
  'ArrowUp',
  'ArrowLeft',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
]);

function decimalesDe(pas: number): number {
  const [, fraction = ''] = String(pas).split('.');
  return fraction.length;
}

/** Ramène la valeur entre les bornes et efface les erreurs d'arrondi (0,1 + 0,2). */
export function bornerAuPas(valeur: number, min: number, max: number, pas: number): number {
  const bornee = Math.min(max, Math.max(min, valeur));
  return Number(bornee.toFixed(decimalesDe(pas)));
}

/** Valeur visée par une touche, ou `null` si la touche ne concerne pas le curseur. */
export function valeurApresTouche(
  touche: string,
  valeur: number,
  min: number,
  max: number,
  pas: number,
): number | null {
  // Page précédente / suivante : un dixième de l'étendue, arrondi au pas, au moins un pas.
  const page = Math.max(pas, Math.round((max - min) / 10 / pas) * pas);
  switch (touche) {
    case 'ArrowRight':
    case 'ArrowUp':
      return valeur + pas;
    case 'ArrowLeft':
    case 'ArrowDown':
      return valeur - pas;
    case 'PageUp':
      return valeur + page;
    case 'PageDown':
      return valeur - page;
    case 'Home':
      return min;
    case 'End':
      return max;
    default:
      return null;
  }
}

/**
 * Le pouce mesure 24 px : son centre va d'une demi-largeur du bord gauche à une demi-largeur du
 * bord droit. Repères (marges) et marques des seuils (bords de la couche) sont décalés d'autant.
 */
const DEMI_POUCE_MARGES = 'mx-3';
const DEMI_POUCE_BORDS = 'inset-x-3';

/**
 * Curseur contrôlé : un `<input type="range">` natif (rôle, toucher, `aria-valuetext`), stylé par
 * `.curseur`, dont le clavier est pris en main pour un comportement identique partout. Rien de
 * spécifique à un écran : bornes, formats, repères et seuils viennent des props.
 * En mode document, seul le texte « libellé valeur » est rendu.
 */
export function Curseur({
  libelle,
  valeur,
  texteSansValeur = 'Je ne sais pas',
  min,
  max,
  pas = 1,
  formater,
  texteValeur = formater,
  reperes = [],
  formaterRepere = String,
  seuils = [],
  onChangement,
  onValidation,
}: PropsCurseur): JSX.Element {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const document = useModeDocument();

  // React ne distingue pas le relâchement (`change` natif) du mouvement (`input`) : on écoute le
  // premier à la main, en lisant la valeur affichée par le champ.
  useEffect(() => {
    const champ = ref.current;
    if (champ === null || onValidation === undefined) return;
    const relacher = (): void => {
      onValidation(Number(champ.value));
    };
    champ.addEventListener('change', relacher);
    return () => {
      champ.removeEventListener('change', relacher);
    };
  }, [onValidation]);

  const texte = valeur === null ? texteSansValeur : formater(valeur);
  if (document) {
    return (
      <p className="m-0 text-[15px]">
        {libelle} <span className="font-bold">{texte}</span>
      </p>
    );
  }

  const position = (v: number): string => `${String(((v - min) / (max - min)) * 100)}%`;
  const style: CSSProperties & { '--curseur-part': string } = {
    '--curseur-part': position(valeur ?? min),
  };

  const bouger = (e: ChangeEvent<HTMLInputElement>): void => {
    onChangement(Number(e.currentTarget.value));
  };
  const toucher = (e: KeyboardEvent<HTMLInputElement>): void => {
    const visee = valeurApresTouche(e.key, valeur ?? min, min, max, pas);
    if (visee === null) return;
    e.preventDefault();
    const suivante = bornerAuPas(visee, min, max, pas);
    if (suivante !== valeur) onChangement(suivante);
  };
  const relacherTouche = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (TOUCHES.has(e.key)) onValidation?.(Number(e.currentTarget.value));
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-xs font-bold tracking-wide text-encre-3 uppercase">
          {libelle}
        </label>
        <span className="font-display text-[26px] leading-none font-bold sm:text-[30px]">
          {texte}
        </span>
      </div>
      <div className="relative">
        {seuils.length > 0 && (
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-y-0 ${DEMI_POUCE_BORDS}`}
          >
            <div className="absolute inset-x-0 top-1/2 h-0">
              {seuils.map((s) => (
                <span
                  key={s.valeur}
                  data-seuil={s.valeur}
                  className="absolute h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-encre-3"
                  style={{ left: position(s.valeur) }}
                />
              ))}
            </div>
          </div>
        )}
        <input
          ref={ref}
          id={id}
          type="range"
          min={min}
          max={max}
          step={pas}
          value={valeur ?? min}
          aria-valuetext={valeur === null ? texteSansValeur : texteValeur(valeur)}
          className="curseur relative"
          style={style}
          onChange={bouger}
          onKeyDown={toucher}
          onKeyUp={relacherTouche}
        />
      </div>
      {reperes.length > 0 && (
        <div
          aria-hidden="true"
          className={`relative h-4 text-xs font-semibold text-encre-3 ${DEMI_POUCE_MARGES}`}
        >
          {reperes.map((r) => (
            <span
              key={r}
              data-repere={r}
              className="absolute -translate-x-1/2"
              style={{ left: position(r) }}
            >
              {formaterRepere(r)}
            </span>
          ))}
        </div>
      )}
      {seuils.length > 0 && (
        <p className="m-0 text-xs text-encre-3">
          {seuils.map((s) => `${formater(s.valeur)} : ${s.libelle}`).join(' · ')}
        </p>
      )}
    </div>
  );
}
