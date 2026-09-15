import {
  IRL,
  JourSchema,
  type ClasseDpe,
  type FormeBail,
  type LegalBienSaisie,
  type RevisionSaisie,
} from '@loupe/gestion';

/** Les choix des formulaires de la vie du bail, en texte, et leur lecture. */

export type ChoixClasse = ClasseDpe | 'inconnue';
export type ChoixOuiNon = 'oui' | 'non' | 'inconnue';

export function choixClasse(classe: ClasseDpe | null): ChoixClasse {
  return classe ?? 'inconnue';
}

export function choixOuiNon(valeur: boolean | null): ChoixOuiNon {
  if (valeur === null) return 'inconnue';
  return valeur ? 'oui' : 'non';
}

export interface SaisieConformite {
  readonly classe: ChoixClasse;
  /** « AAAA-MM-JJ » du champ date, ou vide. */
  readonly date: string;
  readonly zone: ChoixOuiNon;
}

export type LectureConformite =
  { readonly ok: true; readonly saisie: LegalBienSaisie } | { readonly ok: false };

export function lireConformite(s: SaisieConformite): LectureConformite {
  const date = s.date.trim();
  if (date !== '' && !JourSchema.safeParse(date).success) return { ok: false };
  return {
    ok: true,
    saisie: {
      dpeClasse: s.classe === 'inconnue' ? null : s.classe,
      dpeDate: date === '' ? null : date,
      zoneTendue: s.zone === 'inconnue' ? null : s.zone === 'oui',
    },
  };
}

export interface SaisieReglages {
  readonly active: 'oui' | 'non';
  readonly anniversaire: string;
  readonly trimestre: string;
  readonly formeBail: FormeBail;
}

export type LectureReglages =
  { readonly ok: true; readonly saisie: RevisionSaisie } | { readonly ok: false };

export function lireReglages(s: SaisieReglages): LectureReglages {
  const anniversaire = s.anniversaire.trim();
  if (!JourSchema.safeParse(anniversaire).success) return { ok: false };
  return {
    ok: true,
    saisie: {
      active: s.active === 'oui',
      anniversaire,
      trimestre: s.trimestre,
      formeBail: s.formeBail,
    },
  };
}

/** Les trimestres proposés, du plus récent au plus ancien, avec celui déjà choisi s'il est hors du tableau. */
export function trimestresProposes(courant: string): string[] {
  const connus = IRL.map((v) => v.trimestre).reverse();
  return connus.includes(courant) ? connus : [courant, ...connus];
}
