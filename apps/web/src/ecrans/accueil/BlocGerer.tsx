import { jourLocal, periodeDe, resumeDuMois, type EtatGestion } from '@loupe/gestion';
import type { JSX } from 'react';

import { Bouton, Carte, LienBouton, Pastille, TitreCarte } from '@/composants/ui';
import { moisEnLettres, montant } from '@/gestion/format';
import { useGestion } from '@/gestion/GestionContext';
import { nombreDeBiens, TEXTES_ACCUEIL as T } from '@/textes/accueil';
import { ERREURS_GESTION, loyersEnRetard } from '@/textes/gerer';
import { avecMajuscule, phraseDuMois, TEXTES_GERER } from '@/textes/gerer-ecrans';

const CLASSE_ACCROCHE = 'm-0 font-display text-[22px] leading-tight font-bold text-balance';

function AvecBiens({ donnees }: { donnees: EtatGestion }): JSX.Element {
  const aujourdhui = jourLocal(new Date());
  const periode = periodeDe(aujourdhui);
  const resume = resumeDuMois(donnees, periode, aujourdhui);
  const part = resume.montantDu === 0 ? 0 : (resume.montantRecu / resume.montantDu) * 100;

  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold tracking-wider text-encre-3 uppercase">
          {avecMajuscule(moisEnLettres(periode))} · {nombreDeBiens(donnees.biens.length)}
        </span>
        <p className={CLASSE_ACCROCHE}>{phraseDuMois(resume.nombreRecus, resume.lignes.length)}</p>
      </div>
      {resume.lignes.length > 0 && (
        <div className="flex flex-col gap-2">
          <div
            role="img"
            aria-label={`${montant(resume.montantRecu)} reçus sur ${montant(resume.montantDu)}`}
            className="h-3 overflow-hidden rounded-full bg-bordure-douce"
          >
            <div className="h-full rounded-full bg-bon" style={{ width: `${String(part)}%` }} />
          </div>
          <span className="self-start">
            {resume.nombreEnRetard > 0 ? (
              <Pastille ton="probleme" compacte>
                {loyersEnRetard(resume.nombreEnRetard)}
              </Pastille>
            ) : (
              <Pastille ton="bon" compacte>
                {T.aJour}
              </Pastille>
            )}
          </span>
        </div>
      )}
      <div className="mt-auto flex flex-wrap gap-2 pt-2">
        <LienBouton to="/gerer" variante="primaire">
          {T.voirLoyers}
        </LienBouton>
        <LienBouton to="/gerer/ajouter">{T.ajouterBien}</LienBouton>
      </div>
    </>
  );
}

/** Le bloc Gérer de l'accueil : sans compte, en chargement, en erreur, sans bien ou avec des biens. */
export function BlocGerer(): JSX.Element {
  const { statut, donnees, erreur, recharger } = useGestion();

  let contenu: JSX.Element;
  if (statut === 'anonyme') {
    contenu = (
      <>
        <p className={CLASSE_ACCROCHE}>{T.gererSansCompteTitre}</p>
        <p className="m-0 text-[15px] text-encre-2">{T.gererSansCompteTexte}</p>
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <LienBouton to="/connexion?retour=/" variante="primaire">
            {T.seConnecter}
          </LienBouton>
        </div>
      </>
    );
  } else if (statut === 'chargement') {
    contenu = <p className="m-0 text-encre-3">{TEXTES_GERER.chargement}</p>;
  } else if (statut === 'erreur' || donnees === null) {
    contenu = (
      <>
        <p role="alert" className="m-0 text-encre-2">
          {ERREURS_GESTION[erreur ?? 'inconnue']}
        </p>
        <div>
          <Bouton variante="primaire" onClick={recharger}>
            {TEXTES_GERER.reessayer}
          </Bouton>
        </div>
      </>
    );
  } else if (donnees.biens.length === 0) {
    contenu = (
      <>
        <p className={CLASSE_ACCROCHE}>{T.gererVideTitre}</p>
        <p className="m-0 text-[15px] text-encre-2">{T.gererVideTexte}</p>
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <LienBouton to="/gerer" variante="primaire">
            {T.ajouterPremierBien}
          </LienBouton>
        </div>
      </>
    );
  } else {
    contenu = <AvecBiens donnees={donnees} />;
  }

  return (
    <Carte className="h-full">
      <TitreCarte>{T.gerer}</TitreCarte>
      {contenu}
    </Carte>
  );
}
