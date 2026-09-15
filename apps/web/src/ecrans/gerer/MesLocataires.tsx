import { jourLocal, type EtatGestion } from '@loupe/gestion';
import { useState, type JSX } from 'react';
import { Link } from 'react-router';

import { Page, TitrePage } from '@/composants/mise-en-page';
import { Bouton, Carte, TitreCarte } from '@/composants/ui';
import { useGestion } from '@/gestion/GestionContext';
import { groupesDeLocataires, type LigneLocataire } from '@/gestion/locataires';
import { lienFicheLocataire } from '@/gestion/parcours';
import {
  nombreDeLocataires,
  periodeDuLocataire,
  TEXTES_LOCATAIRES as T,
} from '@/textes/gerer-locataires';
import { bienEtChambre } from '@/textes/gerer-loyers';

import { EcranAttente } from './EcranAttente';
import { ModifierLocataire } from './ModifierLocataire';
import { Portes } from './Portes';

function LigneDuLocataire({
  ligne,
  aujourdhui,
}: {
  readonly ligne: LigneLocataire;
  readonly aujourdhui: string;
}): JSX.Element {
  const [ouvert, setOuvert] = useState(false);
  const { locataire } = ligne;
  return (
    <li className="flex flex-col gap-2 border-t border-bordure-douce py-3 first:border-t-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
          <Link
            to={lienFicheLocataire(locataire.id)}
            className="self-start font-bold text-encre no-underline survol-texte pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
          >
            {`${locataire.prenom} ${locataire.nom}`}
          </Link>
          {locataire.email === undefined ? (
            <span className="text-sm font-semibold text-surveiller-texte">{T.emailManquant}</span>
          ) : (
            <span className="truncate text-sm text-encre-3">{locataire.email}</span>
          )}
        </div>
        <div className="flex min-w-0 basis-56 flex-col gap-0.5 text-sm">
          {ligne.occupations.map(({ location, bien }) => (
            <Link
              key={location.id}
              to={`/gerer/biens/${location.bienId}`}
              className="self-start truncate font-semibold pointer-coarse:min-h-11"
            >
              {bienEtChambre(bien?.nom ?? '', location.libelle)}
            </Link>
          ))}
          <span className="text-encre-3">
            {periodeDuLocataire(ligne.entree, ligne.sortie, aujourdhui)}
          </span>
        </div>
        {!ouvert && (
          <Bouton
            onClick={() => {
              setOuvert(true);
            }}
          >
            {T.modifier}
          </Bouton>
        )}
      </div>
      {ouvert && (
        <ModifierLocataire
          locataire={locataire}
          onFermer={() => {
            setOuvert(false);
          }}
        />
      )}
    </li>
  );
}

function Groupe({
  titre,
  lignes,
  aujourdhui,
}: {
  readonly titre: string;
  readonly lignes: readonly LigneLocataire[];
  readonly aujourdhui: string;
}): JSX.Element | null {
  if (lignes.length === 0) return null;
  return (
    <Carte>
      <TitreCarte>{titre}</TitreCarte>
      <ul aria-label={titre} className="m-0 flex list-none flex-col p-0">
        {lignes.map((ligne) => (
          <LigneDuLocataire key={ligne.locataire.id} ligne={ligne} aujourdhui={aujourdhui} />
        ))}
      </ul>
    </Carte>
  );
}

function ListeDesLocataires({ donnees }: { readonly donnees: EtatGestion }): JSX.Element {
  const aujourdhui = jourLocal(new Date());
  const { enCeMoment, anciens } = groupesDeLocataires(donnees, aujourdhui);
  const nombre = enCeMoment.length + anciens.length;
  return (
    <Page espacement="large" className="max-w-[900px]">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold tracking-wider text-encre-3 uppercase">{T.titre}</span>
        <TitrePage taille="accroche">{nombreDeLocataires(nombre)}</TitrePage>
      </div>
      {nombre === 0 && (
        <Carte>
          <p className="m-0 text-encre-2">{T.aucun}</p>
        </Carte>
      )}
      <Groupe titre={T.enCeMoment} lignes={enCeMoment} aujourdhui={aujourdhui} />
      <Groupe titre={T.anciens} lignes={anciens} aujourdhui={aujourdhui} />
    </Page>
  );
}

/** /gerer/locataires : en ce moment, puis anciens ; nom et e-mail se corrigent en deux clics. */
export function MesLocataires(): JSX.Element {
  const { statut, donnees } = useGestion();
  if (statut !== 'pret' || donnees === null) return <EcranAttente />;
  return donnees.biens.length === 0 ? <Portes /> : <ListeDesLocataires donnees={donnees} />;
}
