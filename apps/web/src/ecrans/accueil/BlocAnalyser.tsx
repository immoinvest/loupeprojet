import { calculerProjet } from '@loupe/moteur';
import { useMemo, type JSX } from 'react';
import { Link } from 'react-router';

import { ETAPES, resumeAnalyser, type ResumeAnalyser } from '@/accueil';
import { Carte, GrosChiffre, LienBouton, TitreCarte } from '@/composants/ui';
import { eurosParMois } from '@/formatage/nombres';
import { useProjets } from '@/stockage/ProjetsContext';
import { STATUTS, type ProjetEnregistre } from '@/stockage/projets';
import { BOUTONS_ETAPE, phraseEtape, projetsAEtudier, TEXTES_ACCUEIL as T } from '@/textes/accueil';

function cashflowMensuel(p: ProjetEnregistre): number | null {
  const r = calculerProjet(p.projet, { avecScenarios: false });
  return r.complet ? r.cashflow.mensuel : null;
}

function Vide({ exemple }: { exemple: ProjetEnregistre | null }): JSX.Element {
  return (
    <>
      <p className="m-0 font-display text-[22px] leading-tight font-bold text-balance">
        {T.analyserVideTitre}
      </p>
      <p className="m-0 text-[15px] text-encre-2">{T.analyserVideTexte}</p>
      <div className="mt-auto flex flex-wrap gap-2 pt-2">
        <LienBouton to="/projets/nouveau" variante="primaire">
          {T.analyserAnnonce}
        </LienBouton>
        {exemple !== null && <LienBouton to={`/projets/${exemple.id}`}>{T.voirExemple}</LienBouton>}
      </div>
    </>
  );
}

function Parcours({ resume }: { resume: ResumeAnalyser }): JSX.Element {
  return (
    <ol aria-label={T.parcours} className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-4">
      {ETAPES.map((etape) => (
        <li
          key={etape}
          className={`flex flex-col gap-0.5 rounded-encart border px-3 py-2 ${
            resume.parEtape[etape] > 0
              ? 'border-accent-bordure bg-accent-fond'
              : 'border-bordure-douce text-encre-3'
          }`}
        >
          <span className="font-display text-xl font-bold tabular-nums">
            {resume.parEtape[etape]}
          </span>
          <span className="text-xs font-semibold">{STATUTS[etape]}</span>
        </li>
      ))}
    </ol>
  );
}

function AvecProjets({ resume }: { resume: ResumeAnalyser }): JSX.Element {
  const { meilleur, prochaine } = resume;
  return (
    <>
      <GrosChiffre complement={projetsAEtudier(resume.aEtudier)}>{resume.aEtudier}</GrosChiffre>
      <Parcours resume={resume} />
      {meilleur !== null && (
        <Link
          to={`/projets/${meilleur.projet.id}`}
          className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-encart border border-bordure px-3 py-2 text-encre no-underline survol-fond"
        >
          <span className="flex min-w-0 flex-col">
            <span className="text-xs text-encre-3">{T.meilleurCashflow}</span>
            <span className="truncate text-[15px] font-bold">{meilleur.projet.nom}</span>
          </span>
          <span
            className={`font-bold tabular-nums ${meilleur.mensuel < 0 ? 'text-probleme' : 'text-bon'}`}
          >
            {eurosParMois(meilleur.mensuel)}
          </span>
        </Link>
      )}
      {prochaine === null ? (
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <LienBouton to="/projets/nouveau" variante="primaire">
            {T.analyserAnnonce}
          </LienBouton>
          <LienBouton to="/projets">{T.tousMesProjets}</LienBouton>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 rounded-encart bg-accent-fond p-3">
            <span className="text-xs font-bold tracking-wider text-accent uppercase">
              {T.prochaineEtape}
            </span>
            <p className="m-0 text-[15px] font-semibold">
              {phraseEtape(prochaine.action, prochaine.projet.nom)}
            </p>
            <span>
              <LienBouton to={prochaine.chemin} variante="primaire">
                {BOUTONS_ETAPE[prochaine.action]}
              </LienBouton>
            </span>
          </div>
          <div className="mt-auto flex flex-wrap gap-2 pt-2">
            <LienBouton to="/projets/nouveau">{T.nouveauProjet}</LienBouton>
            <LienBouton to="/projets">{T.tousMesProjets}</LienBouton>
          </div>
        </>
      )}
    </>
  );
}

/** Le bloc Analyser de l'accueil : un appel à l'action sans projet, l'avancement sinon. */
export function BlocAnalyser({ gerer }: { gerer: boolean }): JSX.Element {
  const { projets } = useProjets();
  const resume = useMemo(
    () => resumeAnalyser(projets, { gerer, cashflow: cashflowMensuel }),
    [projets, gerer],
  );

  return (
    <Carte className="h-full">
      <TitreCarte>{T.analyser}</TitreCarte>
      {resume.vide ? <Vide exemple={resume.exemple} /> : <AvecProjets resume={resume} />}
    </Carte>
  );
}
