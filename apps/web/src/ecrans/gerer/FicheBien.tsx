import { jourLocal, type BienGere, type EtatGestion } from '@loupe/gestion';
import { useState, type JSX } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import { Chapo, Page, TitrePage } from '@/composants/mise-en-page';
import { Bouton, Carte, LienBouton, Pastille, TitreCarte } from '@/composants/ui';
import { derniereLocation, etatDuBien, friseDuBien } from '@/gestion/fiche';
import { useGestion } from '@/gestion/GestionContext';
import { statutDuBien, TEXTES_FICHE as F, TONS_BIEN } from '@/textes/gerer-fiche';
import { titreLouer } from '@/textes/gerer-louer';

import { EcranAttente } from './EcranAttente';
import { CarteLocation } from './fiche/CarteLocation';
import { FriseMois } from './fiche/FriseMois';
import { LouerBien } from './fiche/LouerBien';
import { SupprimerBien } from './fiche/SupprimerBien';
import { RetoursLoyer } from './RetoursLoyer';
import { useActionsLoyer } from './useActionsLoyer';

function Fiche({
  donnees,
  bien,
}: {
  readonly donnees: EtatGestion;
  readonly bien: BienGere;
}): JSX.Element {
  const [recherche] = useSearchParams();
  // `?louer=1` (lien d'un bien vacant sur l'accueil) : le formulaire est déjà ouvert, deux clics en tout.
  const [louerOuvert, setLouerOuvert] = useState(recherche.get('louer') === '1');
  const aujourdhui = jourLocal(new Date());
  const actions = useActionsLoyer(aujourdhui);
  const etat = etatDuBien(donnees, bien.id, aujourdhui);
  const vacant = etat.statut === 'vacant';

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

      {louerOuvert ? (
        <Carte className="border-accent-bordure">
          <TitreCarte>{titreLouer(vacant)}</TitreCarte>
          <LouerBien
            bienId={bien.id}
            derniere={derniereLocation(donnees, bien.id)}
            aujourdhui={aujourdhui}
            onFermer={() => {
              setLouerOuvert(false);
            }}
            onLoue={() => {
              setLouerOuvert(false);
            }}
          />
        </Carte>
      ) : (
        <div>
          <Bouton
            variante={vacant ? 'primaire' : 'secondaire'}
            onClick={() => {
              setLouerOuvert(true);
            }}
          >
            {titreLouer(vacant)}
          </Bouton>
        </div>
      )}

      <FriseMois frise={friseDuBien(donnees, bien.id, aujourdhui)} actions={actions} />

      <SupprimerBien bien={bien} />
    </Page>
  );
}

/** /gerer/biens/:id : où en est le bien, ses locations, le louer, ses douze derniers mois. */
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
