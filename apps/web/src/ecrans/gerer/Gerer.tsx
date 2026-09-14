import type { JSX } from 'react';

import { useGestion } from '@/gestion/GestionContext';

import { EcranAttente } from './EcranAttente';
import { LoyersDuMois } from './LoyersDuMois';
import { Portes } from './Portes';

/** /gerer : sans compte, en chargement, en erreur, les trois portes, ou les loyers du mois. */
export function Gerer(): JSX.Element {
  const { statut, donnees } = useGestion();
  if (statut !== 'pret' || donnees === null) return <EcranAttente />;
  return donnees.biens.length === 0 ? <Portes /> : <LoyersDuMois donnees={donnees} />;
}
