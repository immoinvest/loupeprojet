import type { JSX } from 'react';
import { Link } from 'react-router';

import { Carte, Ligne, Pastille, TitreCarte } from '@/composants/ui';
import type { OccupationFiche } from '@/gestion/fiche-locataire';
import { montant } from '@/gestion/format';
import { lienFicheBien } from '@/gestion/parcours';
import {
  ETATS_OCCUPATION,
  TEXTES_FICHE_LOCATAIRE as T,
  TONS_OCCUPATION,
} from '@/textes/gerer-locataire';
import { periodeDuLocataire } from '@/textes/gerer-locataires';
import { bienEtChambre } from '@/textes/gerer-loyers';

import { NomsDeLocataires } from '../NomsDeLocataires';

/** Une location du locataire : le bien (lien vers sa fiche), l'état, les dates, les montants, les colocataires. */
export function CarteOccupation({
  occupation,
  aujourdhui,
}: {
  readonly occupation: OccupationFiche;
  readonly aujourdhui: string;
}): JSX.Element {
  const { location, bien, etat, montants, colocataires } = occupation;
  return (
    <Carte>
      <TitreCarte
        action={
          <Pastille ton={TONS_OCCUPATION[etat]} compacte>
            {ETATS_OCCUPATION[etat]}
          </Pastille>
        }
      >
        <Link
          to={lienFicheBien(bien.id)}
          className="text-encre no-underline survol-texte pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
        >
          {bienEtChambre(bien.nom, location.libelle)}
        </Link>
      </TitreCarte>
      <div>
        <Ligne
          libelle={T.periode}
          valeur={periodeDuLocataire(location.debut, location.fin, aujourdhui)}
        />
        <Ligne libelle={T.loyer} valeur={montant(montants.loyerHorsCharges)} />
        <Ligne libelle={T.charges} valeur={montant(montants.charges)} />
        {montants.apl > 0 && <Ligne libelle={T.apl} valeur={montant(montants.apl)} />}
        {colocataires.length > 0 && (
          <Ligne libelle={T.avec} valeur={<NomsDeLocataires locataires={colocataires} />} />
        )}
      </div>
    </Carte>
  );
}
