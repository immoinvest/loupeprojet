import type { Locataire } from '@loupe/gestion';
import { Fragment, type JSX } from 'react';
import { Link } from 'react-router';

import { lienFicheLocataire } from '@/gestion/parcours';
import { separateurNom } from '@/textes/gerer-loyers';

/**
 * « Julie Martin et Léa Bernard » où chaque nom mène à la fiche du locataire. Au doigt, chaque
 * lien prend 44 px de haut.
 */
export function NomsDeLocataires({
  locataires,
  className = '',
}: {
  readonly locataires: readonly Locataire[];
  readonly className?: string;
}): JSX.Element {
  return (
    <span className={className}>
      {locataires.map((locataire, rang) => (
        <Fragment key={locataire.id}>
          {separateurNom(rang, locataires.length)}
          <Link
            to={lienFicheLocataire(locataire.id)}
            className="font-semibold pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
          >
            {`${locataire.prenom} ${locataire.nom}`}
          </Link>
        </Fragment>
      ))}
    </span>
  );
}
