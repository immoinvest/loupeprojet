import type { JSX } from 'react';

import { Bouton, Carte, Pastille } from '@/composants/ui';
import { PHRASES_ADRESSE } from '@/textes/adresse';

/**
 * En tête de l'onglet Estimation quand l'adresse est déjà enregistrée : l'adresse sur une ligne, « Changer »
 * rouvre le champ ; l'état de la réanalyse à l'ouverture (en cours, échec) reste visible (fiche 14).
 */
export function LigneAdresse({
  libelle,
  enCours,
  erreur,
  onChanger,
}: {
  libelle: string;
  enCours: boolean;
  erreur: string | null;
  onChanger: () => void;
}): JSX.Element {
  return (
    <Carte>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 min-w-0 text-[15px]">
          <span className="font-semibold text-encre-2">{PHRASES_ADRESSE.adresseDuBien} : </span>
          {libelle}
        </p>
        <Bouton onClick={onChanger}>{PHRASES_ADRESSE.changer}</Bouton>
      </div>
      {enCours && (
        <p className="m-0 text-sm text-encre-2" role="status">
          {PHRASES_ADRESSE.analyseEnCours}
        </p>
      )}
      {erreur !== null && (
        <Pastille ton="surveiller" compacte>
          {erreur}
        </Pastille>
      )}
    </Carte>
  );
}
