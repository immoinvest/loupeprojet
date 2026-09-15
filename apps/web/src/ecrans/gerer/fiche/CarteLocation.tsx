import {
  montantsDuMois,
  periodeDe,
  type EtatGestion,
  type LocationGeree,
  type ModificationLocation,
} from '@loupe/gestion';
import { useState, type JSX } from 'react';

import { Bouton, Carte, Ligne, TitreCarte } from '@/composants/ui';
import { recoitApl } from '@/gestion/fiche';
import { dateEnLettres, leJourDuMois, montant } from '@/gestion/format';
import { useGestion } from '@/gestion/GestionContext';
import type { ResultatGestion } from '@/gestion/types';
import { ERREURS_GESTION } from '@/textes/gerer';
import { depuisLe, loyerAPartirDe, TEXTES_MODIFIER as M } from '@/textes/gerer-biens';
import { TEXTES_FICHE as F, titreLocation } from '@/textes/gerer-fiche';

import { NomsDeLocataires } from '../NomsDeLocataires';
import { ModifierLocation } from './ModifierLocation';
import { TerminerLocation } from './TerminerLocation';

type Formulaire = 'modifier' | 'terminer' | null;

/** Une location du bien : ses locataires, ses montants en vigueur, ses dates, « Modifier » et « Terminer ». */
export function CarteLocation({
  location,
  donnees,
  aujourdhui,
  modifierOuvert = false,
}: {
  readonly location: LocationGeree;
  readonly donnees: EtatGestion;
  readonly aujourdhui: string;
  /** Arrivée par le montant d'une ligne de loyer : le formulaire « Modifier » est déjà ouvert. */
  readonly modifierOuvert?: boolean;
}): JSX.Element {
  const { terminerLocation, modifierLocation } = useGestion();
  const [ouvert, setOuvert] = useState<Formulaire>(modifierOuvert ? 'modifier' : null);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const aVenir = location.debut > aujourdhui;
  const locataires = [location.locataireId, ...location.colocataireIds].flatMap((id) =>
    donnees.locataires.filter((l) => l.id === id),
  );
  // Ceux de ce mois-ci, ou ceux du mois d'entrée pour une location à venir ; puis le prochain changement.
  const periode = periodeDe(aVenir ? location.debut : aujourdhui);
  const montants = montantsDuMois(location, periode);
  const prochain = location.changements?.find((c) => c.aPartirDe > periode);

  const fermer = (): void => {
    setOuvert(null);
    setErreur(null);
  };
  const conclure = (r: ResultatGestion<LocationGeree>): void => {
    setOccupe(false);
    if (r.ok) fermer();
    else setErreur(ERREURS_GESTION[r.code]);
  };
  const terminer = async (fin: string): Promise<void> => {
    setOccupe(true);
    conclure(await terminerLocation(location.id, fin));
  };
  const modifier = async (modification: ModificationLocation | null): Promise<void> => {
    if (modification === null) {
      fermer();
      return;
    }
    setOccupe(true);
    conclure(await modifierLocation(location.id, modification));
  };

  return (
    <Carte>
      <TitreCarte>{titreLocation(location.libelle, aVenir)}</TitreCarte>
      <p className="m-0 text-[17px] font-bold">
        <NomsDeLocataires locataires={locataires} />
      </p>
      <div>
        <Ligne
          libelle={F.loyer}
          valeur={
            montants.aPartirDe === undefined
              ? montant(montants.loyerHorsCharges)
              : `${montant(montants.loyerHorsCharges)} ${depuisLe(montants.aPartirDe)}`
          }
        />
        <Ligne libelle={F.charges} valeur={montant(montants.charges)} />
        {prochain !== undefined && (
          <Ligne
            libelle={loyerAPartirDe(prochain.aPartirDe)}
            valeur={montant(prochain.loyerHorsCharges)}
          />
        )}
        <Ligne libelle={F.depot} valeur={montant(location.depot)} />
        <Ligne libelle={F.jourLoyer} valeur={leJourDuMois(location.jourLoyer)} />
        <Ligne libelle={F.entree} valeur={dateEnLettres(location.debut)} />
        {location.fin !== undefined && (
          <Ligne libelle={F.sortie} valeur={dateEnLettres(location.fin)} />
        )}
      </div>
      {ouvert === 'modifier' && (
        <ModifierLocation
          location={location}
          paiements={donnees.paiements}
          aujourdhui={aujourdhui}
          occupe={occupe}
          erreur={erreur}
          onEnregistrer={modifier}
          onFermer={fermer}
        />
      )}
      {ouvert === 'terminer' && (
        <TerminerLocation
          id={`sortie-${location.id}`}
          aujourdhui={aujourdhui}
          occupe={occupe}
          erreur={erreur}
          rappelCaf={recoitApl(location)}
          onEnregistrer={terminer}
          onFermer={fermer}
        />
      )}
      {ouvert === null && (
        <div className="flex flex-wrap gap-2">
          <Bouton
            onClick={() => {
              setOuvert('modifier');
            }}
          >
            {M.modifier}
          </Bouton>
          <Bouton
            onClick={() => {
              setOuvert('terminer');
            }}
          >
            {F.terminer}
          </Bouton>
        </div>
      )}
    </Carte>
  );
}
