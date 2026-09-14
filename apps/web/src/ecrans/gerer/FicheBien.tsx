import { jourLocal, type BienGere, type EtatGestion } from '@loupe/gestion';
import type { JSX } from 'react';
import { Link, useParams } from 'react-router';

import { Chapo, Page, TitrePage } from '@/composants/mise-en-page';
import { Carte, LienBouton, Pastille } from '@/composants/ui';
import { etatDuBien, friseDuBien } from '@/gestion/fiche';
import { useGestion } from '@/gestion/GestionContext';
import { statutDuBien, TEXTES_FICHE as F, TONS_BIEN } from '@/textes/gerer-fiche';

import { EcranAttente } from './EcranAttente';
import { CarteLocation } from './fiche/CarteLocation';
import { FriseMois } from './fiche/FriseMois';
import { RetoursLoyer } from './RetoursLoyer';
import { useActionsLoyer } from './useActionsLoyer';

function Fiche({
  donnees,
  bien,
}: {
  readonly donnees: EtatGestion;
  readonly bien: BienGere;
}): JSX.Element {
  const aujourdhui = jourLocal(new Date());
  const actions = useActionsLoyer(aujourdhui);
  const etat = etatDuBien(donnees, bien.id, aujourdhui);

  return (
    <Page espacement="large" className="max-w-[900px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <TitrePage>{bien.nom}</TitrePage>
          <Chapo>{bien.adresse}</Chapo>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Pastille ton={TONS_BIEN[etat.statut]}>{statutDuBien(etat)}</Pastille>
          {bien.projetId !== undefined && (
            <LienBouton to={`/projets/${bien.projetId}`}>{F.voirAnalyse}</LienBouton>
          )}
        </div>
      </div>

      <RetoursLoyer actions={actions} bailleur={donnees.bailleur} />

      {etat.locations.length === 0 ? (
        <Carte>
          <p className="m-0 text-encre-2">{F.aucuneLocation}</p>
        </Carte>
      ) : (
        etat.locations.map((location) => (
          <CarteLocation
            key={location.id}
            location={location}
            donnees={donnees}
            aujourdhui={aujourdhui}
          />
        ))
      )}

      <FriseMois frise={friseDuBien(donnees, bien.id, aujourdhui)} actions={actions} />
    </Page>
  );
}

/** /gerer/biens/:id : où en est le bien, ses locations, ses douze derniers mois. */
export function FicheBien(): JSX.Element {
  const { id = '' } = useParams();
  const { statut, donnees } = useGestion();
  if (statut !== 'pret' || donnees === null) return <EcranAttente />;
  const bien = donnees.biens.find((b) => b.id === id);
  if (bien === undefined) {
    return (
      <Page className="max-w-[760px]">
        <TitrePage>{F.introuvable}</TitrePage>
        <Chapo>
          {F.introuvableTexte} <Link to="/gerer/loyers">{F.voirLoyers}</Link>
        </Chapo>
      </Page>
    );
  }
  return <Fiche donnees={donnees} bien={bien} />;
}
