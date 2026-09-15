import type { obtenirRegles } from '@loupe/moteur';

type Regles = ReturnType<typeof obtenirRegles>;

export type CodePeriode = 'avant_plomb' | 'avant_amiante' | 'installations_anciennes' | 'recente';

export interface PeriodeConstruction {
  readonly code: CodePeriode;
  readonly libelle: string;
  /** Première et dernière année comprises ; `null` : ouverte de ce côté. */
  readonly debut: number | null;
  readonly fin: number | null;
  /** L'année transmise quand on choisit la période : le milieu, marqué « estimé ». */
  readonly representative: number;
}

/** Borne basse conventionnelle de « Avant 1949 », pour situer son année représentative. */
export const DEBUT_CONVENTIONNEL = 1900;

const milieu = (debut: number, fin: number): number => Math.round((debut + fin) / 2);

/**
 * Les quatre périodes de construction, calées sur les seuils des questions de visite : plomb, amiante,
 * installations de plus de N ans (le moteur les dit anciennes jusqu'à l'année de référence − N). Une année
 * représentative de chaque période donne exactement les mêmes questions que l'année exacte.
 */
export function periodesConstruction(regles: Regles): readonly PeriodeConstruction[] {
  const {
    plombAvantAnnee: plomb,
    amianteAvantAnnee: amiante,
    installationsAnciennesAns,
  } = regles.visite;
  const reference = Number(regles.dateReference.slice(0, 4));
  const recente = reference - installationsAnciennesAns + 1;
  return [
    {
      code: 'avant_plomb',
      libelle: `Avant ${String(plomb)}`,
      debut: null,
      fin: plomb - 1,
      representative: milieu(DEBUT_CONVENTIONNEL, plomb - 1),
    },
    {
      code: 'avant_amiante',
      libelle: `${String(plomb)} à ${String(amiante - 1)}`,
      debut: plomb,
      fin: amiante - 1,
      representative: milieu(plomb, amiante - 1),
    },
    {
      code: 'installations_anciennes',
      libelle: `${String(amiante)} à ${String(recente - 1)}`,
      debut: amiante,
      fin: recente - 1,
      representative: milieu(amiante, recente - 1),
    },
    {
      code: 'recente',
      libelle: `${String(recente)} et après`,
      debut: recente,
      fin: null,
      representative: milieu(recente, reference),
    },
  ];
}

/** La période d'une année écrite (« 1972 ») ; `''` pour une année vide ou illisible. */
export function periodeDeAnnee(
  annee: string,
  periodes: readonly PeriodeConstruction[],
): CodePeriode | '' {
  if (!/^\s*\d{4}\s*$/.test(annee)) return '';
  const n = Number(annee);
  const trouvee = periodes.find((p) => p.fin === null || n <= p.fin);
  return trouvee?.code ?? '';
}
