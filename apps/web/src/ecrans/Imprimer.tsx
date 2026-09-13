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
    <div className="min-h-screen bg-fond">
      <div className="no-print sticky top-0 z-10 flex items-center gap-4 border-b border-bordure bg-surface px-6 py-3">
        <Link to={`/projets/${enregistre.id}`} className="text-sm font-semibold no-underline">
          ← Retour au projet
        </Link>
        <span className="flex-1 text-sm text-encre-3">
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
        <div className="document-page mx-auto my-6 max-w-[210mm] rounded-carte border border-bordure bg-surface shadow-carte">
          <DocumentProjet />
        </div>
      </FournisseurProjet>
    </div>
  );
}
