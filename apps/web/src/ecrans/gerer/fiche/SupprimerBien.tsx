import type { BienGere } from '@loupe/gestion';
import { useState, type JSX } from 'react';
import { useNavigate } from 'react-router';

import { Bouton } from '@/composants/ui';
import { useGestion } from '@/gestion/GestionContext';
import { CHEMIN_EXPORT } from '@/gestion/reseau';
import { nomConfirme } from '@/gestion/saisie-modifier';
import { ERREURS_GESTION } from '@/textes/gerer';
import { confirmationSuppression, TEXTES_SUPPRIMER as T } from '@/textes/gerer-biens';

import { ChampGerer } from '../ChampGerer';

/**
 * « Supprimer ce bien » (clic 1) ouvre un encadré ; « Supprimer définitivement » (clic 2) ne s'active
 * qu'une fois le nom du bien tapé : jamais par erreur. Ensuite, retour sur « Mes biens » avec un message.
 */
export function SupprimerBien({ bien }: { readonly bien: BienGere }): JSX.Element {
  const { supprimerBien } = useGestion();
  const naviguer = useNavigate();
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  if (!ouvert) {
    return (
      <div>
        <button
          type="button"
          onClick={() => {
            setOuvert(true);
          }}
          className="inline-flex min-h-[44px] items-center rounded-full px-4 text-sm font-semibold text-probleme-texte survol-danger"
        >
          {T.supprimer}
        </button>
      </div>
    );
  }

  const supprimer = async (): Promise<void> => {
    setOccupe(true);
    const r = await supprimerBien(bien.id);
    if (r.ok) {
      void naviguer('/gerer/biens', { state: { supprime: bien.nom } });
      return;
    }
    setOccupe(false);
    setErreur(ERREURS_GESTION[r.code]);
  };

  return (
    <section
      aria-label={T.titre}
      className="flex flex-col gap-3 rounded-encart border border-probleme bg-probleme-fond p-4"
    >
      <h2 className="m-0 font-display text-lg font-bold text-probleme-texte">{T.titre}</h2>
      <p className="m-0 text-sm text-encre-2">{T.explication}</p>
      <p className="m-0 text-sm">
        <a href={CHEMIN_EXPORT} className="inline-flex items-center pointer-coarse:min-h-11">
          {T.exporter}
        </a>
      </p>
      <ChampGerer
        id="confirmation-suppression"
        libelle={confirmationSuppression(bien.nom)}
        valeur={nom}
        onChange={setNom}
        autoComplete="off"
      />
      <div className="flex flex-wrap gap-2">
        <Bouton
          disabled={occupe}
          onClick={() => {
            setOuvert(false);
            setNom('');
            setErreur(null);
          }}
        >
          {T.annuler}
        </Bouton>
        <button
          type="button"
          disabled={occupe || !nomConfirme(nom, bien.nom)}
          onClick={() => {
            void supprimer();
          }}
          className="inline-flex min-h-[44px] items-center rounded-full bg-probleme px-4 text-sm font-semibold text-white survol-danger-plein disabled:opacity-50"
        >
          {T.supprimerDefinitivement}
        </button>
      </div>
      {erreur !== null && (
        <p role="alert" className="m-0 text-sm font-semibold text-probleme-texte">
          {erreur}
        </p>
      )}
    </section>
  );
}
