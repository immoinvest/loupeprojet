import type { ResultatFinancement } from '../financement';
import type { ResultatFiscalite } from '../fiscalite/types';
import type { Regles } from '../regles/types';
import type { Projet } from '../schema/projet';
import { reventeDuRegime, type ResultatRevente } from './par-regime';

/** La revente du régime retenu : alimente `Resultats.revente`, le TRI et l'enrichissement. */
export function calculerRevente(
  projet: Projet,
  financement: ResultatFinancement,
  fiscalite: ResultatFiscalite,
  regles: Regles,
): ResultatRevente {
  return reventeDuRegime(projet, financement, fiscalite.regimes[fiscalite.retenu], regles);
}

export {
  amortissementsAReintegrer,
  reventeDuRegime,
  reventeParRegime,
  type ResultatRevente,
} from './par-regime';
export {
  abattementsDetention,
  plusValueImposable,
  tauxSurtaxe,
  type Abattements,
  type DetailPlusValue,
  type ParametresPlusValue,
} from './plus-value';
export {
  fraisVente,
  valeurRevente,
  valorisationTravaux,
  type FraisVente,
  type MethodeValorisation,
  type ValorisationTravaux,
} from './valeur';
