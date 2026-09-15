import type { JSX } from 'react';

import { Bouton } from '@/composants/ui';
import type { ReferenceAdresse } from '@/enrichissement';
import { PHRASES_REPERE, phraseRepereApplique, phraseRepereNonApplique } from '@/textes/repere';

/**
 * Ce qu'est devenu le repère de l'adresse après l'analyse :
 * - `applique` : posé à l'instant, « Annuler » remet le précédent ;
 * - `deja` : le projet le portait déjà, rien à défaire ;
 * - `protege` : un repère saisi à la main est gardé, « Remplacer » applique celui de l'adresse ;
 * - `annule` : la personne a annulé, « Appliquer » le repose.
 */
export type EtatLigneRepere = 'applique' | 'deja' | 'protege' | 'annule';

function phrase(etat: EtatLigneRepere, reference: ReferenceAdresse): string {
  switch (etat) {
    case 'applique':
    case 'deja':
      return phraseRepereApplique(reference);
    case 'protege':
      return PHRASES_REPERE.protege;
    case 'annule':
      return phraseRepereNonApplique(reference);
  }
}

export function LigneRepere({
  etat,
  reference,
  onAnnuler,
  onAppliquer,
}: {
  etat: EtatLigneRepere;
  reference: ReferenceAdresse;
  onAnnuler: () => void;
  onAppliquer: () => void;
}): JSX.Element {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-2 rounded-encart border border-accent-bordure bg-surface px-3 py-2 text-[15px]"
    >
      <p className="m-0 min-w-0 flex-1">{phrase(etat, reference)}</p>
      {etat === 'applique' && <Bouton onClick={onAnnuler}>{PHRASES_REPERE.annuler}</Bouton>}
      {etat === 'protege' && <Bouton onClick={onAppliquer}>{PHRASES_REPERE.remplacer}</Bouton>}
      {etat === 'annule' && (
        <Bouton variante="primaire" onClick={onAppliquer}>
          {PHRASES_REPERE.appliquer}
        </Bouton>
      )}
    </div>
  );
}
