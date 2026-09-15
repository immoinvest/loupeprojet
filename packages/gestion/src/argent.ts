import { ajouterMois, bornesPeriode, periodeDe } from './dates';
import type { Depense, PretEnregistre } from './depenses';
import { echeanceDuMois, moisEntre } from './pret';
import { CATEGORIES_DEPENSE, MOIS_PAR_FREQUENCE, type CategorieDepense } from './regles-argent';
import type { EtatGestion } from './schemas';

/*
 * Ce que les biens rapportent vraiment (G5-1, ADR-G28) : loyers encaissés à la date du paiement,
 * dépenses (occurrences des dépenses récurrentes comprises), mensualités des prêts, et le cash-flow
 * réel qui en résulte. Tout se calcule à l'affichage depuis les données, rien n'est stocké.
 */

export type DonneesArgent = Pick<EtatGestion, 'biens' | 'locations' | 'paiements'> & {
  readonly depenses: readonly Depense[];
  readonly prets: readonly PretEnregistre[];
};

export interface OptionsArgent {
  /** Un seul bien : les dépenses sans bien sont alors écartées. */
  readonly bienId?: string | undefined;
}

export interface Flux {
  readonly loyers: number;
  readonly depenses: number;
  /** Mensualités des prêts, assurance comprise. */
  readonly mensualites: number;
}

/** Encaissé − dépenses − mensualités, en centimes (négatif = effort d'épargne). */
export function cashflowReel(flux: Flux): number {
  return flux.loyers - flux.depenses - flux.mensualites;
}

export interface ArgentDuBien extends Flux {
  readonly bienId: string;
  readonly cashflow: number;
}

/** Une dépense comptée dans la période, à la date de son occurrence. */
export interface OccurrenceDepense {
  readonly depense: Depense;
  readonly date: string;
}

export interface BilanArgent extends Flux {
  /** Premier et dernier mois de la période. */
  readonly debut: string;
  readonly fin: string;
  readonly cashflow: number;
  readonly depensesParCategorie: Readonly<Record<CategorieDepense, number>>;
  /** Un bilan par bien retenu, dans l'ordre des biens. */
  readonly parBien: readonly ArgentDuBien[];
  /** Les dépenses de la période, la plus récente d'abord. */
  readonly occurrences: readonly OccurrenceDepense[];
}

/** La date de l'occurrence d'une dépense dans le mois, ou `null` si elle n'y compte pas (ADR-G26). */
export function occurrenceDuMois(
  depense: Pick<Depense, 'date' | 'recurrence'>,
  periode: string,
): string | null {
  const { date, recurrence } = depense;
  if (recurrence === undefined) return periodeDe(date) === periode ? date : null;
  const ecart = moisEntre(periodeDe(date), periode);
  if (ecart < 0 || ecart % MOIS_PAR_FREQUENCE[recurrence.frequence] !== 0) return null;
  // Le 31 d'une dépense mensuelle tombe le 30 en avril, le 28 ou le 29 en février.
  const jour = Math.min(Number(date.slice(8, 10)), bornesPeriode(periode).jours);
  const occurrence = `${periode}-${String(jour).padStart(2, '0')}`;
  return recurrence.jusquAu !== undefined && occurrence > recurrence.jusquAu ? null : occurrence;
}

interface Cumul {
  loyers: number;
  depenses: number;
  mensualites: number;
}

function avecCashflow<T extends Cumul>(cumul: T): T & { readonly cashflow: number } {
  return { ...cumul, cashflow: cashflowReel(cumul) };
}

/** Le bilan d'une suite de mois consécutifs, de `debut` à `fin` compris. */
function bilanDesMois(
  donnees: DonneesArgent,
  debut: string,
  fin: string,
  options: OptionsArgent,
): BilanArgent {
  const lignes = donnees.biens
    .filter((b) => options.bienId === undefined || b.id === options.bienId)
    .map((b) => ({ bienId: b.id, loyers: 0, depenses: 0, mensualites: 0 }));
  const cumuls = new Map<string, Cumul>(lignes.map((l) => [l.bienId, l]));
  const communes: Cumul = { loyers: 0, depenses: 0, mensualites: 0 };
  const parCategorie = Object.fromEntries(CATEGORIES_DEPENSE.map((c) => [c, 0])) as Record<
    CategorieDepense,
    number
  >;
  const occurrences: OccurrenceDepense[] = [];
  const bienDeLocation = new Map(donnees.locations.map((l) => [l.id, l.bienId]));
  const dansLaPeriode = (periode: string): boolean => periode >= debut && periode <= fin;

  for (const paiement of donnees.paiements) {
    const cumul = cumuls.get(bienDeLocation.get(paiement.locationId) ?? '');
    if (cumul !== undefined && dansLaPeriode(periodeDe(paiement.date))) {
      cumul.loyers += paiement.montant;
    }
  }

  const mois = moisEntre(debut, fin) + 1;
  for (const depense of donnees.depenses) {
    // Sans bien : dépense commune, comptée seulement sans filtre ; bien inconnu (supprimé) : ignorée.
    const cumul =
      depense.bienId === undefined
        ? options.bienId === undefined
          ? communes
          : undefined
        : cumuls.get(depense.bienId);
    if (cumul === undefined) continue;
    for (let rang = 0; rang < mois; rang += 1) {
      const date = occurrenceDuMois(depense, ajouterMois(debut, rang));
      if (date === null) continue;
      cumul.depenses += depense.montant;
      parCategorie[depense.categorie] += depense.montant;
      occurrences.push({ depense, date });
    }
  }

  for (const pret of donnees.prets) {
    const cumul = cumuls.get(pret.bienId);
    if (cumul === undefined) continue;
    for (let rang = 0; rang < mois; rang += 1) {
      cumul.mensualites += echeanceDuMois(pret, ajouterMois(debut, rang))?.total ?? 0;
    }
  }

  const parBien = lignes.map(avecCashflow);
  const total = [...parBien, communes].reduce(
    (t, c) => ({
      loyers: t.loyers + c.loyers,
      depenses: t.depenses + c.depenses,
      mensualites: t.mensualites + c.mensualites,
    }),
    { loyers: 0, depenses: 0, mensualites: 0 },
  );
  occurrences.sort(
    (a, b) => b.date.localeCompare(a.date) || a.depense.id.localeCompare(b.depense.id),
  );
  return {
    debut,
    fin,
    ...avecCashflow(total),
    depensesParCategorie: parCategorie,
    parBien,
    occurrences,
  };
}

/** Le bilan d'un mois « AAAA-MM ». */
export function argentDuMois(
  donnees: DonneesArgent,
  periode: string,
  options: OptionsArgent = {},
): BilanArgent {
  return bilanDesMois(donnees, periode, periode, options);
}

/** Le bilan d'une année civile. */
export function argentDeLAnnee(
  donnees: DonneesArgent,
  annee: number,
  options: OptionsArgent = {},
): BilanArgent {
  return bilanDesMois(donnees, `${String(annee)}-01`, `${String(annee)}-12`, options);
}

/** Le bilan des `nombre` mois qui finissent par `dernier` compris (12 par défaut). */
export function argentDesDerniersMois(
  donnees: DonneesArgent,
  dernier: string,
  options: OptionsArgent = {},
  nombre = 12,
): BilanArgent {
  return bilanDesMois(donnees, ajouterMois(dernier, 1 - nombre), dernier, options);
}

/** Un point de la courbe : le mois, ce qui est entré, ce qui est sorti, le cash-flow. */
export interface PointCourbe {
  readonly periode: string;
  readonly entrees: number;
  readonly sorties: number;
  readonly cashflow: number;
}

/** Les `nombre` derniers mois jusqu'à `dernier` compris, le plus ancien d'abord (12 par défaut). */
export function courbeDesMois(
  donnees: DonneesArgent,
  dernier: string,
  options: OptionsArgent = {},
  nombre = 12,
): readonly PointCourbe[] {
  return Array.from({ length: nombre }, (_, rang) => {
    const periode = ajouterMois(dernier, rang + 1 - nombre);
    const bilan = argentDuMois(donnees, periode, options);
    return {
      periode,
      entrees: bilan.loyers,
      sorties: bilan.depenses + bilan.mensualites,
      cashflow: bilan.cashflow,
    };
  });
}
