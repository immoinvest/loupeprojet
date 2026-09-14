import { useEffect, useState, type JSX } from 'react';

import { capacitesDuNavigateur, donneesPartage, estAnnulation, modePartage } from '@/application';
import { Bouton } from '@/composants/ui';
import { lienPartage } from '@/stockage/partage';
import type { ProjetEnregistre } from '@/stockage/projets';
import { AVERTISSEMENT_PARTAGE, TEXTES_PARTAGE_PROJET as T } from '@/textes/partage';

type EtatPartage = 'repos' | 'copie' | 'partage' | 'manuel';

const DUREE_CONFIRMATION_MS = 2_500;

const LIBELLES: Readonly<Record<EtatPartage, string>> = {
  repos: T.partager,
  manuel: T.partager,
  copie: T.copie,
  partage: T.partage,
};

/**
 * Partage le lien du projet : feuille de partage du téléphone sur écran tactile, lien copié sinon ;
 * si le presse-papiers refuse, le lien s'affiche à copier à la main. Après un partage ou une copie,
 * un avertissement visible rappelle ce que contient le lien.
 */
export function BoutonPartager({ enregistre }: { enregistre: ProjetEnregistre }): JSX.Element {
  const [etat, setEtat] = useState<EtatPartage>('repos');
  const lien = lienPartage(window.location.origin, enregistre);
  const confirme = etat === 'copie' || etat === 'partage';

  useEffect(() => {
    if (!confirme) return undefined;
    const minuteur = window.setTimeout(() => {
      setEtat('repos');
    }, DUREE_CONFIRMATION_MS);
    return () => {
      window.clearTimeout(minuteur);
    };
  }, [confirme]);

  const copier = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(lien);
      setEtat('copie');
    } catch {
      setEtat('manuel');
    }
  };

  const partager = async (): Promise<void> => {
    if (modePartage(capacitesDuNavigateur(window)) === 'natif') {
      try {
        await navigator.share(donneesPartage(enregistre.nom, lien));
        setEtat('partage');
        return;
      } catch (erreur) {
        if (estAnnulation(erreur)) return;
        // Autre refus du navigateur : le lien est copié, comme sur ordinateur.
      }
    }
    await copier();
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
        {LIBELLES[etat]}
      </Bouton>
      {/* Toujours présente pour être annoncée ; visible, sous les boutons, après un partage ou une copie. */}
      <span
        role="status"
        className={
          confirme
            ? 'order-last basis-full text-xs text-encre-2 2xl:order-none 2xl:max-w-48 2xl:basis-auto'
            : 'sr-only'
        }
      >
        {confirme ? T.avertissement : ''}
      </span>
    </>
  );
}
