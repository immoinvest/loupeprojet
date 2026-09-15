import type { ModeLocation } from '@loupe/moteur';

import type { Provenance } from '@/annonces';
import type { PeriodeConstruction } from '@/verifier/periodes';

import type { CleLoyerEstime } from './EstimerLoyer';
import type { ApercuApport, Cle, Erreurs, ProvenanceValeurs, Valeurs } from './valeurs';

/** L'état du formulaire et ses actions, passés à chaque commande. */
export interface ContexteFormulaire {
  readonly valeurs: Valeurs;
  readonly provenance: ProvenanceValeurs;
  readonly erreurs: Erreurs;
  readonly apport: ApercuApport;
  readonly periodes: readonly PeriodeConstruction[];
  /** Une saisie de la personne : la provenance devient « utilisateur ». */
  readonly changer: (cle: Cle, valeur: string) => void;
  /** Plusieurs valeurs d'un coup, avec leur provenance (`undefined` l'efface). */
  readonly poser: (
    valeurs: Partial<Valeurs>,
    provenance: Partial<Record<Cle, Provenance | undefined>>,
  ) => void;
  /** Les pièces : les chambres estimées suivent. */
  readonly changerPieces: (valeur: string) => void;
  readonly changerMode: (mode: ModeLocation) => void;
  readonly loyerEstime: (cle: CleLoyerEstime, valeur: string) => void;
}

export const OUI_NON = [
  { valeur: 'oui', libelle: 'Oui' },
  { valeur: 'non', libelle: 'Non' },
] as const;

export type OuiNon = (typeof OUI_NON)[number]['valeur'];

export const GRILLE = 'grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3';
