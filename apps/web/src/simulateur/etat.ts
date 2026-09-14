import type { Regles } from '@loupe/moteur';

import { decoderSimulation, lireFragmentSimulation } from './lien';
import { lireSimulation } from './memoire';
import { saisieDefaut, saisieDepuisSimulation, type Saisie } from './saisie';

export interface EtatInitial {
  readonly saisie: Saisie;
  /** Un fragment `#s=` était là mais ne se lit pas : la page le dit et affiche les défauts. */
  readonly lienIllisible: boolean;
  /** Une simulation reçue par lien ou retrouvée s'enregistre tout de suite ; les défauts, seulement après une modification. */
  readonly aEnregistrer: boolean;
}

/** À l'ouverture : le fragment `#s=` s'il existe, sinon la dernière simulation, sinon les défauts. */
export function etatInitial(hash: string, stockage: Storage, regles: Regles): EtatInitial {
  const fragment = lireFragmentSimulation(hash);
  if (fragment !== null) {
    const decodage = decoderSimulation(fragment);
    return decodage.ok
      ? {
          saisie: saisieDepuisSimulation(decodage.simulation),
          lienIllisible: false,
          aEnregistrer: true,
        }
      : { saisie: saisieDefaut(regles), lienIllisible: true, aEnregistrer: false };
  }
  const retrouvee = lireSimulation(stockage);
  return retrouvee === null
    ? { saisie: saisieDefaut(regles), lienIllisible: false, aEnregistrer: false }
    : { saisie: saisieDepuisSimulation(retrouvee), lienIllisible: false, aEnregistrer: true };
}
