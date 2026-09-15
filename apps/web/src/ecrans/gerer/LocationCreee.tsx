import type { JSX } from 'react';
import { Link, useLocation } from 'react-router';

import { lienFicheLocataire, locationCreee } from '@/gestion/parcours';
import { locationCreeeMessage, TEXTES_PARCOURS as P } from '@/textes/gerer-parcours';

/**
 * Le message qui accueille le retour de « Nouveau locataire » : « Léa Bernard loue Parking Prado. »
 * et le lien vers sa fiche (sauf sur cette fiche). Rien sans location créée dans l'état de navigation.
 */
export function LocationCreee(): JSX.Element | null {
  const location = useLocation();
  const loue = locationCreee(location.state);
  if (loue === null) return null;
  const fiche = lienFicheLocataire(loue.locataireId);
  const { pathname } = location;
  return (
    <p
      role="status"
      className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-encart bg-bon-fond p-3 text-sm text-bon-texte"
    >
      <span>{locationCreeeMessage(loue.locataire, loue.bien)}</span>
      {pathname !== fiche && (
        <Link
          to={fiche}
          className="font-semibold text-bon-texte survol-texte pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
        >
          {P.voirSaFiche}
        </Link>
      )}
    </p>
  );
}
