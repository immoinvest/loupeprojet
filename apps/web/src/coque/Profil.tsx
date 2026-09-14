import type { JSX } from 'react';
import { NavLink } from 'react-router';

import { useCompte } from '@/compte/CompteContext';
import { useProjets } from '@/stockage/ProjetsContext';
import { initiales, nomAffiche } from '@/textes/compte';
import { TEXTES_MON_COMPTE } from '@/textes/mon-compte';

/** Les initiales, jamais l'image d'un fournisseur : aucune ressource tierce chargée (vie privée). */
function Pastille({ texte }: { texte: string }): JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-doux font-display text-[15px] font-bold text-accent"
    >
      {texte}
    </div>
  );
}

/**
 * Le bas de la barre latérale : « Sans compte · Se connecter », ou la personne connectée. Tout
 * tient dans la colonne à droite de la pastille : le menu mesure 224 px.
 */
export function Profil(): JSX.Element {
  const { etat, utilisateur } = useCompte();
  const { projets } = useProjets();
  const compteur = `${String(projets.length)} ${projets.length > 1 ? 'projets' : 'projet'}`;

  if (etat === 'connecte' && utilisateur !== null) {
    return (
      <NavLink
        to="/compte"
        className="flex items-center gap-3 border-t border-bordure px-2 pt-3 text-encre no-underline hover:text-accent"
      >
        <Pastille texte={initiales(utilisateur)} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-bold">{nomAffiche(utilisateur)}</span>
          <span className="text-xs text-encre-3">
            {TEXTES_MON_COMPTE.titre} · {compteur}
          </span>
        </span>
      </NavLink>
    );
  }

  return (
    <div className="flex items-center gap-3 border-t border-bordure px-2 pt-3">
      <Pastille texte="?" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-bold">{TEXTES_MON_COMPTE.sansCompte}</span>
        <span className="text-xs text-encre-3">
          {TEXTES_MON_COMPTE.gratuit} · {compteur}
        </span>
        <NavLink
          to="/connexion"
          className="self-start text-sm font-bold whitespace-nowrap pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
        >
          {TEXTES_MON_COMPTE.seConnecter}
        </NavLink>
      </div>
    </div>
  );
}
