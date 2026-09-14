import { VERSION_REGLES_COURANTE, obtenirRegles } from '@loupe/moteur';
import { useEffect, useMemo, type JSX } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';

import { Bouton } from '@/composants/ui';
import {
  CHEMIN_SIMULATEUR,
  calculer,
  decoderSimulation,
  fragmentSimulation,
  lireFragmentSimulation,
  saisieDefaut,
  saisieDepuisSimulation,
} from '@/simulateur';
import { BOUTONS_SIMULATEUR as B } from '@/textes/simulateur';

import { DocumentSimulation } from './simulateur/DocumentSimulation';

/** Le bouton « Imprimer » du simulateur arrive ici avec cet état : on imprime dès l'affichage. */
const EtatImpressionSchema = z.object({ imprimer: z.literal(true) });

const DELAI_AVANT_IMPRESSION_MS = 150;

/** `/simulateur-pret/imprimer#s=…` : la simulation du fragment (ou les défauts), hors coque, en mode document. */
export function SimulateurImprimer(): JSX.Element {
  const regles = obtenirRegles(VERSION_REGLES_COURANTE);
  const location = useLocation();
  const { hash, pathname } = location;
  const naviguer = useNavigate();
  const etat: unknown = location.state;
  const imprimerAuto = EtatImpressionSchema.safeParse(etat).success;

  const calcul = useMemo(() => {
    const decodage = decoderSimulation(lireFragmentSimulation(hash) ?? '');
    const saisie = decodage.ok ? saisieDepuisSimulation(decodage.simulation) : saisieDefaut(regles);
    return calculer(saisie, regles);
  }, [hash, regles]);
  const simulation = calcul.conversion.simulation;
  const retour = `${CHEMIN_SIMULATEUR}${simulation === null ? '' : fragmentSimulation(simulation)}`;

  useEffect(() => {
    if (!imprimerAuto) return undefined;
    const minuteur = window.setTimeout(() => {
      window.print();
      // L'état est consommé : un rechargement de la page n'imprimera pas une seconde fois.
      void naviguer(`${pathname}${hash}`, { replace: true });
    }, DELAI_AVANT_IMPRESSION_MS);
    return () => {
      window.clearTimeout(minuteur);
    };
  }, [imprimerAuto, naviguer, pathname, hash]);

  return (
    <div className="min-h-dvh bg-fond pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <div className="no-print z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-bordure bg-surface px-4 py-3 sm:sticky sm:top-0 sm:flex-nowrap sm:px-6">
        <Link
          to={retour}
          className="inline-flex min-h-11 items-center text-sm font-semibold no-underline survol-texte"
        >
          ← {B.retour}
        </Link>
        <span className="order-last basis-full text-sm text-encre-3 sm:order-none sm:flex-1 sm:basis-auto">
          Aperçu du document. Dans la fenêtre d'impression, choisissez « Enregistrer au format PDF
          ».
        </span>
        <Bouton
          variante="primaire"
          onClick={() => {
            window.print();
          }}
        >
          {B.imprimerOuPdf}
        </Bouton>
      </div>
      <div className="document-page mx-2 my-4 max-w-[210mm] rounded-carte border border-bordure bg-surface shadow-carte sm:mx-auto sm:my-6">
        <DocumentSimulation calcul={calcul} regles={regles} />
      </div>
    </div>
  );
}
