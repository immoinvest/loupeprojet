import { Info as IconeInfo } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState, type JSX } from 'react';

import { useModeDocument } from './document';

/** Largeur de la bulle et marge minimale au bord de l'écran, en pixels. */
const LARGEUR_BULLE = 320;
const MARGE_ECRAN = 16;

/**
 * Décalage horizontal de la bulle par rapport au bord gauche de son bouton, pour qu'elle tienne
 * dans l'écran : alignée sur le bouton quand la place suffit, ramenée vers la gauche sinon, et
 * jamais à moins de 16 px du bord gauche.
 */
export function decalageBulle(gaucheBouton: number, largeurEcran: number): number {
  const largeur = Math.min(LARGEUR_BULLE, largeurEcran - 2 * MARGE_ECRAN);
  const gauche = Math.max(
    MARGE_ECRAN,
    Math.min(gaucheBouton, largeurEcran - MARGE_ECRAN - largeur),
  );
  return gauche - gaucheBouton;
}

/**
 * Icône ⓘ qui ouvre une courte explication (bulle) au clic ou au focus clavier ; Échap, un clic
 * ailleurs ou la perte du focus la ferment. Dans un document, l'explication est un simple
 * paragraphe : le papier n'a pas de bulles.
 */
export function Info({ sujet, texte }: { sujet: string; texte: string }): JSX.Element {
  const document = useModeDocument();
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const [decalage, setDecalage] = useState(0);
  const racine = useRef<HTMLSpanElement>(null);

  // Position calculée à l'ouverture, depuis le bord du conteneur (le bouton déborde de 10 px
  // par ses marges négatives) : la bulle ne dépasse jamais de l'écran.
  useLayoutEffect(() => {
    if (!ouvert || racine.current === null) return;
    const { left } = racine.current.getBoundingClientRect();
    setDecalage(decalageBulle(left, window.document.documentElement.clientWidth));
  }, [ouvert]);

  useEffect(() => {
    if (!ouvert) return;
    const surPointeur = (e: PointerEvent): void => {
      if (!(e.target instanceof Node) || racine.current?.contains(e.target) !== true) {
        setOuvert(false);
      }
    };
    const surTouche = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOuvert(false);
    };
    window.document.addEventListener('pointerdown', surPointeur);
    window.document.addEventListener('keydown', surTouche);
    return () => {
      window.document.removeEventListener('pointerdown', surPointeur);
      window.document.removeEventListener('keydown', surTouche);
    };
  }, [ouvert]);

  if (document) return <p className="m-0 text-sm leading-relaxed text-encre-2">{texte}</p>;

  return (
    <span ref={racine} className="relative inline-flex shrink-0">
      <button
        type="button"
        aria-label={`Explication : ${sujet}`}
        aria-expanded={ouvert}
        aria-controls={id}
        aria-describedby={id}
        // Le clic ne prend pas le focus : sinon le focus ouvrirait la bulle et le clic la refermerait.
        onMouseDown={(e) => {
          e.preventDefault();
        }}
        onClick={() => {
          setOuvert((o) => !o);
        }}
        onFocus={() => {
          setOuvert(true);
        }}
        onBlur={() => {
          setOuvert(false);
        }}
        className="-m-2.5 inline-flex h-11 w-11 items-center justify-center rounded-full text-encre-3 hover:text-accent aria-expanded:text-accent"
      >
        <IconeInfo size={20} aria-hidden="true" />
      </button>
      <span
        role="tooltip"
        id={id}
        hidden={!ouvert}
        style={{ left: decalage }}
        className="absolute top-full z-10 mt-0.5 w-[min(320px,calc(100vw-2rem))] rounded-encart border border-accent-bordure bg-surface p-3 text-left text-sm leading-relaxed font-normal tracking-normal text-encre-2 normal-case shadow-[0_10px_30px_rgba(35,39,47,0.12)]"
      >
        {texte}
      </span>
    </span>
  );
}
