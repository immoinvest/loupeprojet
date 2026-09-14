import { useEffect, type JSX } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { z } from 'zod';

import { Bouton } from '@/composants/ui';
import { FournisseurProjet, ProjetIntrouvable } from '@/coque/ProjetLayout';
import { useProjets } from '@/stockage/ProjetsContext';

import { DocumentProjet } from './document/DocumentProjet';

/** Le bouton PDF de l'en-tête arrive ici avec cet état : on imprime dès l'affichage. */
const EtatImpressionSchema = z.object({ imprimer: z.literal(true) });

const DELAI_AVANT_IMPRESSION_MS = 150;

export function Imprimer(): JSX.Element {
  const { id } = useParams();
  const { trouver } = useProjets();
  const enregistre = trouver(id);
  const location = useLocation();
  const { pathname } = location;
  const naviguer = useNavigate();
  // L'état de navigation est libre (`any`) : on le lit comme une valeur inconnue, validée par Zod.
  const etat: unknown = location.state;
  const imprimerAuto = EtatImpressionSchema.safeParse(etat).success;

  useEffect(() => {
    if (!imprimerAuto) return undefined;
    const minuteur = window.setTimeout(() => {
      window.print();
      // L'état est consommé : un rechargement de la page n'imprimera pas une seconde fois.
      void naviguer(pathname, { replace: true });
    }, DELAI_AVANT_IMPRESSION_MS);
    return () => {
      window.clearTimeout(minuteur);
    };
  }, [imprimerAuto, naviguer, pathname]);

  if (enregistre === undefined) return <ProjetIntrouvable />;

  return (
    <div className="min-h-dvh bg-fond pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      {/* Sur téléphone, la barre s'empile et défile avec la page ; à partir de 640 px, elle reste en haut. */}
      <div className="no-print z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-bordure bg-surface px-4 py-3 sm:sticky sm:top-0 sm:flex-nowrap sm:px-6">
        <Link
          to={`/projets/${enregistre.id}`}
          className="inline-flex min-h-11 items-center text-sm font-semibold no-underline survol-texte"
        >
          ← Retour au projet
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
          Imprimer ou enregistrer en PDF
        </Bouton>
      </div>
      <FournisseurProjet enregistre={enregistre}>
        <div className="document-page mx-2 my-4 max-w-[210mm] rounded-carte border border-bordure bg-surface shadow-carte sm:mx-auto sm:my-6">
          <DocumentProjet />
        </div>
      </FournisseurProjet>
    </div>
  );
}
