import type { Resultats } from '@loupe/moteur';
import { ArrowLeft, X } from 'lucide-react';
import { useState, type JSX } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useModeDocument } from '@/composants/document';
import { MARGES_LATERALES } from '@/composants/mise-en-page';
import { Bouton } from '@/composants/ui';
import { effetsDe } from '@/hypotheses/effet';
import { lireDepuis } from '@/hypotheses/liens';
import { TEXTES_LIENS, phraseEffet } from '@/textes/liens';

/**
 * Après un lien d'hypothèse (« 980 € » du Rapport) : un bandeau « Revenir à Rapport » en haut du
 * volet, puis, dès que la modification recalcule le projet, un message qui en dit l'effet
 * (« Loyer : 980 € → 1 300 €. Cash-flow : −210 €/mois → +91 €/mois. »). Revenir passe par
 * l'historique : le volet d'origine retrouve sa position. Rien sans origine, rien sur papier.
 */
export function RetourEtEffet({ resultats }: { resultats: Resultats }): JSX.Element | null {
  // Une nouvelle entrée d'historique repart de zéro : nouvelle photo des résultats, message fermé.
  const { key } = useLocation();
  return <Retour key={key} resultats={resultats} />;
}

function Retour({ resultats }: { resultats: Resultats }): JSX.Element | null {
  const location = useLocation();
  const naviguer = useNavigate();
  const document = useModeDocument();
  const [photo] = useState(resultats);
  const [fermee, setFermee] = useState<string | null>(null);
  const depuis = lireDepuis(location.state);
  if (document || depuis === null || depuis.pathname === location.pathname) return null;

  const effet = photo === resultats ? null : effetsDe(photo, resultats, depuis.chemin);
  const phrase = effet === null ? null : phraseEffet(effet);
  const libelleRetour = TEXTES_LIENS.revenir(depuis.origine);
  const revenir = (): void => {
    // Ouvert directement avec son état (rechargement d'un onglet neuf) : pas d'entrée précédente.
    if (location.key === 'default') void naviguer(depuis.pathname);
    else void naviguer(-1);
  };

  return (
    <>
      <div className={`${MARGES_LATERALES} pt-3 print:hidden`}>
        <button
          type="button"
          onClick={revenir}
          className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-bold text-accent survol-texte"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          {libelleRetour}
        </button>
      </div>
      {/* Région annoncée présente avant le message, pour que les lecteurs d'écran le lisent. */}
      <div role="status" aria-live="polite" className="print:hidden">
        {phrase !== null && phrase !== fermee && (
          <div className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 mx-auto flex max-w-xl flex-wrap items-center gap-x-3 gap-y-2 rounded-carte border border-accent-bordure bg-surface p-4 shadow-[0_10px_30px_rgba(35,39,47,0.12)]">
            <p className="m-0 min-w-0 flex-1 basis-60 text-[15px] leading-relaxed text-encre-2">
              {phrase}
            </p>
            <Bouton variante="primaire" onClick={revenir}>
              {libelleRetour}
            </Bouton>
            <button
              type="button"
              aria-label={TEXTES_LIENS.fermer}
              onClick={() => {
                setFermee(phrase);
              }}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-encre-3 survol-fond"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
