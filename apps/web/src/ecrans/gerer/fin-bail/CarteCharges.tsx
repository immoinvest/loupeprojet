import type { EtatGestion, LocationGeree } from '@loupe/gestion';
import type { JSX } from 'react';

import { Carte, TitreCarte } from '@/composants/ui';
import { useFinBail } from '@/gestion/fin-bail/FinBailContext';
import { lienFicheBien } from '@/gestion/parcours';
import { TEXTES_CHARGES } from '@/textes/gerer-fin-bail';

import { SectionCharges } from './SectionCharges';

/** « Charges » d'une location en cours, sur la fiche de son bien (G4-4). */
export function CarteCharges({
  location,
  donnees,
  aujourdhui,
}: {
  readonly location: LocationGeree;
  readonly donnees: EtatGestion;
  readonly aujourdhui: string;
}): JSX.Element | null {
  const etat = useFinBail().donnees;
  if (etat === null) return null;
  const titre =
    location.libelle === undefined
      ? TEXTES_CHARGES.titre
      : `${TEXTES_CHARGES.titre} · ${location.libelle}`;

  return (
    <Carte id={`charges-${location.id}`}>
      <TitreCarte>{titre}</TitreCarte>
      <SectionCharges
        location={location}
        donnees={donnees}
        aujourdhui={aujourdhui}
        retour={lienFicheBien(location.bienId)}
      />
    </Carte>
  );
}
