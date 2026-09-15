import {
  JourSchema,
  LIBELLE_DEPENSE_MAX,
  type CategorieDepense,
  type Depense,
  type Frequence,
  type NouvelleDepense,
} from '@loupe/gestion';

import { centimesDepuisTexte } from '../saisie';

/** « Une seule fois » ou une fréquence. */
export type ChoixFrequence = Frequence | 'aucune';

/** Le formulaire d'une dépense, en texte comme il est saisi. */
export interface SaisieDepense {
  readonly montant: string;
  readonly categorie: CategorieDepense;
  /** L'identifiant du bien, ou `SANS_BIEN`. */
  readonly bienId: string;
  readonly date: string;
  readonly libelle: string;
  readonly recuperable: boolean;
  readonly frequence: ChoixFrequence;
  /** Dernier jour d'une dépense qui revient ; vide = sans fin. */
  readonly jusquAu: string;
}

export type ChampDepense = 'montant' | 'date' | 'libelle' | 'jusquAu';

/** « Aucun bien » dans la liste des biens : une dépense commune. */
export const SANS_BIEN = '';

export type LectureDepense =
  | { readonly ok: true; readonly depense: NouvelleDepense }
  | { readonly ok: false; readonly erreurs: readonly ChampDepense[] };

/** Un nouveau formulaire : aujourd'hui, une seule fois, entretien, le bien d'où l'on vient s'il y en a un. */
export function saisieDepenseInitiale(
  aujourdhui: string,
  bienId: string = SANS_BIEN,
): SaisieDepense {
  return {
    montant: '',
    categorie: 'entretien',
    bienId,
    date: aujourdhui,
    libelle: '',
    recuperable: false,
    frequence: 'aucune',
    jusquAu: '',
  };
}

/** 84 000 centimes → « 840 » ; 12 050 → « 120,50 ». */
export function texteDeCentimes(centimes: number): string {
  return (centimes / 100).toFixed(2).replace('.', ',').replace(/,00$/, '');
}

/** Le formulaire « Modifier » d'une dépense enregistrée. */
export function saisieDepuisDepense(depense: Depense): SaisieDepense {
  return {
    montant: texteDeCentimes(depense.montant),
    categorie: depense.categorie,
    bienId: depense.bienId ?? SANS_BIEN,
    date: depense.date,
    libelle: depense.libelle ?? '',
    recuperable: depense.recuperable,
    frequence: depense.recurrence?.frequence ?? 'aucune',
    jusquAu: depense.recurrence?.jusquAu ?? '',
  };
}

/** La dépense à envoyer, ou les champs à corriger dans l'ordre de l'écran. */
export function lireDepense(saisie: SaisieDepense): LectureDepense {
  const erreurs: ChampDepense[] = [];
  const montant = centimesDepuisTexte(saisie.montant) ?? 0;
  if (montant === 0) erreurs.push('montant');
  const dateValide = JourSchema.safeParse(saisie.date).success;
  if (!dateValide) erreurs.push('date');
  const libelle = saisie.libelle.trim();
  if (libelle.length > LIBELLE_DEPENSE_MAX) erreurs.push('libelle');
  const jusquAu = saisie.jusquAu.trim();
  const finInvalide =
    jusquAu !== '' && (!JourSchema.safeParse(jusquAu).success || jusquAu < saisie.date);
  if (saisie.frequence !== 'aucune' && finInvalide) erreurs.push('jusquAu');
  if (erreurs.length > 0) return { ok: false, erreurs };
  return {
    ok: true,
    depense: {
      ...(saisie.bienId === SANS_BIEN ? {} : { bienId: saisie.bienId }),
      categorie: saisie.categorie,
      montant,
      date: saisie.date,
      ...(libelle === '' ? {} : { libelle }),
      recuperable: saisie.recuperable,
      ...(saisie.frequence === 'aucune'
        ? {}
        : {
            recurrence: {
              frequence: saisie.frequence,
              ...(jusquAu === '' ? {} : { jusquAu }),
            },
          }),
    },
  };
}
