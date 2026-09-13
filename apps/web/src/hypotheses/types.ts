import type { ProjetEntree } from '@loupe/moteur';

import type { TypeChamp } from './conversion';

export interface Option {
  readonly v: string;
  readonly l: string;
}

export interface Descripteur {
  /** Chemin dans le projet : « hypotheses.pret.tauxNominal », « bien.surface », « marche.dvf.medianM2 ». */
  readonly chemin: string;
  readonly libelle: string;
  readonly type: TypeChamp;
  readonly unite?: string;
  readonly options?: readonly Option[];
  readonly obligatoire?: boolean;
  /** Valeur que l'utilisateur seul connaît (badge « à toi » par défaut). */
  readonly aToi?: boolean;
  readonly visibleSi?: (projet: ProjetEntree) => boolean;
}

export interface Groupe {
  readonly titre: string;
  readonly sousTitre?: string;
  readonly champs: readonly Descripteur[];
}
