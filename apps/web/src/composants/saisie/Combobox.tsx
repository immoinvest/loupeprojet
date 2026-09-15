import { useEffect, useId, useRef, useState, type JSX, type KeyboardEvent } from 'react';

import { indexActifApres } from './liste';

/** Anti-rebond par défaut : la recherche part 250 ms après la dernière frappe. */
export const DELAI_RECHERCHE_MS = 250;

export interface PropsCombobox<T> {
  /** Id de la saisie : le libellé du champ la nomme par `htmlFor`. */
  readonly id: string;
  readonly nom?: string | undefined;
  /** Le texte de la saisie, contrôlé par l'appelant. */
  readonly texte: string;
  /** À chaque frappe. Un changement de `texte` venu de l'appelant ne lance jamais de recherche. */
  readonly onTexte: (texte: string) => void;
  /**
   * La source des suggestions, injectée : réseau, mémoire… `signal` est annulé quand une frappe plus
   * récente la rend inutile. Rejeter la promesse ferme la liste sans message (l'appelant explique).
   */
  readonly chercher: (texte: string, signal: AbortSignal) => Promise<readonly T[]>;
  /** Faut-il chercher pour ce texte ? Défaut : deux caractères au moins. */
  readonly doitChercher?: (texte: string) => boolean;
  readonly delaiMs?: number;
  /** Clé unique d'une option (clé React et id de l'option). */
  readonly cleOption: (option: T) => string;
  readonly libelleOption: (option: T) => string;
  /** Précision affichée à droite du libellé (code postal, commune…). */
  readonly detailOption?: (option: T) => string | undefined;
  readonly onChoix: (option: T) => void;
  /** Une option à choisir sans demander pour ces résultats (ex. la seule commune d'un code postal). */
  readonly choixAutomatique?: (options: readonly T[], texte: string) => T | null;
  /** Texte d'une recherche sans résultat ; défaut « Aucun résultat ». */
  readonly messageAucun?: string;
  readonly decritPar?: string | undefined;
  readonly invalide?: boolean;
  readonly placeholder?: string | undefined;
  readonly inputMode?: 'text' | 'numeric';
  readonly autoComplete?: string;
}

const auMoinsDeux = (texte: string): boolean => texte.trim().length >= 2;

/**
 * Saisie avec suggestions, motif WAI-ARIA « combobox » à liste (autocomplétion `list`) : Flèche bas et
 * Flèche haut parcourent la liste, Entrée choisit, Échap et Tab la ferment ; un clic choisit aussi.
 * Aucune connaissance métier : la source, les libellés et le choix sont donnés par l'appelant.
 */
export function Combobox<T>({
  id,
  nom,
  texte,
  onTexte,
  chercher,
  doitChercher = auMoinsDeux,
  delaiMs = DELAI_RECHERCHE_MS,
  cleOption,
  libelleOption,
  detailOption,
  onChoix,
  choixAutomatique,
  messageAucun = 'Aucun résultat',
  decritPar,
  invalide = false,
  placeholder,
  inputMode = 'text',
  autoComplete = 'off',
}: PropsCombobox<T>): JSX.Element {
  const idListe = useId();
  const [options, setOptions] = useState<readonly T[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controleur = useRef<AbortController | null>(null);

  const annuler = (): void => {
    if (minuteur.current !== null) clearTimeout(minuteur.current);
    minuteur.current = null;
    controleur.current?.abort();
    controleur.current = null;
  };

  // Rien ne doit revenir après le démontage.
  useEffect(() => annuler, []);

  const fermer = (): void => {
    setOuvert(false);
    setActif(-1);
  };

  const choisir = (option: T): void => {
    annuler();
    setOptions([]);
    fermer();
    onChoix(option);
  };

  const lancer = (saisi: string): void => {
    annuler();
    if (!doitChercher(saisi)) {
      setOptions([]);
      fermer();
      return;
    }
    minuteur.current = setTimeout(() => {
      minuteur.current = null;
      const courant = new AbortController();
      controleur.current = courant;
      chercher(saisi, courant.signal).then(
        (trouvees) => {
          if (courant.signal.aborted) return;
          controleur.current = null;
          const automatique = choixAutomatique?.(trouvees, saisi) ?? null;
          if (automatique !== null) {
            choisir(automatique);
            return;
          }
          setOptions(trouvees);
          setActif(-1);
          setOuvert(true);
        },
        () => {
          if (courant.signal.aborted) return;
          controleur.current = null;
          setOptions([]);
          fermer();
        },
      );
    }, delaiMs);
  };

  const toucher = (e: KeyboardEvent<HTMLInputElement>): void => {
    const suivant = indexActifApres(e.key, actif, options.length);
    if (suivant !== null) {
      e.preventDefault();
      if (options.length > 0) setOuvert(true);
      setActif(suivant);
      return;
    }
    const option = options[actif];
    if (e.key === 'Enter' && ouvert && option !== undefined) {
      // Entrée choisit l'option active au lieu d'envoyer le formulaire.
      e.preventDefault();
      choisir(option);
    } else if ((e.key === 'Escape' && ouvert) || e.key === 'Tab') {
      if (e.key === 'Escape') e.preventDefault();
      fermer();
    }
  };

  const listeVisible = ouvert && options.length > 0;
  return (
    <div className="relative">
      <input
        id={id}
        name={nom}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={listeVisible}
        aria-controls={idListe}
        aria-activedescendant={
          listeVisible && actif >= 0 ? `${idListe}-${String(actif)}` : undefined
        }
        aria-describedby={decritPar}
        aria-invalid={invalide}
        value={texte}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        onChange={(e) => {
          onTexte(e.target.value);
          lancer(e.target.value);
        }}
        onKeyDown={toucher}
        onBlur={fermer}
        className={`min-h-[44px] w-full min-w-0 rounded-encart border bg-surface px-3 text-[15px] font-semibold pointer-coarse:text-base ${
          invalide ? 'border-probleme' : 'border-bordure'
        }`}
      />
      <ul
        id={idListe}
        role="listbox"
        hidden={!listeVisible}
        className="absolute inset-x-0 top-full z-20 m-0 mt-1 max-h-72 list-none overflow-auto rounded-encart border border-bordure bg-surface p-1 shadow-carte"
      >
        {options.map((option, i) => {
          const detail = detailOption?.(option);
          return (
            <li
              key={cleOption(option)}
              id={`${idListe}-${String(i)}`}
              role="option"
              aria-selected={i === actif}
              // Le clic ne retire pas le focus de la saisie : la liste ne se ferme pas avant le choix.
              onMouseDown={(e) => {
                e.preventDefault();
              }}
              onClick={() => {
                choisir(option);
              }}
              className={`flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-lg border border-transparent px-3 text-[15px] ${
                i === actif ? 'bg-accent-fond' : 'survol-fond'
              }`}
            >
              <span className="font-semibold">{libelleOption(option)}</span>
              {detail !== undefined && <span className="text-sm text-encre-3">{detail}</span>}
            </li>
          );
        })}
      </ul>
      <span role="status" className="sr-only">
        {ouvert
          ? options.length === 0
            ? messageAucun
            : `${String(options.length)} suggestion${options.length > 1 ? 's' : ''}`
          : ''}
      </span>
    </div>
  );
}
