import type { BienGere, EtatGestion, LocationGeree } from '@loupe/gestion';
import type { JSX } from 'react';

import { Carte, Ligne, TitreCarte } from '@/composants/ui';
import { useFinBail } from '@/gestion/fin-bail/FinBailContext';
import { locationsASolder } from '@/gestion/fin-bail/vue';
import { dateEnLettres } from '@/gestion/format';
import { lienFicheBien } from '@/gestion/parcours';
import { TEXTES_FICHE } from '@/textes/gerer-fiche';
import { STATUTS_LOCATION, TEXTES_CHARGES, TEXTES_DEPOT } from '@/textes/gerer-fin-bail';

import { NomsDeLocataires } from '../NomsDeLocataires';
import { SectionCharges } from './SectionCharges';
import { SectionDepot } from './SectionDepot';

function CarteLocationTerminee({
  location,
  donnees,
  aujourdhui,
  retour,
}: {
  readonly location: LocationGeree;
  readonly donnees: EtatGestion;
  readonly aujourdhui: string;
  readonly retour: string;
}): JSX.Element {
  const locataires = [location.locataireId, ...location.colocataireIds].flatMap((id) =>
    donnees.locataires.filter((l) => l.id === id),
  );
  const titre =
    location.libelle === undefined
      ? STATUTS_LOCATION.terminee
      : `${STATUTS_LOCATION.terminee} · ${location.libelle}`;

  return (
    <Carte id={`fin-bail-${location.id}`}>
      <TitreCarte>{titre}</TitreCarte>
      <p className="m-0 text-[17px] font-bold">
        <NomsDeLocataires locataires={locataires} />
      </p>
      {location.fin !== undefined && (
        <Ligne libelle={TEXTES_FICHE.sortie} valeur={dateEnLettres(location.fin)} />
      )}
      <h3 className="m-0 text-sm font-bold tracking-wider text-encre-3 uppercase">
        {TEXTES_DEPOT.titre}
      </h3>
      <SectionDepot location={location} aujourdhui={aujourdhui} retour={retour} />
      <h3 className="m-0 text-sm font-bold tracking-wider text-encre-3 uppercase">
        {TEXTES_CHARGES.titre}
      </h3>
      <SectionCharges
        location={location}
        donnees={donnees}
        aujourdhui={aujourdhui}
        retour={retour}
      />
    </Carte>
  );
}

/**
 * Sur la fiche d'un bien : les locations terminées qu'il reste à solder (dépôt à rendre, charges à
 * régulariser). Sans la migration 0011, rien ne s'affiche.
 */
export function LocationsTerminees({
  bien,
  donnees,
  aujourdhui,
}: {
  readonly bien: BienGere;
  readonly donnees: EtatGestion;
  readonly aujourdhui: string;
}): JSX.Element | null {
  const etat = useFinBail().donnees;
  if (etat === null) return null;
  const locations = locationsASolder(donnees, etat, bien.id, aujourdhui);
  if (locations.length === 0) return null;
  const retour = lienFicheBien(bien.id);

  return (
    <>
      {locations.map((location) => (
        <CarteLocationTerminee
          key={location.id}
          location={location}
          donnees={donnees}
          aujourdhui={aujourdhui}
          retour={retour}
        />
      ))}
    </>
  );
}
