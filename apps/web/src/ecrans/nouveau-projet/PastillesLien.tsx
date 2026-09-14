import type { JSX } from 'react';

import { PORTAILS, type AnnonceResolue, type CaptureImportee } from '@/annonces';
import { Pastille } from '@/composants/ui';
import { TEXTES_PARTAGE_RECU } from '@/textes/application';

/** Qui a lu l'annonce : l'extension, le bouton-favori, ou Deklic lui-même (lecture par le serveur). */
const LUE_PAR: Readonly<Record<CaptureImportee['mode'], string>> = {
  extension: "lue par l'extension",
  bookmarklet: 'lue par le bouton-favori',
  serveur: 'lue par Deklic',
};

/**
 * Ce que Nouveau projet dit du lien saisi : portail reconnu, identifiant et provenance (extension,
 * bouton-favori ou feuille de partage du téléphone), ou ce qui manque. Sans lien, les portails reconnus.
 */
export function PastillesLien({
  annonce,
  url,
  importee,
  captureIllisible,
  partagee,
}: {
  annonce: AnnonceResolue | null;
  url: string;
  importee: CaptureImportee | null;
  captureIllisible: boolean;
  /** Le lien affiché est celui reçu par la feuille de partage. */
  partagee: boolean;
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
          {importee !== null ? (
            <Pastille ton="accent" compacte>
              {LUE_PAR[importee.mode]}
            </Pastille>
          ) : (
            partagee && (
              <Pastille ton="accent" compacte>
                {TEXTES_PARTAGE_RECU.pastille}
              </Pastille>
            )
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
