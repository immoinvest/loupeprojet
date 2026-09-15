import {
  declarationDeLAnnee,
  jourLocal,
  lignesDeLAnnee,
  type EtatArgent,
  type EtatGestion,
} from '@loupe/gestion';
import type { JSX } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { Page, TitrePage } from '@/composants/mise-en-page';
import { Bouton, Carte, LienBouton, TitreCarte } from '@/composants/ui';
import { telechargerTexte } from '@/ecrans/simulateur/telecharger';
import { useArgent } from '@/gestion/argent/ArgentContext';
import { donneesArgent } from '@/gestion/argent/page';
import { csvDeLAnnee } from '@/gestion/declaration/csv';
import { anneeDepuisRecherche, anneesProposees } from '@/gestion/declaration/page';
import { useGestion } from '@/gestion/GestionContext';
import { lienDeclaration, lienRecapitulatif } from '@/gestion/parcours';
import {
  nomFichierExport,
  TEXTES_DECLARATION as T,
  titreDeclaration,
} from '@/textes/gerer-declaration';

import { AttenteArgent } from '../argent/AttenteArgent';
import { ListeChoix } from '../argent/ListeChoix';
import { EcranAttente } from '../EcranAttente';
import { BlocFoncier, BlocMeuble, NonReportees } from './BlocsDeclaration';

function PageDeclaration({
  gestion,
  argent,
}: {
  readonly gestion: EtatGestion;
  readonly argent: EtatArgent;
}): JSX.Element {
  const [recherche] = useSearchParams();
  const naviguer = useNavigate();
  const aujourdhui = jourLocal(new Date());
  const annee = anneeDepuisRecherche(recherche, aujourdhui);
  const tout = donneesArgent(gestion, argent);
  const declaration = declarationDeLAnnee(tout, annee);
  const verifiee = declaration.casesVerifiees;

  const exporter = (): void => {
    telechargerTexte(
      nomFichierExport(annee),
      csvDeLAnnee(lignesDeLAnnee(tout, annee), gestion),
      'text/csv;charset=utf-8',
    );
  };

  return (
    <Page espacement="large" className="max-w-[900px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-bold tracking-wider text-encre-3 uppercase">{T.titre}</span>
          <TitrePage>{titreDeclaration(annee)}</TitrePage>
        </div>
        <div className="w-full sm:w-56">
          <ListeChoix
            libelle={T.annee}
            valeur={String(annee)}
            options={anneesProposees(aujourdhui, annee).map((a) => ({
              valeur: String(a),
              libelle: String(a),
            }))}
            onChoix={(a) => {
              void naviguer(lienDeclaration({ annee: Number(a) }), { replace: true });
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1 rounded-encart bg-surveiller-fond p-3 text-sm text-surveiller-texte">
        <p className="m-0">{T.avertissement}</p>
        <p className="m-0 font-semibold">{verifiee ? T.casesVerifiees : T.casesAConfirmer}</p>
      </div>

      {gestion.biens.length === 0 && (
        <Carte>
          <p className="m-0 text-encre-2">{T.aucunBien}</p>
        </Carte>
      )}
      {declaration.foncier !== null && (
        <BlocFoncier groupe={declaration.foncier} verifiee={verifiee} />
      )}
      {declaration.meuble !== null && (
        <BlocMeuble groupe={declaration.meuble} verifiee={verifiee} />
      )}
      {declaration.foncier !== null && declaration.nonReportees.length > 0 && (
        <NonReportees declaration={declaration} />
      )}

      <Carte>
        <TitreCarte>{T.exportTitre}</TitreCarte>
        <p className="m-0 text-sm text-encre-2">{T.exportTexte}</p>
        <div className="flex flex-wrap gap-2">
          <Bouton variante="primaire" onClick={exporter}>
            {T.exporter}
          </Bouton>
          <LienBouton to={lienRecapitulatif(annee)}>{T.recapitulatif}</LienBouton>
        </div>
      </Carte>
    </Page>
  );
}

/** /gerer/declaration : les montants à reporter pour une année de revenus, et l'export de l'année. */
export function Declaration(): JSX.Element {
  const { statut, donnees } = useGestion();
  const argent = useArgent();
  if (statut !== 'pret' || donnees === null) return <EcranAttente />;
  if (argent.donnees === null) return <AttenteArgent titre={T.titre} />;
  return <PageDeclaration gestion={donnees} argent={argent.donnees} />;
}
