import type { RaisonEchecLecture } from '@loupe/capture';
import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { Link } from 'react-router';

import { importerCapture, type AnnonceResolue, type CaptureImportee } from '@/annonces';
import { detecterExtension, lireParExtension } from '@/annonces/extension';
import { Bouton, Carte } from '@/composants/ui';
import { completerAvecIa, type ClientWorker, type ModeLecture } from '@/enrichissement';
import { texteEchecLecture } from '@/textes/lecture-auto';

export type EtatExtension = 'inconnue' | 'presente' | 'absente';

export type EtatLecture =
  | { readonly statut: 'en-cours' }
  | { readonly statut: 'echec'; readonly raison: RaisonEchecLecture }
  | null;

/** Laisse finir de coller ou de taper le lien avant de lancer la lecture. */
export const PAUSE_AVANT_LECTURE_MS = 600;

/**
 * Lien d'annonce reconnu + extension présente : l'extension lit l'annonce dans un onglet du
 * navigateur, l'IA complète les trous à partir du texte, puis `surCapture` reçoit le résultat.
 */
export function useLectureAutomatique(
  annonce: AnnonceResolue | null,
  actif: boolean,
  client: ClientWorker,
  surCapture: (capture: CaptureImportee, mode: ModeLecture | null) => void,
): { extension: EtatExtension; lecture: EtatLecture; relancer: () => void } {
  const [extension, setExtension] = useState<EtatExtension>('inconnue');
  const [lecture, setLecture] = useState<EtatLecture>(null);
  const derniere = useRef<string | null>(null);
  const rappel = useRef(surCapture);

  useEffect(() => {
    rappel.current = surCapture;
  }, [surCapture]);

  useEffect(() => {
    let vivant = true;
    void detecterExtension(window).then((presente) => {
      if (vivant) setExtension(presente ? 'presente' : 'absente');
    });
    return () => {
      vivant = false;
    };
  }, []);

  const lire = useCallback(
    async (url: string): Promise<void> => {
      derniere.current = url;
      setLecture({ statut: 'en-cours' });
      const resultat = await lireParExtension(window, url);
      if (!resultat.ok) {
        setLecture({ statut: 'echec', raison: resultat.raison });
        return;
      }
      const complete = await completerAvecIa(importerCapture(resultat.capture), client);
      setLecture(null);
      rappel.current(complete.capture, complete.mode);
    },
    [client],
  );

  const url = annonce?.urlCanonique ?? null;
  useEffect(() => {
    if (!actif || extension !== 'presente' || url === null || derniere.current === url) return;
    const minuterie = setTimeout(() => {
      void lire(url);
    }, PAUSE_AVANT_LECTURE_MS);
    return () => {
      clearTimeout(minuterie);
    };
  }, [actif, extension, url, lire]);

  const relancer = useCallback(() => {
    if (url !== null) void lire(url);
  }, [url, lire]);

  return { extension, lecture, relancer };
}

/** Ce que l'écran dit de la lecture automatique : en cours, échec avec la marche à suivre, ou invitation. */
export function EtatLectureAuto({
  extension,
  lecture,
  lienReconnu,
  relancer,
}: {
  extension: EtatExtension;
  lecture: EtatLecture;
  lienReconnu: boolean;
  relancer: () => void;
}): JSX.Element | null {
  if (lecture?.statut === 'en-cours') {
    return (
      <Carte>
        <p role="status" className="m-0 text-[15px] font-semibold">
          L'extension Deklic lit l'annonce…
        </p>
        <p className="m-0 text-sm text-encre-2">
          Un onglet s'ouvre un instant puis se referme. Si le portail affiche une vérification,
          validez-la : la lecture reprend toute seule.
        </p>
      </Carte>
    );
  }
  if (lecture?.statut === 'echec') {
    return (
      <Carte>
        <p role="alert" className="m-0 text-[15px] text-encre-2">
          {texteEchecLecture(lecture.raison)}
        </p>
        <div>
          <Bouton onClick={relancer}>Réessayer la lecture</Bouton>
        </div>
      </Carte>
    );
  }
  if (extension === 'absente' && lienReconnu) {
    return (
      <p className="m-0 text-sm text-encre-2">
        Avec l'extension Deklic, coller le lien suffit : elle lit l'annonce pour vous.{' '}
        <Link to="/extension" className="font-bold text-accent">
          Installer l'extension
        </Link>
      </p>
    );
  }
  return null;
}
