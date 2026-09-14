import { jourLocal, periodeDe, resumeDuMois, type EtatGestion } from '@loupe/gestion';
import { Fragment, type JSX } from 'react';
import { Link } from 'react-router';

import { Page, TitrePage } from '@/composants/mise-en-page';
import { Carte, TitreCarte } from '@/composants/ui';
import { dateEnLettres, moisEnLettres, montant } from '@/gestion/format';
import {
  avecMajuscule,
  entreesAVenir,
  phraseDuMois,
  TEXTES_GERER as T,
} from '@/textes/gerer-ecrans';
import { TEXTES_LOYERS } from '@/textes/gerer-loyers';

import { ListeDeLoyers } from './LigneDeLoyer';
import { RetoursLoyer } from './RetoursLoyer';
import { useActionsLoyer } from './useActionsLoyer';

/** L'accueil de Gérer quand il y a des biens : qui a payé ce mois-ci, « Reçu » en un clic. */
export function LoyersDuMois({ donnees }: { donnees: EtatGestion }): JSX.Element {
  const aujourdhui = jourLocal(new Date());
  const actions = useActionsLoyer(aujourdhui);
  const periode = periodeDe(aujourdhui);
  const resume = resumeDuMois(donnees, periode, aujourdhui);
  // Un bien est vacant sans location en cours ni à venir ; une entrée le mois prochain n'est pas une vacance.
  const enCours = donnees.locations.filter((l) => l.fin === undefined || l.fin >= aujourdhui);
  const loues = new Set(enCours.map((l) => l.bienId));
  const vacants = donnees.biens.filter((b) => !loues.has(b.id));
  const aVenir = enCours
    .filter((l) => periodeDe(l.debut) > periode)
    .map((l) => ({
      nom: donnees.biens.find((b) => b.id === l.bienId)?.nom ?? '',
      date: dateEnLettres(l.debut),
    }));
  const part = resume.montantDu === 0 ? 0 : (resume.montantRecu / resume.montantDu) * 100;

  return (
    <Page espacement="large">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold tracking-wider text-encre-3 uppercase">
            {avecMajuscule(moisEnLettres(periode))}
          </span>
          <TitrePage taille="accroche">
            {phraseDuMois(resume.nombreRecus, resume.lignes.length)}
          </TitrePage>
        </div>
        <Link
          to="/gerer/ajouter"
          className="inline-flex min-h-[44px] items-center rounded-full border border-bordure bg-surface px-4 text-sm font-semibold text-encre-2 no-underline hover:bg-accent-fond"
        >
          {T.ajouterBien}
        </Link>
      </div>

      {resume.lignes.length > 0 && (
        <div className="flex flex-col gap-2">
          <div
            role="img"
            aria-label={`${montant(resume.montantRecu)} reçus sur ${montant(resume.montantDu)}`}
            className="h-3.5 overflow-hidden rounded-full bg-bordure-douce"
          >
            <div className="h-full rounded-full bg-bon" style={{ width: `${String(part)}%` }} />
          </div>
          <div className="flex justify-between text-sm text-encre-3 tabular-nums">
            <span>
              <b className="text-encre">{montant(resume.montantRecu)}</b> reçus
            </span>
            <span>sur {montant(resume.montantDu)}</span>
          </div>
        </div>
      )}

      <RetoursLoyer actions={actions} bailleur={donnees.bailleur} />

      {resume.lignes.length > 0 && (
        <Carte>
          <TitreCarte
            action={
              <Link
                to="/gerer/loyers"
                className="inline-flex items-center text-sm font-semibold text-accent hover:text-accent-fonce pointer-coarse:min-h-11"
              >
                {TEXTES_LOYERS.voirTous}
              </Link>
            }
          >
            {T.listeTitre}
          </TitreCarte>
          <ListeDeLoyers lignes={resume.lignes} aujourdhui={aujourdhui} actions={actions} />
        </Carte>
      )}
      {aVenir.length > 0 && <p className="m-0 text-sm text-encre-3">{entreesAVenir(aVenir)}</p>}
      {vacants.length > 0 && (
        // Chaque bien vacant ouvre sa fiche, où l'on ajoute son locataire.
        <p className="m-0 text-sm text-encre-3">
          {T.sansLocataire}{' '}
          {vacants.map((bien, i) => (
            <Fragment key={bien.id}>
              {i > 0 && ', '}
              <Link to={`/gerer/biens/${bien.id}?louer=1`}>{bien.nom}</Link>
            </Fragment>
          ))}
        </p>
      )}
    </Page>
  );
}
