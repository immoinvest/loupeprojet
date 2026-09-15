import {
  jourLocal,
  periodePrecedente,
  periodeSuivante,
  resumeDuMois,
  type EtatGestion,
} from '@loupe/gestion';
import type { JSX } from 'react';
import { useSearchParams } from 'react-router';

import { Page, TitrePage } from '@/composants/mise-en-page';
import { Carte, LienBouton, TitreCarte } from '@/composants/ui';
import { moisEnLettres } from '@/gestion/format';
import { useGestion } from '@/gestion/GestionContext';
import { groupesDuMois, periodeDepuisRecherche } from '@/gestion/loyers-page';
import { avecMajuscule } from '@/textes/gerer-ecrans';
import { GROUPES_LOYERS_TEXTES, TEXTES_LOYERS as T } from '@/textes/gerer-loyers';

import { EcranAttente } from './EcranAttente';
import { ListeDeLoyers } from './LigneDeLoyer';
import { RetoursLoyer } from './RetoursLoyer';
import { useActionsLoyer } from './useActionsLoyer';

function lienDuMois(periode: string): string {
  return `/gerer/loyers?mois=${periode}`;
}

/** Un mois de loyers, groupés : en retard, partiels, attendus, reçus. */
function MoisDeLoyers({ donnees }: { readonly donnees: EtatGestion }): JSX.Element {
  const [recherche] = useSearchParams();
  const aujourdhui = jourLocal(new Date());
  const actions = useActionsLoyer(aujourdhui);
  const periode = periodeDepuisRecherche(recherche.get('mois'), aujourdhui);
  const groupes = groupesDuMois(resumeDuMois(donnees, periode, aujourdhui).lignes);
  // `?bien=` (un mois de la frise d'un bien) : les lignes de ce bien sont mises en évidence.
  const enEvidence = recherche.get('bien');

  return (
    <Page espacement="large">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold tracking-wider text-encre-3 uppercase">{T.titre}</span>
          <TitrePage taille="accroche">{avecMajuscule(moisEnLettres(periode))}</TitrePage>
        </div>
        <nav aria-label={T.choixDuMois} className="flex flex-wrap gap-2">
          <LienBouton to={lienDuMois(periodePrecedente(periode))}>{T.moisPrecedent}</LienBouton>
          <LienBouton to={lienDuMois(periodeSuivante(periode))}>{T.moisSuivant}</LienBouton>
        </nav>
      </div>

      <RetoursLoyer actions={actions} bailleur={donnees.bailleur} />

      {groupes.length === 0 ? (
        <p className="m-0 text-encre-3">{T.aucun}</p>
      ) : (
        groupes.map((g) => (
          <Carte key={g.groupe}>
            <TitreCarte>{GROUPES_LOYERS_TEXTES[g.groupe]}</TitreCarte>
            <ListeDeLoyers
              lignes={g.lignes}
              aujourdhui={aujourdhui}
              actions={actions}
              enEvidence={enEvidence}
            />
          </Carte>
        ))
      )}
    </Page>
  );
}

/** /gerer/loyers : n'importe quel mois (`?mois=2026-10`), le mois en cours par défaut. */
export function Loyers(): JSX.Element {
  const { statut, donnees } = useGestion();
  if (statut !== 'pret' || donnees === null) return <EcranAttente />;
  return <MoisDeLoyers donnees={donnees} />;
}
