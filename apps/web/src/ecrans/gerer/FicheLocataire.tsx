import { jourLocal, type EtatGestion } from '@loupe/gestion';
import { useState, type JSX } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import { Chapo, Page, TitrePage } from '@/composants/mise-en-page';
import { Bouton, Carte, Pastille } from '@/composants/ui';
import { ficheDuLocataire, type FicheLocataire as DonneesFiche } from '@/gestion/fiche-locataire';
import { useEnvois } from '@/gestion/envois/EnvoisContext';
import { telephoneDe } from '@/gestion/envois/logique';
import { useGestion } from '@/gestion/GestionContext';
import { CHEMIN_GERER, CHEMIN_MES_LOCATAIRES } from '@/gestion/parcours';
import { TEXTES_FICHE_LOCATAIRE as T } from '@/textes/gerer-locataire';
import { TEXTES_PARCOURS as P } from '@/textes/gerer-parcours';

import { EcranAttente } from './EcranAttente';
import { CarteAccord } from './envois/CarteAccord';
import { FilAriane } from './FilAriane';
import { FriseMois } from './fiche/FriseMois';
import { CarteOccupation } from './locataire/CarteOccupation';
import { LocationCreee } from './LocationCreee';
import { ModifierLocataire } from './ModifierLocataire';
import { RetoursLoyer } from './RetoursLoyer';
import { useActionsLoyer } from './useActionsLoyer';

function Fiche({
  donnees,
  fiche,
}: {
  readonly donnees: EtatGestion;
  readonly fiche: DonneesFiche;
}): JSX.Element {
  const [recherche] = useSearchParams();
  // `?modifier=1` (« Ajouter l'e-mail » de « À faire ») : le formulaire est déjà ouvert.
  const [modifier, setModifier] = useState(recherche.get('modifier') === '1');
  const aujourdhui = jourLocal(new Date());
  const actions = useActionsLoyer(aujourdhui);
  const { locataire } = fiche;
  const nom = `${locataire.prenom} ${locataire.nom}`;
  const sansEmail = locataire.email === undefined;
  const telephone = telephoneDe(useEnvois().donnees, locataire.id);

  return (
    <Page espacement="large" className="max-w-[900px]">
      <div className="flex flex-col gap-3">
        <FilAriane
          etapes={[
            { libelle: P.gerer, vers: CHEMIN_GERER },
            { libelle: P.mesLocataires, vers: CHEMIN_MES_LOCATAIRES },
            { libelle: nom },
          ]}
        />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col items-start gap-1.5">
            <TitrePage>{nom}</TitrePage>
            {sansEmail ? (
              <Pastille ton="surveiller" compacte>
                {T.emailManquant}
              </Pastille>
            ) : (
              <Chapo className="break-all">{locataire.email}</Chapo>
            )}
            {telephone !== undefined && (
              <a
                href={`tel:${telephone.replace(/[^+0-9]/g, '')}`}
                className="text-[15px] text-encre-2 survol-texte pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
              >
                {telephone}
              </a>
            )}
          </div>
          {!modifier && (
            <Bouton
              variante={sansEmail ? 'primaire' : 'secondaire'}
              onClick={() => {
                setModifier(true);
              }}
            >
              {sansEmail ? T.ajouterEmail : T.modifier}
            </Bouton>
          )}
        </div>
      </div>

      <LocationCreee />

      {modifier && (
        <ModifierLocataire
          locataire={locataire}
          focusEmail
          onFermer={() => {
            setModifier(false);
          }}
        />
      )}

      <CarteAccord locataire={locataire} />

      <RetoursLoyer actions={actions} bailleur={donnees.bailleur} />

      {fiche.occupations.length === 0 ? (
        <Carte>
          <p className="m-0 text-encre-2">{T.aucuneLocation}</p>
        </Carte>
      ) : (
        fiche.occupations.map((occupation) => (
          <CarteOccupation
            key={occupation.location.id}
            occupation={occupation}
            aujourdhui={aujourdhui}
          />
        ))
      )}

      <FriseMois frise={fiche.loyers} actions={actions} titre={T.sesLoyers} vide={T.aucunLoyer} />
    </Page>
  );
}

/** /gerer/locataires/:id : ses coordonnées, ses locations, ses douze derniers loyers. */
export function FicheLocataire(): JSX.Element {
  const { id = '' } = useParams();
  const { statut, donnees } = useGestion();
  if (statut !== 'pret' || donnees === null) return <EcranAttente />;
  const fiche = ficheDuLocataire(donnees, id, jourLocal(new Date()));
  if (fiche === null) {
    return (
      <Page className="max-w-[760px]">
        <TitrePage>{T.introuvable}</TitrePage>
        <Chapo>
          {T.introuvableTexte} <Link to={CHEMIN_MES_LOCATAIRES}>{T.voirLocataires}</Link>
        </Chapo>
      </Page>
    );
  }
  return <Fiche donnees={donnees} fiche={fiche} />;
}
