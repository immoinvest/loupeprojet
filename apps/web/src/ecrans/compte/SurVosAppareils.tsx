import { Check, Download, Puzzle } from 'lucide-react';
import { useEffect, useState, type JSX, type ReactNode } from 'react';

import { detecterExtension } from '@/annonces/extension';
import { Bouton, Carte, LienBouton, Pastille, TitreCarte } from '@/composants/ui';
import { useInstallation } from '@/coque/Installation';
import { TEXTES_APPAREILS as T, TEXTES_INSTALLATION } from '@/textes/application';

/** Une ligne de la carte : pictogramme, nom et phrase à gauche ; l'action ou l'état à droite. */
function Appareil({
  icone,
  titre,
  detail,
  children,
}: {
  icone: ReactNode;
  titre: string;
  detail: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-bordure-douce py-3 last:border-b-0 last:pb-0">
      <div className="flex min-w-48 flex-1 items-center gap-3">
        <div
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-encart bg-accent-doux text-accent"
        >
          {icone}
        </div>
        <div className="flex min-w-0 flex-col">
          <h3 className="m-0 text-[15px] font-bold text-encre">{titre}</h3>
          <p className="m-0 text-sm text-encre-3">{detail}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function Installee(): JSX.Element {
  return (
    <Pastille ton="bon" compacte>
      <Check size={14} aria-hidden="true" />
      {T.installee}
    </Pastille>
  );
}

/**
 * « Deklic sur vos appareils » : l'extension (installée si elle répond, sinon le lien vers sa page)
 * et l'application (bouton quand le navigateur propose l'installation, sinon la marche à suivre).
 */
export function SurVosAppareils(): JSX.Element {
  const installation = useInstallation();
  const [extension, setExtension] = useState(false);

  useEffect(() => {
    let actif = true;
    void detecterExtension(window).then((presente) => {
      if (actif) setExtension(presente);
    });
    return () => {
      actif = false;
    };
  }, []);

  return (
    <Carte className="gap-0">
      <div className="pb-2">
        <TitreCarte>{T.titre}</TitreCarte>
      </div>
      <Appareil icone={<Puzzle size={20} />} titre={T.extension} detail={T.extensionDetail}>
        {extension ? (
          <Installee />
        ) : (
          <LienBouton to="/extension">{T.installerExtension}</LienBouton>
        )}
      </Appareil>
      <Appareil icone={<Download size={20} />} titre={T.application} detail={T.applicationDetail}>
        {installation.etat === 'installee' ? (
          <Installee />
        ) : installation.etat === 'disponible' ? (
          <Bouton
            variante="primaire"
            onClick={() => {
              void installation.installer();
            }}
          >
            {TEXTES_INSTALLATION.bouton}
          </Bouton>
        ) : (
          <LienBouton to="/extension">{T.commentInstaller}</LienBouton>
        )}
      </Appareil>
    </Carte>
  );
}
