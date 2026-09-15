import type { ProjetEntree } from '@loupe/moteur';

import type { CodeTerme } from '@/textes/glossaire';

import type { TypeChamp } from './conversion';

export interface Option {
  readonly v: string;
  readonly l: string;
}

export interface Descripteur {
  /** Chemin dans le projet : « hypotheses.pret.tauxNominal », « bien.surface », « marche.plafondLoyerMensuel ». */
  readonly chemin: string;
  readonly libelle: string;
  readonly type: TypeChamp;
  readonly unite?: string;
  readonly options?: readonly Option[];
  readonly obligatoire?: boolean;
  /** Valeur que l'utilisateur seul connaît (badge « à toi » par défaut). */
  readonly aToi?: boolean;
  readonly visibleSi?: (projet: ProjetEntree) => boolean;
  /** Pour un choix : les options proposées selon le projet (toutes si absent). */
  readonly optionVisibleSi?: (valeur: string, projet: ProjetEntree) => boolean;
  /** Phrase d'aide sous le champ (ce que la valeur change, d'où vient le seuil). */
  readonly aide?: string;
  /** Phrase d'aide composée avec le projet (« soit 10 % du coût total ») ; l'emporte sur `aide`. */
  readonly aideSelon?: (projet: ProjetEntree) => string;
  /** Terme technique expliqué par une icône ⓘ à côté du libellé (glossaire). */
  readonly terme?: CodeTerme;
}

export interface Groupe {
  readonly titre: string;
  readonly sousTitre?: string;
  readonly champs: readonly Descripteur[];
}
