import { useEffect, useState, type JSX } from 'react';

import { Bouton } from '@/composants/ui';
import { lienPartage } from '@/stockage/partage';
import type { ProjetEnregistre } from '@/stockage/projets';
import { AVERTISSEMENT_PARTAGE } from '@/textes/partage';

type EtatPartage = 'repos' | 'copie' | 'manuel';

const DUREE_CONFIRMATION_MS = 2_500;

/**
 * Copie le lien de partage ; si le presse-papiers refuse, le lien s'affiche à copier à la main.
 * Sur téléphone, ce champ passe sous les boutons et prend toute la largeur.
 */
export function BoutonPartager({ enregistre }: { enregistre: ProjetEnregistre }): JSX.Element {
  const [etat, setEtat] = useState<EtatPartage>('repos');
  const lien = lienPartage(window.location.origin, enregistre);

  useEffect(() => {
    if (etat !== 'copie') return undefined;
    const minuteur = window.setTimeout(() => {
      setEtat('repos');
    }, DUREE_CONFIRMATION_MS);
    return () => {
      window.clearTimeout(minuteur);
    };
  }, [etat]);

  const partager = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(lien);
      setEtat('copie');
    } catch {
      setEtat('manuel');
    }
  };

  return (
    <>
      {etat === 'manuel' && (
        <input
          readOnly
          aria-label="Lien de partage"
          value={lien}
          onFocus={(e) => {
            e.currentTarget.select();
          }}
          className="order-last min-h-[44px] w-full min-w-0 rounded-full border border-bordure bg-surface px-3 text-xs sm:order-none sm:w-64 pointer-coarse:text-base"
        />
      )}
      <Bouton
        title={AVERTISSEMENT_PARTAGE}
        onClick={() => {
          void partager();
        }}
      >
        {etat === 'copie' ? 'Lien copié' : 'Partager'}
      </Bouton>
    </>
  );
}
