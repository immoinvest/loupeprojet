import type { JSX } from 'react';

import { useCompte } from '@/compte/CompteContext';
import { Page, TitrePage } from '@/composants/mise-en-page';
import { useGestion } from '@/gestion/GestionContext';
import { titreAccueil } from '@/textes/accueil';

import { BlocAnalyser } from './accueil/BlocAnalyser';
import { BlocGerer } from './accueil/BlocGerer';

/**
 * L'accueil : un bloc par section affichée dans le menu. Deux sections : côte à côte à partir de
 * 1 024 px, empilées en dessous ; une seule : une colonne.
 */
export function Accueil(): JSX.Element {
  const { sections } = useGestion();
  const { utilisateur } = useCompte();
  const deux = sections.analyser && sections.gerer;

  return (
    <Page espacement="large" className={deux ? '' : 'max-w-[760px]'}>
      <TitrePage>{titreAccueil(utilisateur?.nom ?? null)}</TitrePage>
      <div className={deux ? 'grid items-stretch gap-4 lg:grid-cols-2' : 'flex flex-col gap-4'}>
        {sections.analyser && <BlocAnalyser gerer={sections.gerer} />}
        {sections.gerer && <BlocGerer />}
      </div>
    </Page>
  );
}
