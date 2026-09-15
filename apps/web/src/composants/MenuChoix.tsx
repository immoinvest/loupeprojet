import { Check } from 'lucide-react';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { indexParLettre, indexSuivant, placementListe } from './menu-choix';

export interface OptionChoix<T extends string> {
  readonly valeur: T;
  readonly libelle: string;
  /** Courte précision grise, après le libellé. */
  readonly precision?: string | undefined;
}

export interface GroupeChoix<T extends string> {
  /** Nom du groupe, lu par les lecteurs d'écran ; deux groupes sont séparés par un trait. */
  readonly nom: string;
  readonly options: readonly OptionChoix<T>[];
}

export interface MenuChoixProps<T extends string> {
  /** Nom de la liste (« Statut du projet »), lu avant la valeur choisie. */
  readonly libelle: string;
  readonly valeur: T;
  readonly groupes: readonly GroupeChoix<T>[];
  /** Appelé seulement quand la valeur change. */
  readonly onChoix: (valeur: T) => void;
  readonly classeBouton: string;
  /** Décor avant et après la valeur dans le bouton (point de couleur, chevron). */
  readonly avantValeur?: ReactNode;
  readonly apresValeur?: ReactNode;
  /** Décor de chaque option (point de couleur). */
  readonly decorOption?: (valeur: T) => ReactNode;
}

/**
 * Liste de choix aux couleurs de Deklic, à la place d'un `<select>` dont la liste ouverte est
 * dessinée par le système. Motif WAI-ARIA « listbox » : bouton `aria-haspopup`, liste qui prend le
 * focus et désigne l'option active par `aria-activedescendant`. Clavier : flèches, Début, Fin,
 * lettre tapée, Entrée ou Espace choisit, Échap et Tab ferment ; un clic dehors ferme. Sous 640 px,
 * la liste monte du bas de l'écran, sur un voile.
 */
export function MenuChoix<T extends string>({
  libelle,
  valeur,
  groupes,
  onChoix,
  classeBouton,
  avantValeur,
  apresValeur,
  decorOption,
}: MenuChoixProps<T>): JSX.Element {
  const id = useId();
  const idLibelle = `${id}-libelle`;
  const idValeur = `${id}-valeur`;
  const idListe = `${id}-liste`;
  const idOption = (index: number): string => `${id}-option-${String(index)}`;

  const options = groupes.flatMap((g) => g.options);
  const indexChoisi = Math.max(
    0,
    options.findIndex((o) => o.valeur === valeur),
  );
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(indexChoisi);
  const [placement, setPlacement] = useState<'dessous' | 'dessus'>('dessous');
  const racine = useRef<HTMLDivElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const liste = useRef<HTMLDivElement>(null);

  function ouvrir(): void {
    setActif(indexChoisi);
    setOuvert(true);
  }

  function fermer(): void {
    setOuvert(false);
    bouton.current?.focus();
  }

  function choisir(index: number): void {
    const option = options[index];
    fermer();
    if (option !== undefined && option.valeur !== valeur) onChoix(option.valeur);
  }

  // À l'ouverture : placement sous ou au-dessus du bouton, puis focus sur la liste.
  useLayoutEffect(() => {
    if (!ouvert || bouton.current === null || liste.current === null) return;
    const { top, bottom } = bouton.current.getBoundingClientRect();
    setPlacement(
      placementListe({ haut: top, bas: bottom }, liste.current.offsetHeight, window.innerHeight),
    );
    liste.current.focus();
  }, [ouvert]);

  // L'option active reste en vue quand la liste défile (petits écrans).
  useEffect(() => {
    if (!ouvert) return;
    const element = window.document.getElementById(idOption(actif));
    if (typeof element?.scrollIntoView === 'function') element.scrollIntoView({ block: 'nearest' });
  });

  useEffect(() => {
    if (!ouvert) return;
    const surPointeur = (e: PointerEvent): void => {
      if (!(e.target instanceof Node) || racine.current?.contains(e.target) !== true) {
        setOuvert(false);
      }
    };
    window.document.addEventListener('pointerdown', surPointeur);
    return () => {
      window.document.removeEventListener('pointerdown', surPointeur);
    };
  }, [ouvert]);

  function toucheBouton(e: KeyboardEvent<HTMLButtonElement>): void {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      ouvrir();
    }
  }

  function toucheListe(e: KeyboardEvent<HTMLDivElement>): void {
    if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      fermer();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choisir(actif);
      return;
    }
    const suivant = indexSuivant(actif, e.key, options.length);
    if (suivant !== null) {
      e.preventDefault();
      setActif(suivant);
      return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const parLettre = indexParLettre(
      options.map((o) => o.libelle),
      actif,
      e.key,
    );
    if (parLettre !== null) setActif(parLettre);
  }

  const choisie = options[indexChoisi];
  // Index de la première option de chaque groupe dans la liste à plat.
  const debuts = groupes.map((_, g) =>
    groupes.slice(0, g).reduce((n, precedent) => n + precedent.options.length, 0),
  );

  return (
    <div ref={racine} className="relative inline-flex">
      <span id={idLibelle} className="sr-only">
        {libelle}
      </span>
      <button
        ref={bouton}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        aria-controls={ouvert ? idListe : undefined}
        aria-labelledby={`${idLibelle} ${idValeur}`}
        onClick={() => {
          if (ouvert) fermer();
          else ouvrir();
        }}
        onKeyDown={toucheBouton}
        className={classeBouton}
      >
        {avantValeur}
        <span id={idValeur}>{choisie?.libelle}</span>
        {apresValeur}
      </button>
      {ouvert && (
        <>
          {/* Voile de la feuille du bas, sur téléphone seulement. */}
          <div
            aria-hidden="true"
            onClick={fermer}
            className="fixed inset-0 z-40 bg-encre/30 sm:hidden"
          />
          <div
            ref={liste}
            id={idListe}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={idLibelle}
            aria-activedescendant={idOption(actif)}
            onKeyDown={toucheListe}
            className={`z-50 flex flex-col gap-1 border border-bordure bg-surface p-1.5 shadow-[0_10px_30px_rgba(35,39,47,0.12)] outline-none motion-safe:animate-apparition max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[80dvh] max-sm:overflow-y-auto max-sm:rounded-t-carte max-sm:px-3 max-sm:pt-3 max-sm:pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:absolute sm:left-0 sm:w-max sm:min-w-60 sm:rounded-encart ${
              placement === 'dessus' ? 'sm:bottom-full sm:mb-1.5' : 'sm:top-full sm:mt-1.5'
            }`}
          >
            <div
              aria-hidden="true"
              className="px-3 pb-2 text-xs font-bold tracking-wider text-encre-4 uppercase sm:hidden"
            >
              {libelle}
            </div>
            {groupes.map((groupe, g) => (
              <div
                key={groupe.nom}
                role="group"
                aria-label={groupe.nom}
                className={`flex flex-col gap-0.5 ${g > 0 ? 'mt-1 border-t border-bordure pt-1.5' : ''}`}
              >
                {groupe.options.map((option, j) => {
                  const i = (debuts[g] ?? 0) + j;
                  const choisi = option.valeur === valeur;
                  return (
                    <div
                      key={option.valeur}
                      id={idOption(i)}
                      role="option"
                      aria-selected={choisi}
                      onClick={() => {
                        choisir(i);
                      }}
                      onPointerMove={() => {
                        setActif(i);
                      }}
                      className={`flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-semibold text-encre max-sm:min-h-12 max-sm:text-base pointer-coarse:min-h-12 ${
                        i === actif ? 'bg-accent-fond' : ''
                      }`}
                    >
                      {decorOption?.(option.valeur)}
                      <span className="flex-1">
                        {option.libelle}
                        {option.precision !== undefined && (
                          <span className="ml-2 font-normal text-encre-3">{option.precision}</span>
                        )}
                      </span>
                      <Check
                        size={16}
                        strokeWidth={2.6}
                        aria-hidden="true"
                        className={`shrink-0 text-accent ${choisi ? '' : 'invisible'}`}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
