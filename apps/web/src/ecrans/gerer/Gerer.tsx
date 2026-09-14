import type { JSX } from 'react';

import { Page, TitrePage } from '@/composants/mise-en-page';
import { Bouton, Carte } from '@/composants/ui';
import { useGestion } from '@/gestion/GestionContext';
import { ERREURS_GESTION } from '@/textes/gerer';
import { TEXTES_GERER as T } from '@/textes/gerer-ecrans';

import { LoyersDuMois } from './LoyersDuMois';
import { Portes } from './Portes';
import { SansCompte } from './SansCompte';

/** /gerer : sans compte, en chargement, en erreur, les trois portes, ou les loyers du mois. */
export function Gerer(): JSX.Element {
  const { statut, donnees, erreur, recharger } = useGestion();

  if (statut === 'anonyme') return <SansCompte />;
  if (statut === 'chargement') {
    return (
      <Page>
        <p className="m-0 text-encre-3">{T.chargement}</p>
      </Page>
    );
  }
  if (statut === 'erreur' || donnees === null) {
    return (
      <Page className="max-w-[760px]">
        <TitrePage>{T.titre}</TitrePage>
        <Carte>
          <p role="alert" className="m-0 text-encre-2">
            {ERREURS_GESTION[erreur ?? 'inconnue']}
          </p>
          <div>
            <Bouton variante="primaire" onClick={recharger}>
              {T.reessayer}
            </Bouton>
          </div>
        </Carte>
      </Page>
    );
  }
  return donnees.biens.length === 0 ? <Portes /> : <LoyersDuMois donnees={donnees} />;
}
