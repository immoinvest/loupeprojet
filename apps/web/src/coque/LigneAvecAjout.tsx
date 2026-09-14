import { Plus } from 'lucide-react';
import type { JSX } from 'react';
import { NavLink, useMatch } from 'react-router';

import { classeAjout, classeLibelleLigne, classeLigneAvecAjout } from './liens';

/**
 * Une ligne du menu qui a l'air d'un seul bouton mais porte deux liens (un lien dans un lien est
 * interdit) : le libellé et son compteur ouvrent la liste, le « + » crée. Sur la liste, toute la
 * ligne est surlignée ; sur la page de création, seul le « + » passe en accent plein. Le « + » a
 * toujours un nom accessible et une infobulle : seul, il est moins explicite qu'un libellé.
 */
export function LigneAvecAjout({
  vers,
  libelle,
  versAjout,
  libelleAjout,
}: {
  readonly vers: string;
  readonly libelle: string;
  readonly versAjout: string;
  readonly libelleAjout: string;
}): JSX.Element {
  const ligneActive = useMatch({ path: vers, end: true }) !== null;
  return (
    <div className={classeLigneAvecAjout(ligneActive)}>
      <NavLink to={vers} end className={classeLibelleLigne}>
        <span className="flex-1 truncate">{libelle}</span>
      </NavLink>
      <NavLink
        to={versAjout}
        aria-label={libelleAjout}
        title={libelleAjout}
        className={classeAjout(ligneActive)}
      >
        <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
      </NavLink>
    </div>
  );
}
