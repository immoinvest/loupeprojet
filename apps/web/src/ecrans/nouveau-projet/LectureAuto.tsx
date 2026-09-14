import type { JSX } from 'react';
import { Link } from 'react-router';

import { Bouton, Carte } from '@/composants/ui';
import { texteEchecLecture } from '@/textes/lecture-auto';
import { texteEchecServeur } from '@/textes/lecture-serveur';

import { AttenteLecture } from './AttenteLecture';
import type { EtatExtension, EtatLecture } from './useLectureAutomatique';

export {
  PAUSE_AVANT_LECTURE_MS,
  useLectureAutomatique,
  type EtatExtension,
  type EtatLecture,
  type LectureAutomatique,
} from './useLectureAutomatique';

/**
 * Ce que l'écran dit de la lecture automatique : extension ou Deklic en train de lire, échec avec
 * la marche à suivre, ou invitation à installer l'extension.
 */
export function EtatLectureAuto({
  extension,
  lecture,
  lienReconnu,
  relancer,
  lireSansExtension,
  annuler,
}: {
  extension: EtatExtension;
  lecture: EtatLecture;
  lienReconnu: boolean;
  relancer: () => void;
  lireSansExtension: () => void;
  annuler: () => void;
}): JSX.Element | null {
  if (lecture?.statut === 'en-cours' && lecture.par === 'extension') {
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
  if (lecture?.statut === 'en-cours') {
    return <AttenteLecture portail={lecture.portail} debut={lecture.debut} annuler={annuler} />;
  }
  if (lecture?.statut === 'echec') {
    return (
      <Carte>
        <p role="alert" className="m-0 text-[15px] text-encre-2">
          {lecture.par === 'extension'
            ? texteEchecLecture(lecture.raison)
            : texteEchecServeur(lecture.raison)}
        </p>
        <div className="flex flex-wrap gap-3">
          <Bouton onClick={relancer}>Réessayer la lecture</Bouton>
          {lecture.par === 'extension' && (
            <Bouton onClick={lireSansExtension}>Lire sans l'extension</Bouton>
          )}
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
