import { LogIn, LogOut } from 'lucide-react';
import { useState, type JSX } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';

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
 * Le bas de la barre latérale : « Sans compte » et un bouton « Se connecter », ou la personne
 * connectée avec, à côté, un bouton « Se déconnecter » toujours visible (comme dans la plupart des
 * applications en ligne). Tout tient dans le menu, qui mesure 224 px.
 */
export function Profil(): JSX.Element {
  const { etat, utilisateur, deconnecter } = useCompte();
  const { projets } = useProjets();
  const naviguer = useNavigate();
  const { pathname } = useLocation();
  const [occupe, setOccupe] = useState(false);
  const compteur = `${String(projets.length)} ${projets.length > 1 ? 'projets' : 'projet'}`;

  if (etat === 'connecte' && utilisateur !== null) {
    const sortir = async (): Promise<void> => {
      setOccupe(true);
      // La page Mon compte n'a plus de sens sans session : on revient à Mes projets avant de sortir.
      if (pathname.startsWith('/compte')) void naviguer('/projets');
      await deconnecter();
      setOccupe(false);
    };
    return (
      <div className="flex items-center gap-1 border-t border-bordure pt-3">
        <NavLink
          to="/compte"
          className="flex min-w-0 flex-1 items-center gap-3 rounded-encart px-2 py-1 text-encre no-underline hover:bg-accent-fond hover:text-accent"
        >
          <Pastille texte={initiales(utilisateur)} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[15px] font-bold">{nomAffiche(utilisateur)}</span>
            <span className="truncate text-xs text-encre-3">
              {TEXTES_MON_COMPTE.titre} · {compteur}
            </span>
          </span>
        </NavLink>
        <button
          type="button"
          disabled={occupe}
          onClick={() => {
            void sortir();
          }}
          aria-label={TEXTES_MON_COMPTE.deconnecter}
          title={TEXTES_MON_COMPTE.deconnecter}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-encre-2 hover:bg-probleme-fond hover:text-probleme-texte disabled:opacity-50"
        >
          <LogOut size={20} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-bordure px-2 pt-3">
      <div className="flex items-center gap-3">
        <Pastille texte="?" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-bold">{TEXTES_MON_COMPTE.sansCompte}</span>
          <span className="truncate text-xs text-encre-3">
            {TEXTES_MON_COMPTE.gratuit} · {compteur}
          </span>
        </div>
      </div>
      <NavLink
        to="/connexion"
        className="flex min-h-[44px] items-center justify-center gap-2 rounded-encart border border-bordure bg-surface px-3 text-sm font-semibold text-encre-2 no-underline hover:bg-accent-fond hover:text-accent"
      >
        <LogIn size={18} aria-hidden="true" />
        {TEXTES_MON_COMPTE.seConnecter}
      </NavLink>
    </div>
  );
}
