import { Pencil } from 'lucide-react';
import type { JSX, MouseEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router';

import { montrerChamp } from '@/coque/champ-cible';
import {
  descripteurLie,
  lienHypothese,
  origineDepuisChemin,
  type CheminLie,
} from '@/hypotheses/liens';
import { TEXTES_LIENS } from '@/textes/liens';

import { useModeDocument } from './document';

/** Clic du milieu, Ctrl, Cmd, Maj ou Alt : le navigateur ouvre le lien ailleurs, on le laisse faire. */
const clicModifie = (e: MouseEvent): boolean =>
  e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;

/**
 * Un chiffre qui repose sur une hypothèse, cliquable : souligné pointillé, crayon au survol. Si le
 * champ est affiché dans la page (Financement : l'apport), on y défile ; sinon on ouvre le volet qui
 * le porte, au champ, avec l'origine pour revenir. Le texte visible ne change pas (le nom accessible
 * dit ce qu'on modifie). Dans un document, le chiffre seul.
 *
 * `projetId` : un autre projet que celui de la page (Comparer).
 */
export function ValeurHypothese({
  chemin,
  children,
  projetId,
}: {
  chemin: CheminLie;
  children: string;
  projetId?: string;
}): JSX.Element {
  const document = useModeDocument();
  const { pathname } = useLocation();
  const { id } = useParams();
  const projet = projetId ?? id;
  if (document || projet === undefined) return <>{children}</>;

  const origine = origineDepuisChemin(pathname);
  const lien = lienHypothese(projet, chemin, origine === null ? undefined : { pathname, origine });
  const libelle = descripteurLie(chemin)?.libelle ?? chemin;

  return (
    <Link
      to={{ pathname: lien.pathname, hash: lien.hash }}
      state={lien.state}
      aria-label={TEXTES_LIENS.modifier(children, libelle)}
      onClick={(e) => {
        if (projet === id && !clicModifie(e) && montrerChamp(window.document, chemin)) {
          e.preventDefault();
        }
      }}
      className="group relative text-inherit underline decoration-encre-4 decoration-dotted underline-offset-4 survol-texte pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
    >
      {children}
      {/* Hors du flux : le chiffre ne bouge pas quand le crayon apparaît. */}
      <Pencil
        size={13}
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 -right-4 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
      />
    </Link>
  );
}
