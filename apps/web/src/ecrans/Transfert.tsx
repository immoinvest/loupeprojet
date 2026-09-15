import { useEffect, useRef, useState, type JSX } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { Chapo, Page, TitrePage } from '@/composants/mise-en-page';
import { useProjets, type BilanImport } from '@/stockage/ProjetsContext';
import { CHEMIN_TRANSFERT, decoderTransfert, lireFragmentTransfert } from '@/stockage/transfert';
import { TEXTES_TRANSFERT as T } from '@/textes/transfert';

type Etat =
  | { readonly etat: 'chargement' }
  | { readonly etat: 'fait'; readonly bilan: BilanImport; readonly ignores: number }
  | { readonly etat: 'erreur'; readonly raison: keyof typeof T.raisons };

/**
 * `/transfert#d=…` : les projets envoyés par l'ancienne adresse de Deklic sont importés d'eux-mêmes
 * (sans écraser un projet plus récent), puis le fragment est retiré de l'adresse.
 */
export function Transfert(): JSX.Element {
  const { hash } = useLocation();
  const naviguer = useNavigate();
  const { importer } = useProjets();
  const [texte] = useState(() => lireFragmentTransfert(hash));
  const [etat, setEtat] = useState<Etat>(() =>
    texte === null ? { etat: 'erreur', raison: 'vide' } : { etat: 'chargement' },
  );
  // Un seul import par ouverture, même si l'effet est rejoué.
  const importe = useRef(false);

  useEffect(() => {
    if (texte === null || importe.current) return;
    importe.current = true;
    void decoderTransfert(texte).then((decodage) => {
      if (!decodage.ok) {
        setEtat({ etat: 'erreur', raison: decodage.raison });
        return;
      }
      setEtat({ etat: 'fait', bilan: importer(decodage.projets), ignores: decodage.ignores });
      void naviguer(CHEMIN_TRANSFERT, { replace: true });
    });
  }, [texte, importer, naviguer]);

  return (
    <Page espacement="moyen">
      <TitrePage>{T.titre}</TitrePage>
      {etat.etat === 'chargement' && (
        <p role="status" className="m-0 text-[15px] text-encre-2">
          {T.chargement}
        </p>
      )}
      {etat.etat === 'erreur' && <Chapo>{T.raisons[etat.raison]}</Chapo>}
      {etat.etat === 'fait' && (
        <div role="status" className="flex flex-col gap-2 text-[15px]">
          <p className="m-0 font-semibold">{T.bilan(etat.bilan.ajoutes, etat.bilan.remplaces)}</p>
          {etat.bilan.gardes > 0 && <p className="m-0">{T.gardes(etat.bilan.gardes)}</p>}
          {etat.ignores > 0 && <p className="m-0">{T.ignores(etat.ignores)}</p>}
        </div>
      )}
      <p className="m-0 text-[15px]">
        <Link to="/projets" className="inline-flex min-h-11 items-center">
          {T.lienProjets}
        </Link>
      </p>
    </Page>
  );
}
