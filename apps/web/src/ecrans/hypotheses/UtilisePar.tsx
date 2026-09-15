import { Fragment, type JSX } from 'react';
import { Link, useLocation } from 'react-router';

import { useModeDocument } from '@/composants/document';
import { adresseDansProjet, origineDepuisChemin, utilisePar } from '@/hypotheses/liens';
import { LIBELLES_ORIGINE, TEXTES_LIENS } from '@/textes/liens';

/**
 * « Utilisé par : Rapport · Revente » sous un champ : les autres volets du projet qui affichent un
 * chiffre de cette hypothèse, en liens. Le chemin inverse des chiffres cliquables. Rien si aucun
 * autre volet ne la reprend, rien sur papier.
 */
export function UtilisePar({ chemin }: { chemin: string }): JSX.Element | null {
  const { pathname } = useLocation();
  const document = useModeDocument();
  const courant = origineDepuisChemin(pathname);
  const liens = utilisePar(chemin)
    .filter((v) => v !== courant)
    .flatMap((v) => {
      const adresse = adresseDansProjet(pathname, v);
      return adresse === null ? [] : [{ volet: v, adresse }];
    });
  if (document || liens.length === 0) return null;

  return (
    <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-encre-3">
      {TEXTES_LIENS.utilisePar}
      {liens.map(({ volet, adresse }, i) => (
        <Fragment key={volet}>
          {i > 0 && <span aria-hidden="true">·</span>}
          <Link
            to={adresse}
            className="font-semibold no-underline survol-texte pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:items-center pointer-coarse:justify-center"
          >
            {LIBELLES_ORIGINE[volet]}
          </Link>
        </Fragment>
      ))}
    </span>
  );
}
