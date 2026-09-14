import type { EtatGestion, LocationGeree } from '@loupe/gestion';
import { useState, type JSX } from 'react';

import { Bouton, Carte, Ligne, TitreCarte } from '@/composants/ui';
import { dateEnLettres, leJourDuMois, montant } from '@/gestion/format';
import { useGestion } from '@/gestion/GestionContext';
import { ERREURS_GESTION } from '@/textes/gerer';
import { TEXTES_FICHE as F, titreLocation } from '@/textes/gerer-fiche';
import { nomsDesLocataires } from '@/textes/gerer-loyers';

import { TerminerLocation } from './TerminerLocation';

/** Une location du bien : ses locataires, ses montants, ses dates, et « Terminer la location ». */
export function CarteLocation({
  location,
  donnees,
  aujourdhui,
}: {
  readonly location: LocationGeree;
  readonly donnees: EtatGestion;
  readonly aujourdhui: string;
}): JSX.Element {
  const { terminerLocation } = useGestion();
  const [ouvert, setOuvert] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const noms = [location.locataireId, ...location.colocataireIds]
    .flatMap((id) => donnees.locataires.filter((l) => l.id === id))
    .map((l) => `${l.prenom} ${l.nom}`);

  const enregistrer = async (fin: string): Promise<void> => {
    setOccupe(true);
    const r = await terminerLocation(location.id, fin);
    setOccupe(false);
    setErreur(r.ok ? null : ERREURS_GESTION[r.code]);
    if (r.ok) setOuvert(false);
  };

  return (
    <Carte>
      <TitreCarte>{titreLocation(location.libelle, location.debut > aujourdhui)}</TitreCarte>
      <p className="m-0 text-[17px] font-bold">{nomsDesLocataires(noms)}</p>
      <div>
        <Ligne libelle={F.loyer} valeur={montant(location.loyerHorsCharges)} />
        <Ligne libelle={F.charges} valeur={montant(location.charges)} />
        <Ligne libelle={F.depot} valeur={montant(location.depot)} />
        <Ligne libelle={F.jourLoyer} valeur={leJourDuMois(location.jourLoyer)} />
        <Ligne libelle={F.entree} valeur={dateEnLettres(location.debut)} />
        {location.fin !== undefined && (
          <Ligne libelle={F.sortie} valeur={dateEnLettres(location.fin)} />
        )}
      </div>
      {ouvert ? (
        <TerminerLocation
          id={`sortie-${location.id}`}
          aujourdhui={aujourdhui}
          occupe={occupe}
          erreur={erreur}
          onEnregistrer={enregistrer}
          onFermer={() => {
            setOuvert(false);
            setErreur(null);
          }}
        />
      ) : (
        <div>
          <Bouton
            onClick={() => {
              setOuvert(true);
            }}
          >
            {F.terminer}
          </Bouton>
        </div>
      )}
    </Carte>
  );
}
