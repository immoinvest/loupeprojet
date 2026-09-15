import { jourLocal, type EtatGestion } from '@loupe/gestion';
import type { JSX } from 'react';
import { Link, useLocation } from 'react-router';

import { Page, TitrePage } from '@/composants/mise-en-page';
import { Carte, Pastille } from '@/composants/ui';
import { nomSupprime, resumeDesBiens, type ResumeDuBien } from '@/gestion/biens';
import { useGestion } from '@/gestion/GestionContext';
import {
  bienSupprime,
  loyerParMois,
  nombreDeBiens,
  occupantsDuBien,
  TEXTES_BIENS as T,
} from '@/textes/gerer-biens';
import { STATUTS_LOYER, TONS_LOYER } from '@/textes/gerer-ecrans';
import { statutDuBien, TONS_BIEN } from '@/textes/gerer-fiche';

import { EcranAttente } from './EcranAttente';
import { Portes } from './Portes';

function LigneDuBien({ resume }: { readonly resume: ResumeDuBien }): JSX.Element {
  const { bien, etat, statutDuMois } = resume;
  const noms = resume.locataires.map((l) => `${l.prenom} ${l.nom}`);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-bordure-douce py-3 first:border-t-0">
      <div className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
        <Link
          to={`/gerer/biens/${bien.id}`}
          className="flex min-w-0 items-center font-bold text-encre no-underline survol-texte pointer-coarse:min-h-11"
        >
          <span className="truncate">{bien.nom}</span>
        </Link>
        <span className="truncate text-sm text-encre-3">{bien.adresse}</span>
      </div>
      <div className="flex min-w-0 basis-48 flex-col gap-0.5 text-sm">
        <span className="truncate text-encre-2">
          {occupantsDuBien(noms, resume.locations, resume.aVenir)}
        </span>
        {resume.locations > 0 && (
          <span className="font-semibold tabular-nums">{loyerParMois(resume.loyerMensuel)}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Pastille ton={TONS_BIEN[etat.statut]} compacte>
          {statutDuBien(etat)}
        </Pastille>
        {statutDuMois !== null && (
          <span className="inline-flex items-center gap-1.5 text-xs text-encre-3">
            {T.ceMois}
            <Pastille ton={TONS_LOYER[statutDuMois]} compacte>
              {STATUTS_LOYER[statutDuMois]}
            </Pastille>
          </span>
        )}
      </div>
    </li>
  );
}

function ListeDesBiens({ donnees }: { readonly donnees: EtatGestion }): JSX.Element {
  const resumes = resumeDesBiens(donnees, jourLocal(new Date()));
  // Après « Supprimer ce bien », la fiche revient ici avec le nom du bien supprimé.
  const supprime = nomSupprime(useLocation().state);
  return (
    <Page espacement="large" className="max-w-[900px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold tracking-wider text-encre-3 uppercase">{T.titre}</span>
          <TitrePage taille="accroche">{nombreDeBiens(resumes.length)}</TitrePage>
        </div>
        <Link
          to="/gerer/ajouter"
          className="inline-flex min-h-[44px] items-center rounded-full border border-bordure bg-surface px-4 text-sm font-semibold text-encre-2 no-underline survol-fond"
        >
          {T.ajouter}
        </Link>
      </div>
      {supprime !== null && (
        <p role="status" className="m-0 rounded-encart bg-bon-fond p-3 text-sm text-bon-texte">
          {bienSupprime(supprime)}
        </p>
      )}
      <Carte>
        <ul aria-label={T.titre} className="m-0 flex list-none flex-col p-0">
          {resumes.map((resume) => (
            <LigneDuBien key={resume.bien.id} resume={resume} />
          ))}
        </ul>
      </Carte>
    </Page>
  );
}

/** /gerer/biens : tous les biens, loués ou non ; sans bien, les portes de Gérer. */
export function MesBiens(): JSX.Element {
  const { statut, donnees } = useGestion();
  if (statut !== 'pret' || donnees === null) return <EcranAttente />;
  return donnees.biens.length === 0 ? <Portes /> : <ListeDesBiens donnees={donnees} />;
}
