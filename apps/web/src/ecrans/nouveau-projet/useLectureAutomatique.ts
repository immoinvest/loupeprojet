import type { Capture, Portail, RaisonEchecLecture } from '@loupe/capture';
import { useCallback, useEffect, useRef, useState } from 'react';

import { importerCapture, type AnnonceResolue, type CaptureImportee } from '@/annonces';
import { detecterExtension, lireParExtension } from '@/annonces/extension';
import { lireParServeur, type RaisonEchecServeur } from '@/annonces/lecture-serveur';
import { completerAvecIa, type ClientWorker, type ModeLecture } from '@/enrichissement';

export type EtatExtension = 'inconnue' | 'presente' | 'absente';

export type EtatLecture =
  | { readonly statut: 'en-cours'; readonly par: 'extension' }
  | {
      readonly statut: 'en-cours';
      readonly par: 'serveur';
      readonly portail: Portail;
      /** Instant du début (ms), pour l'écran d'attente. */
      readonly debut: number;
    }
  | { readonly statut: 'echec'; readonly par: 'extension'; readonly raison: RaisonEchecLecture }
  | { readonly statut: 'echec'; readonly par: 'serveur'; readonly raison: RaisonEchecServeur }
  | null;

export interface LectureAutomatique {
  readonly extension: EtatExtension;
  readonly lecture: EtatLecture;
  readonly relancer: () => void;
  readonly lireSansExtension: () => void;
  readonly annuler: () => void;
}

/** Laisse finir de coller ou de taper le lien avant de lancer la lecture. */
export const PAUSE_AVANT_LECTURE_MS = 600;

/** L'extension n'a pas pu ouvrir ou lire l'annonce : Deklic prend le relais par son serveur. */
const RELAIS_SERVEUR: readonly RaisonEchecLecture[] = ['chargement', 'vide'];

/**
 * Lien d'annonce reconnu : l'extension le lit si elle est installée, sinon le Worker rapporte la
 * page (ADR-008) ; l'IA complète les trous à partir du texte, puis `surCapture` reçoit le résultat.
 */
export function useLectureAutomatique(
  annonce: AnnonceResolue | null,
  actif: boolean,
  client: ClientWorker,
  surCapture: (capture: CaptureImportee, mode: ModeLecture | null) => void,
): LectureAutomatique {
  const [extension, setExtension] = useState<EtatExtension>('inconnue');
  const [lecture, setLecture] = useState<EtatLecture>(null);
  const derniere = useRef<string | null>(null);
  const enCours = useRef<AbortController | null>(null);
  const url = annonce?.urlCanonique ?? null;
  const portail = annonce?.portail ?? null;
  const urlCourante = useRef(url);
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

  const terminer = useCallback(
    async (capture: Capture): Promise<void> => {
      const complete = await completerAvecIa(importerCapture(capture), client);
      setLecture(null);
      rappel.current(complete.capture, complete.mode);
    },
    [client],
  );

  const lireServeur = useCallback(
    async (url: string, portail: Portail, siIndisponible: EtatLecture): Promise<void> => {
      derniere.current = url;
      enCours.current?.abort();
      const controleur = new AbortController();
      enCours.current = controleur;
      setLecture({ statut: 'en-cours', par: 'serveur', portail, debut: Date.now() });
      const resultat = await lireParServeur(url, client, { signal: controleur.signal });
      // Annulée, remplacée par une autre lecture ou lien changé entre-temps : le résultat ne sert plus.
      if (enCours.current !== controleur) return;
      enCours.current = null;
      if (resultat.ok) {
        await terminer(resultat.capture);
        return;
      }
      setLecture(
        resultat.raison === 'indisponible'
          ? siIndisponible
          : { statut: 'echec', par: 'serveur', raison: resultat.raison },
      );
    },
    [client, terminer],
  );

  const lireExtension = useCallback(
    async (url: string, portail: Portail): Promise<void> => {
      derniere.current = url;
      setLecture({ statut: 'en-cours', par: 'extension' });
      const resultat = await lireParExtension(window, url);
      if (urlCourante.current !== url) return;
      if (resultat.ok) {
        await terminer(resultat.capture);
        return;
      }
      const echec: EtatLecture = { statut: 'echec', par: 'extension', raison: resultat.raison };
      if (RELAIS_SERVEUR.includes(resultat.raison)) await lireServeur(url, portail, echec);
      else setLecture(echec);
    },
    [lireServeur, terminer],
  );

  // Le lien a changé ou a été effacé : la lecture de l'ancien est abandonnée, son état effacé.
  useEffect(() => {
    urlCourante.current = url;
    if (derniere.current === null || derniere.current === url) return;
    derniere.current = null;
    enCours.current?.abort();
    enCours.current = null;
    setLecture(null);
  }, [url]);

  useEffect(() => {
    if (!actif || extension === 'inconnue' || url === null || portail === null) return;
    if (derniere.current === url) return;
    const minuterie = setTimeout(() => {
      void (extension === 'presente'
        ? lireExtension(url, portail)
        : lireServeur(url, portail, null));
    }, PAUSE_AVANT_LECTURE_MS);
    return () => {
      clearTimeout(minuterie);
    };
  }, [actif, extension, url, portail, lireExtension, lireServeur]);

  const relancer = useCallback(() => {
    if (url === null || portail === null) return;
    void (lecture?.par === 'serveur' || extension !== 'presente'
      ? lireServeur(url, portail, null)
      : lireExtension(url, portail));
  }, [url, portail, lecture, extension, lireServeur, lireExtension]);

  const lireSansExtension = useCallback(() => {
    if (url !== null && portail !== null) void lireServeur(url, portail, lecture);
  }, [url, portail, lecture, lireServeur]);

  const annuler = useCallback(() => {
    enCours.current?.abort();
    enCours.current = null;
    setLecture({ statut: 'echec', par: 'serveur', raison: 'annulee' });
  }, []);

  return { extension, lecture, relancer, lireSansExtension, annuler };
}
