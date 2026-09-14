import { Check, Share2, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type JSX } from 'react';

import { capacitesDuNavigateur, donneesPartage, estAnnulation, modePartage } from '@/application';
import { Bouton } from '@/composants/ui';
import { lienPartage } from '@/stockage/partage';
import type { ProjetEnregistre } from '@/stockage/projets';
import { AVERTISSEMENT_PARTAGE, TEXTES_PARTAGE_PROJET as T } from '@/textes/partage';

type Copie = 'en-cours' | 'copie' | 'refusee';

/**
 * Partage le lien du projet : le bouton ouvre une boîte où le lien est déjà copié ; si le
 * presse-papiers refuse, il reste à sélectionner à la main. Au doigt, « Envoyer » ouvre en plus la
 * feuille de partage du téléphone. La boîte rappelle toujours ce que contient le lien.
 */
export function BoutonPartager({ enregistre }: { enregistre: ProjetEnregistre }): JSX.Element {
  const [ouverte, setOuverte] = useState(false);
  const [copie, setCopie] = useState<Copie>('en-cours');
  const [envoye, setEnvoye] = useState(false);
  const cadreRef = useRef<HTMLDivElement>(null);
  const champRef = useRef<HTMLInputElement>(null);
  const titreId = useId();
  const lien = lienPartage(window.location.origin, enregistre);
  const auDoigt = modePartage(capacitesDuNavigateur(window)) === 'natif';

  const copier = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(lien);
      setCopie('copie');
    } catch {
      setCopie('refusee');
    }
  };

  const ouvrir = (): void => {
    setCopie('en-cours');
    setEnvoye(false);
    setOuverte(true);
    void copier();
  };

  // Fermée par le bouton ou Échap, la boîte rend le focus au bouton Partager.
  const fermer = (): void => {
    setOuverte(false);
    cadreRef.current?.querySelector<HTMLButtonElement>('button[aria-haspopup]')?.focus();
  };

  // Le lien est sélectionné à l'ouverture ; Échap ou un clic ailleurs referment la boîte.
  useEffect(() => {
    if (!ouverte) return undefined;
    champRef.current?.focus();
    const touche = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      setOuverte(false);
      cadreRef.current?.querySelector<HTMLButtonElement>('button[aria-haspopup]')?.focus();
    };
    const clic = (e: PointerEvent): void => {
      if (e.target instanceof Node && cadreRef.current?.contains(e.target) === false) {
        setOuverte(false);
      }
    };
    document.addEventListener('keydown', touche);
    document.addEventListener('pointerdown', clic);
    return () => {
      document.removeEventListener('keydown', touche);
      document.removeEventListener('pointerdown', clic);
    };
  }, [ouverte]);

  const envoyer = async (): Promise<void> => {
    try {
      await navigator.share(donneesPartage(enregistre.nom, lien));
      setEnvoye(true);
    } catch (erreur) {
      // Feuille fermée sans choisir : rien à dire. Refusée : le lien reste à copier dans la boîte.
      if (!estAnnulation(erreur)) champRef.current?.focus();
    }
  };

  return (
    <div ref={cadreRef} className="md:relative">
      <Bouton
        variante="primaire"
        title={AVERTISSEMENT_PARTAGE}
        ouvre={ouverte}
        onClick={() => {
          if (ouverte) fermer();
          else ouvrir();
        }}
      >
        <Share2 size={18} className="shrink-0" aria-hidden="true" />
        {T.partager}
      </Bouton>
      {ouverte && (
        <div
          role="dialog"
          aria-labelledby={titreId}
          className="fixed inset-x-4 bottom-4 z-30 flex flex-col gap-3 rounded-carte border border-bordure bg-surface p-4 shadow-carte md:absolute md:inset-x-auto md:top-full md:right-0 md:bottom-auto md:mt-2 md:w-[400px]"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 id={titreId} className="m-0 font-display text-lg font-semibold">
              {T.titre}
            </h2>
            <button
              type="button"
              aria-label={T.fermer}
              onClick={fermer}
              className="inline-flex size-11 items-center justify-center rounded-full text-encre-3 survol-fond hover:text-encre"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <input
            ref={champRef}
            readOnly
            aria-label={T.lien}
            value={lien}
            onFocus={(e) => {
              e.currentTarget.select();
            }}
            className="min-h-[44px] w-full min-w-0 rounded-full border border-bordure bg-fond px-3 text-xs text-encre-2 pointer-coarse:text-base"
          />
          {/* Toujours présent pour être annoncé ; « Lien copié » se lit déjà sur le bouton. */}
          <p
            role="status"
            className={
              copie === 'refusee' || envoye
                ? `m-0 text-sm font-semibold ${envoye ? 'text-bon-texte' : 'text-probleme-texte'}`
                : 'sr-only'
            }
          >
            {envoye
              ? T.partage
              : copie === 'copie'
                ? T.copie
                : copie === 'refusee'
                  ? T.copieRefusee
                  : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <Bouton onClick={() => void copier()}>
              {copie === 'copie' && <Check size={18} className="shrink-0" aria-hidden="true" />}
              {copie === 'copie' ? T.copie : T.copier}
            </Bouton>
            {auDoigt && (
              <Bouton variante="primaire" onClick={() => void envoyer()}>
                <Share2 size={18} className="shrink-0" aria-hidden="true" />
                {T.envoyer}
              </Bouton>
            )}
          </div>
          <p className="m-0 text-xs text-encre-3">{T.avertissement}</p>
        </div>
      )}
    </div>
  );
}
