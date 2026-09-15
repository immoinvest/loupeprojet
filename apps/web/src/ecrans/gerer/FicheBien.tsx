import { jourLocal, type BienGere, type EtatGestion } from '@loupe/gestion';
import { Fragment, useEffect, type JSX } from 'react';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router';

import { Chapo, Page, TitrePage } from '@/composants/mise-en-page';
import { Carte, LienBouton, Pastille } from '@/composants/ui';
import { etatDuBien, friseDuBien } from '@/gestion/fiche';
import { useGestion } from '@/gestion/GestionContext';
import {
  CHEMIN_GERER,
  CHEMIN_MES_BIENS,
  lienFicheBien,
  lienNouveauLocataire,
} from '@/gestion/parcours';
import { statutDuBien, TEXTES_FICHE as F, TONS_BIEN } from '@/textes/gerer-fiche';
import { titreLouer } from '@/textes/gerer-louer';
import { TEXTES_PARCOURS as P } from '@/textes/gerer-parcours';

import { CarteArgent } from './argent/CarteArgent';
import { CarteConformite } from './bail/CarteConformite';
import { CarteRevision } from './bail/CarteRevision';
import { EcranAttente } from './EcranAttente';
import { FilAriane } from './FilAriane';
import { CarteLocation } from './fiche/CarteLocation';
import { FriseMois } from './fiche/FriseMois';
import { SupprimerBien } from './fiche/SupprimerBien';
import { LocationCreee } from './LocationCreee';
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
  const { hash } = useLocation();
  const aujourdhui = jourLocal(new Date());
  // Arrivée depuis « À faire » (#conformite, #revision-…) : la carte visée vient en vue.
  useEffect(() => {
    if (hash === '') return;
    const cible = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (typeof cible?.scrollIntoView === 'function') cible.scrollIntoView({ block: 'start' });
  }, [hash]);
  const actions = useActionsLoyer(aujourdhui);
  const etat = etatDuBien(donnees, bien.id, aujourdhui);
  const vacant = etat.statut === 'vacant';
  // « Nouveau locataire » avec ce bien, puis retour sur cette fiche (ADR-G21).
  const louer = lienNouveauLocataire({ bienId: bien.id, retour: lienFicheBien(bien.id) });
  // Ancienne adresse `?louer=1` (liens gardés, application installée) : le formulaire unique.
  if (recherche.get('louer') === '1') return <Navigate replace to={louer} />;

  return (
    <Page espacement="large" className="max-w-[900px]">
      <div className="flex flex-col gap-3">
        <FilAriane
          etapes={[
            { libelle: P.gerer, vers: CHEMIN_GERER },
            { libelle: P.mesBiens, vers: CHEMIN_MES_BIENS },
            { libelle: bien.nom },
          ]}
        />
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
      </div>

      <LocationCreee />
      <RetoursLoyer actions={actions} bailleur={donnees.bailleur} />

      {etat.locations.length === 0 ? (
        <Carte>
          <p className="m-0 text-encre-2">{F.aucuneLocation}</p>
        </Carte>
      ) : (
        etat.locations.map((location) => (
          <Fragment key={location.id}>
            <CarteLocation
              location={location}
              donnees={donnees}
              aujourdhui={aujourdhui}
              // `?modifier=<location>` (montant d'une ligne de loyer) : « Modifier » déjà ouvert.
              modifierOuvert={recherche.get('modifier') === location.id}
            />
            <CarteRevision
              location={location}
              donnees={donnees}
              aujourdhui={aujourdhui}
              retour={lienFicheBien(bien.id)}
            />
          </Fragment>
        ))
      )}

      <CarteConformite bien={bien} donnees={donnees} aujourdhui={aujourdhui} />

      <div>
        <LienBouton to={louer} variante={vacant ? 'primaire' : 'secondaire'}>
          {titreLouer(vacant)}
        </LienBouton>
      </div>

      <CarteArgent bien={bien} donnees={donnees} />

      <FriseMois
        frise={friseDuBien(donnees, bien.id, aujourdhui)}
        actions={actions}
        bienId={bien.id}
      />

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
