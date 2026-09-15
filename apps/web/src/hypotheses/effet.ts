import type { Resultats } from '@loupe/moteur';

import { euros, eurosParMois, pourcentage } from '@/formatage/nombres';

import { lireChemin } from './chemins';
import { descripteurLie } from './liens';
import { texteLisible } from './lisible';

export type CodeIndicateurLie =
  | 'cashflow'
  | 'rendementNet'
  | 'mensualite'
  | 'impot'
  | 'cashNet'
  | 'tri'
  | 'coutTotal'
  | 'prixEstime';

interface Lecture {
  readonly libelle: string;
  readonly lire: (r: Resultats) => string;
}

const ou = (valeur: number | null, formater: (v: number) => string): string =>
  valeur === null ? '—' : formater(valeur);

const LECTURES: Readonly<Record<CodeIndicateurLie, Lecture>> = {
  cashflow: {
    libelle: 'Cash-flow',
    lire: (r) => ou(r.complet ? r.cashflow.mensuel : null, eurosParMois),
  },
  rendementNet: {
    libelle: 'Rendement net',
    lire: (r) => ou(r.complet ? r.rendement.rendements.net : null, (v) => pourcentage(v)),
  },
  mensualite: {
    libelle: 'Mensualité',
    lire: (r) => `${euros(r.financement.mensualiteTotale)}/mois`,
  },
  impot: {
    libelle: 'Impôt du régime retenu',
    lire: (r) => ou(r.complet ? r.fiscalite.regimes[r.fiscalite.retenu].impotTotal : null, euros),
  },
  cashNet: {
    libelle: 'Cash net à la revente',
    lire: (r) => ou(r.complet ? r.revente.cashNetVendeur : null, euros),
  },
  tri: {
    libelle: 'TRI',
    lire: (r) => ou(r.complet ? r.rendement.tri : null, (v) => pourcentage(v)),
  },
  coutTotal: {
    libelle: 'Coût total du projet',
    lire: (r) => euros(r.financement.coutTotalProjet),
  },
  prixEstime: {
    libelle: 'Prix estimé',
    lire: (r) => ou(r.estimation?.centre ?? null, euros),
  },
};

/** Par préfixe de chemin, les deux chiffres que l'hypothèse change le plus directement. */
const LIES: readonly (readonly [string, readonly CodeIndicateurLie[]])[] = [
  ['hypotheses.location.', ['cashflow', 'rendementNet']],
  ['hypotheses.charges.', ['cashflow', 'rendementNet']],
  ['marche.', ['cashflow', 'rendementNet']],
  ['hypotheses.pret.', ['mensualite', 'cashflow']],
  ['hypotheses.fiscalite.', ['impot', 'cashNet']],
  ['hypotheses.revente.', ['cashNet', 'tri']],
  ['hypotheses.achat.', ['coutTotal', 'cashflow']],
  ['bien.', ['prixEstime', 'cashflow']],
];

export function indicateursLies(chemin: string): readonly CodeIndicateurLie[] {
  return LIES.find(([prefixe]) => chemin.startsWith(prefixe))?.[1] ?? ['cashflow'];
}

export interface EffetIndicateur {
  readonly code: CodeIndicateurLie;
  readonly libelle: string;
  readonly avant: string;
  readonly apres: string;
}

export interface EffetModification {
  readonly libelle: string;
  readonly avant: string;
  readonly apres: string;
  /** Seulement les chiffres liés qui ont changé. */
  readonly indicateurs: readonly EffetIndicateur[];
}

/**
 * L'effet d'une modification d'hypothèse : sa valeur avant et après, et les chiffres liés qui ont
 * bougé. `null` quand rien de visible n'a changé (ou chemin inconnu).
 */
export function effetsDe(
  avant: Resultats,
  apres: Resultats,
  chemin: string,
): EffetModification | null {
  const d = descripteurLie(chemin);
  if (d === null) return null;
  const valeurAvant = texteLisible(d, lireChemin(avant.projet, chemin));
  const valeurApres = texteLisible(d, lireChemin(apres.projet, chemin));
  const indicateurs = indicateursLies(chemin)
    .map((code) => ({
      code,
      libelle: LECTURES[code].libelle,
      avant: LECTURES[code].lire(avant),
      apres: LECTURES[code].lire(apres),
    }))
    .filter((i) => i.avant !== i.apres);
  if (valeurAvant === valeurApres && indicateurs.length === 0) return null;
  return { libelle: d.libelle, avant: valeurAvant, apres: valeurApres, indicateurs };
}
