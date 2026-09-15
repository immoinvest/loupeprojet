import type { LigneLoyer } from '@loupe/gestion';
import { useState, type JSX } from 'react';

import { Bouton } from '@/composants/ui';
import { useEnvois } from '@/gestion/envois/EnvoisContext';
import { traceDuLoyer } from '@/gestion/envois/logique';
import { useGestion } from '@/gestion/GestionContext';
import {
  ERREURS_ENVOIS,
  renvoyerLaQuittanceDe,
  TEXTES_ENVOIS as T,
  traceEnvoi,
} from '@/textes/gerer-envois';
import { TEXTES_GERER } from '@/textes/gerer-ecrans';

/**
 * Sous une ligne de loyer : « Envoyée le 06/10 à julie@… » et « Renvoyer » (G2-2), quand la quittance
 * du mois est partie par e-mail. Rien sinon.
 */
export function TraceEnvoi({ ligne }: { readonly ligne: LigneLoyer }): JSX.Element | null {
  const envois = useEnvois();
  const { donnees } = useGestion();
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const trace = traceDuLoyer(
    envois.donnees,
    donnees?.documents ?? [],
    ligne.location.id,
    ligne.du.periode,
  );
  if (trace === null) return null;

  const renvoyer = async (): Promise<void> => {
    setOccupe(true);
    const r = await envois.renvoyer(trace.document.id);
    setOccupe(false);
    setErreur(r.ok ? null : ERREURS_ENVOIS[r.code]);
  };

  return (
    <div className="col-span-full flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
      {trace.envois.map((envoi) => (
        <p
          key={envoi.id}
          className={`m-0 text-sm ${envoi.statut === 'echec' ? 'text-probleme-texte' : 'text-encre-3'}`}
        >
          {traceEnvoi(envoi)}
        </p>
      ))}
      <Bouton
        disabled={occupe}
        title={renvoyerLaQuittanceDe(ligne.locataire?.prenom ?? TEXTES_GERER.tonLocataire)}
        onClick={() => void renvoyer()}
      >
        {T.renvoyer}
      </Bouton>
      {erreur !== null && (
        <p role="alert" className="m-0 basis-full text-right text-sm text-probleme-texte">
          {erreur}
        </p>
      )}
    </div>
  );
}
