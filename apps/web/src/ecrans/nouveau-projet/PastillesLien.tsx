import type { JSX } from 'react';

import { PORTAILS, type AnnonceResolue, type CaptureImportee } from '@/annonces';
import { Pastille } from '@/composants/ui';

/**
 * Ce que Nouveau projet dit du lien saisi : portail reconnu, identifiant et provenance de la lecture,
 * ou ce qui manque. Sans lien, les portails reconnus.
 */
export function PastillesLien({
  annonce,
  url,
  importee,
  captureIllisible,
}: {
  annonce: AnnonceResolue | null;
  url: string;
  importee: CaptureImportee | null;
  captureIllisible: boolean;
}): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {annonce !== null ? (
        <>
          <Pastille ton="bon" compacte>
            {PORTAILS[annonce.portail]} reconnu
          </Pastille>
          <Pastille ton="neutre" compacte>
            annonce {annonce.id}
          </Pastille>
          {importee !== null && (
            <Pastille ton="accent" compacte>
              {importee.mode === 'bookmarklet' ? 'lue par le bouton-favori' : "lue par l'extension"}
            </Pastille>
          )}
        </>
      ) : url.trim() !== '' ? (
        <Pastille ton="surveiller" compacte>
          Site non reconnu : collez le texte ci-dessous, ça marche aussi
        </Pastille>
      ) : captureIllisible ? (
        <Pastille ton="surveiller" compacte>
          La capture reçue est illisible : collez le lien, puis le texte de l'annonce
        </Pastille>
      ) : (
        <span className="text-sm text-encre-3">LeBonCoin, SeLoger, Bien'ici, PAP, Logic-Immo.</span>
      )}
    </div>
  );
}
