import type { JSX } from 'react';
import { Link } from 'react-router';

import { Bouton, Carte, Pastille } from '@/composants/ui';
import { useInstallation } from '@/coque/Installation';
import { TEXTES_CARTE_TELEPHONE as T, TEXTES_INSTALLATION } from '@/textes/application';

/**
 * « Sur téléphone et tablette » : installer l'application (bouton quand le navigateur le permet,
 * sinon la marche à suivre Android et iPhone) et envoyer une annonce à Deklic.
 */
export function CarteTelephone({ className = '' }: { className?: string }): JSX.Element {
  const installation = useInstallation();
  return (
    <Carte className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="m-0 font-display text-[22px] font-semibold">{T.titre}</h2>
        <Pastille ton="bon" compacte>
          {T.appareils}
        </Pastille>
      </div>
      <p className="m-0 text-[15px] text-encre-2">{T.intro}</p>
      {installation.etat === 'installee' ? (
        <p className="m-0 text-[15px] font-semibold text-bon-texte">{T.installee}</p>
      ) : installation.etat === 'disponible' ? (
        <div>
          <Bouton
            variante="primaire"
            onClick={() => {
              void installation.installer();
            }}
          >
            {TEXTES_INSTALLATION.bouton}
          </Bouton>
        </div>
      ) : (
        <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-[15px] text-encre-2">
          <li>{T.installerAndroid}</li>
          <li>{T.installerIphone}</li>
        </ul>
      )}
      <h3 className="m-0 font-display text-lg font-semibold">{T.envoyerTitre}</h3>
      <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-[15px] text-encre-2">
        <li>{T.envoyerAndroid}</li>
        <li>
          {T.envoyerPartout}{' '}
          <Link to="/projets/nouveau" className="font-bold text-accent">
            Nouveau projet
          </Link>
        </li>
      </ul>
    </Carte>
  );
}
