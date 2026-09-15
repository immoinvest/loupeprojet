import { Plus, type LucideIcon } from 'lucide-react';
import type { JSX } from 'react';
import { NavLink, useMatch } from 'react-router';

import { classeAjout, classeLibelleLigne, classeLigneAvecAjout, classeNombre } from './liens';

/**
 * Une ligne du menu qui a l'air d'un seul bouton mais porte deux liens (un lien dans un lien est
 * interdit) : l'icône, le libellé et son nombre ouvrent la liste, le « + » crée. Sur la liste, toute
 * la ligne est surlignée ; sur la page de création, seul le « + » passe en accent plein. Le « + » a
 * toujours un nom accessible et une infobulle : seul, il est moins explicite qu'un libellé.
 */
export function LigneAvecAjout({
  vers,
  icone: Icone,
  libelle,
  nombre,
  versAjout,
  libelleAjout,
  end = true,
}: {
  readonly vers: string;
  readonly icone: LucideIcon;
  readonly libelle: string;
  /** `null` tant que le nombre n'est pas connu (biens en cours de chargement) : pas de pastille. */
  readonly nombre: number | null;
  readonly versAjout: string;
  readonly libelleAjout: string;
  /** `false` : les pages sous `vers` (la fiche d'un bien) gardent la ligne active. */
  readonly end?: boolean;
}): JSX.Element {
  const ligneActive = useMatch({ path: vers, end }) !== null;
  return (
    <div className={classeLigneAvecAjout(ligneActive)}>
      {/* Nom accessible « Mes projets · 4 » : sans lui, libellé et pastille seraient lus collés. */}
      <NavLink
        to={vers}
        end={end}
        aria-label={nombre === null ? undefined : `${libelle} · ${String(nombre)}`}
        className={classeLibelleLigne}
      >
        {({ isActive }) => (
          <>
            <Icone size={18} aria-hidden="true" />
            <span className="flex-1 truncate">{libelle}</span>
            {nombre !== null && <span className={classeNombre(isActive)}>{nombre}</span>}
          </>
        )}
      </NavLink>
      <NavLink
        to={versAjout}
        aria-label={libelleAjout}
        title={libelleAjout}
        className={classeAjout}
      >
        <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
      </NavLink>
    </div>
  );
}
