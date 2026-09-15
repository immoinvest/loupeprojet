import { Calculator, House, X } from 'lucide-react';
import { useEffect, useRef, type JSX } from 'react';
import { NavLink } from 'react-router';

import { useGestion } from '@/gestion/GestionContext';
import { LogotypeDeklic } from '@/marque/Logo';
import { TEXTES_LOGO } from '@/textes/accueil';
import { TEXTES_MENU } from '@/textes/gerer';

import { CLASSE_ETIQUETTE, classeLien as lien } from './liens';
import { Profil } from './Profil';
import { SectionAnalyser } from './SectionAnalyser';
import { SectionGerer } from './SectionGerer';

/** Identifiant de la navigation principale, visé par le bouton de menu (`aria-controls`). */
export const ID_NAVIGATION = 'navigation-principale';

/**
 * Sous 1 024 px, la barre latérale est un tiroir. À l'ouverture, il devient visible tout de suite
 * (sinon le focus ne peut pas y entrer) ; à la fermeture, il ne disparaît qu'une fois sorti de l'écran.
 */
const ETAT_TIROIR = {
  ouvert: 'visible translate-x-0 shadow-carte transition-[translate]',
  ferme: 'invisible -translate-x-full transition-[translate,visibility]',
} as const;

/**
 * La barre latérale tient dans la hauteur de l'écran, en trois zones : le haut (logo, Accueil) et le bas
 * (outils, profil) ne bougent jamais ; entre les deux, les sections Analyser et Gérer, chacune
 * ouverte par son action de création, sont les seules à défiler quand elles sont longues.
 */
export function Sidebar({
  ouvert,
  onFermer,
}: {
  ouvert: boolean;
  onFermer: () => void;
}): JSX.Element {
  const { sections } = useGestion();
  const fermerRef = useRef<HTMLButtonElement>(null);

  // À l'ouverture du tiroir, le focus entre dedans.
  useEffect(() => {
    if (ouvert) fermerRef.current?.focus();
  }, [ouvert]);

  return (
    <aside
      id={ID_NAVIGATION}
      data-ouvert={ouvert}
      className={`fixed inset-y-0 left-0 z-40 flex w-[min(20rem,85vw)] flex-col gap-5 overflow-hidden border-r border-bordure bg-surface pt-[max(1.25rem,env(safe-area-inset-top))] pr-3 pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] transition-[translate,visibility] duration-200 motion-reduce:transition-none ${
        ouvert ? ETAT_TIROIR.ouvert : ETAT_TIROIR.ferme
      } lg:visible lg:static lg:z-auto lg:h-full lg:min-h-0 lg:w-auto lg:translate-x-0 lg:shadow-none lg:transition-none print:hidden`}
    >
      <div className="flex shrink-0 items-center justify-between gap-2">
        <NavLink
          to="/"
          aria-label={TEXTES_LOGO}
          className="flex items-center rounded-encart px-2 py-1 survol-fond pointer-coarse:min-h-11"
        >
          <LogotypeDeklic hauteur={26} />
        </NavLink>
        <button
          ref={fermerRef}
          type="button"
          onClick={onFermer}
          aria-label="Fermer le menu"
          className="flex h-11 w-11 items-center justify-center rounded-full text-encre-2 survol-fond lg:hidden"
        >
          <X size={22} aria-hidden="true" />
        </button>
      </div>

      <nav aria-label={TEXTES_MENU.accueil} className="-mt-2 flex shrink-0 flex-col">
        <NavLink to="/" end className={lien}>
          <House size={18} className="shrink-0" aria-hidden="true" />
          {TEXTES_MENU.accueil}
        </NavLink>
      </nav>

      {/* La zone qui défile garde 4 px de marge : le cadre de focus des liens n'est pas coupé. */}
      <div
        data-zone="defilante"
        className="-mx-1 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-1"
      >
        {sections.analyser && <SectionAnalyser />}
        {sections.gerer && <SectionGerer />}
      </div>

      {/* L'extension et l'installation de l'application sont dans Mon compte (« Deklic sur vos appareils »). */}
      <div className="flex shrink-0 flex-col gap-5">
        <nav aria-label="Outils" className="flex flex-col gap-1">
          <div className={CLASSE_ETIQUETTE}>Outils</div>
          <NavLink to="/simulateur-pret" className={lien}>
            <Calculator size={18} className="shrink-0" aria-hidden="true" />
            <span className="truncate">Simulateur de prêt</span>
          </NavLink>
        </nav>
        <Profil />
      </div>
    </aside>
  );
}
