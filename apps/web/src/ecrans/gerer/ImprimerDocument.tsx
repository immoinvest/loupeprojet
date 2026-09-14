import type { DocumentComplet } from '@loupe/gestion';
import { useEffect, useState, type JSX } from 'react';
import { Link, useParams } from 'react-router';

import { Bouton } from '@/composants/ui';
import { useGestion } from '@/gestion/GestionContext';
import type { ResultatGestion } from '@/gestion/types';
import { ERREURS_GESTION } from '@/textes/gerer';
import { TEXTES_DOCUMENT as D } from '@/textes/gerer-documents';

import { DocumentLoyer } from './DocumentLoyer';
import { EcranAttente } from './EcranAttente';

/** `/gerer/documents/:id` : la quittance ou le reçu, hors coque, prêt à imprimer ou à enregistrer en PDF. */
export function ImprimerDocument(): JSX.Element {
  const { id = '' } = useParams();
  const { statut, document: lireDocument } = useGestion();
  const [lu, setLu] = useState<ResultatGestion<DocumentComplet> | null>(null);

  useEffect(() => {
    if (statut !== 'pret') return undefined;
    let actif = true;
    void lireDocument(id).then((r) => {
      if (actif) setLu(r);
    });
    return () => {
      actif = false;
    };
  }, [statut, id, lireDocument]);

  if (statut !== 'pret') return <EcranAttente />;

  return (
    <div className="min-h-dvh bg-fond pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <div className="no-print z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-bordure bg-surface px-4 py-3 sm:sticky sm:top-0 sm:flex-nowrap sm:px-6">
        <Link
          to="/gerer/loyers"
          className="inline-flex min-h-11 items-center text-sm font-semibold no-underline"
        >
          ← {D.retour}
        </Link>
        {lu?.ok === true && (
          <>
            <span className="order-last basis-full text-sm text-encre-3 sm:order-none sm:flex-1 sm:basis-auto">
              {D.apercu}
            </span>
            <Bouton
              variante="primaire"
              onClick={() => {
                window.print();
              }}
            >
              {D.imprimer}
            </Bouton>
          </>
        )}
      </div>
      {lu === null && <p className="m-0 px-4 py-8 text-encre-3 sm:px-10">{D.chargement}</p>}
      {lu?.ok === true && (
        <div className="document-page mx-2 my-4 max-w-[210mm] rounded-carte border border-bordure bg-surface shadow-carte sm:mx-auto sm:my-6">
          <DocumentLoyer contenu={lu.valeur.contenu} />
        </div>
      )}
      {lu?.ok === false && (
        <div className="mx-auto flex max-w-[760px] flex-col gap-3 px-4 py-10">
          <h1 className="m-0 font-display text-[28px] font-semibold">{D.introuvable}</h1>
          <p className="m-0 text-encre-2">
            {lu.code === 'introuvable' ? D.introuvableTexte : ERREURS_GESTION[lu.code]}
          </p>
        </div>
      )}
    </div>
  );
}
