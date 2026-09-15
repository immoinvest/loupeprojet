import { argentDeLAnnee, type DonneesArgent } from './argent';
import type { Depense } from './depenses';
import { echeanceDuMois } from './pret';

/*
 * Les mouvements d'une année civile pour le comptable (G5-5, ADR-G38) : loyers encaissés, dépenses
 * (occurrences des dépenses récurrentes comprises) et échéances des prêts en intérêts, capital et
 * assurance. Montants signés en centimes : positif = encaissé, négatif = payé. Le texte du fichier
 * (libellés, format) est l'affaire du web.
 */

export type LigneExport =
  | {
      readonly type: 'loyer';
      readonly date: string;
      readonly bienId: string;
      readonly montant: number;
      readonly locationId: string;
      /** Le mois du loyer payé. */
      readonly periode: string;
    }
  | {
      readonly type: 'depense';
      readonly date: string;
      /** `null` pour une dépense commune à tous les biens. */
      readonly bienId: string | null;
      readonly montant: number;
      readonly depense: Depense;
    }
  | {
      readonly type: 'pret_interets' | 'pret_capital' | 'pret_assurance';
      /** Le 1er du mois de l'échéance : le jour exact du prélèvement n'est pas connu. */
      readonly date: string;
      readonly bienId: string;
      readonly montant: number;
      readonly periode: string;
    };

const ORDRE_DU_TYPE: Readonly<Record<LigneExport['type'], number>> = {
  loyer: 0,
  depense: 1,
  pret_interets: 2,
  pret_capital: 3,
  pret_assurance: 4,
};

/** Les lignes de l'année, par date puis loyers, dépenses et prêt ; celles d'un bien supprimé sont écartées. */
export function lignesDeLAnnee(donnees: DonneesArgent, annee: number): readonly LigneExport[] {
  const biens = new Set(donnees.biens.map((b) => b.id));
  const locations = new Map(donnees.locations.map((l) => [l.id, l]));
  const prefixe = `${String(annee)}-`;
  const lignes: LigneExport[] = [];

  for (const paiement of donnees.paiements) {
    const location = locations.get(paiement.locationId);
    if (location === undefined || !biens.has(location.bienId)) continue;
    if (!paiement.date.startsWith(prefixe)) continue;
    lignes.push({
      type: 'loyer',
      date: paiement.date,
      bienId: location.bienId,
      montant: paiement.montant,
      locationId: location.id,
      periode: paiement.periode,
    });
  }

  for (const { depense, date } of argentDeLAnnee(donnees, annee).occurrences) {
    lignes.push({
      type: 'depense',
      date,
      bienId: depense.bienId ?? null,
      montant: -depense.montant,
      depense,
    });
  }

  for (const pret of donnees.prets) {
    if (!biens.has(pret.bienId)) continue;
    for (let mois = 1; mois <= 12; mois += 1) {
      const periode = `${prefixe}${String(mois).padStart(2, '0')}`;
      const echeance = echeanceDuMois(pret, periode);
      if (echeance === null) continue;
      const parts = [
        ['pret_interets', echeance.interets],
        ['pret_capital', echeance.capitalRembourse],
        ['pret_assurance', echeance.assurance],
      ] as const;
      for (const [type, montant] of parts) {
        if (montant === 0) continue;
        lignes.push({
          type,
          date: `${periode}-01`,
          bienId: pret.bienId,
          montant: -montant,
          periode,
        });
      }
    }
  }

  // Tri stable : à date et type égaux, l'ordre des données.
  return lignes.sort(
    (a, b) => a.date.localeCompare(b.date) || ORDRE_DU_TYPE[a.type] - ORDRE_DU_TYPE[b.type],
  );
}
