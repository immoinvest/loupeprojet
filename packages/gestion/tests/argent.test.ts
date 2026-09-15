import { describe, expect, it } from 'vitest';

import {
  argentDeLAnnee,
  argentDesDerniersMois,
  argentDuMois,
  cashflowReel,
  courbeDesMois,
  occurrenceDuMois,
  type DonneesArgent,
} from '../src/argent';
import {
  DepenseSchema,
  EtatArgentSchema,
  NouvelleDepenseSchema,
  type Depense,
  type PretEnregistre,
} from '../src/depenses';
import { echeanceDuMois } from '../src/pret';
import { bien, location, paiement } from './exemples';

const H = '2026-09-01T08:00:00.000Z';

function depense(id: string, champs: Partial<Depense> = {}): Depense {
  return {
    id,
    bienId: 'bien-lices',
    categorie: 'entretien',
    montant: 12_000,
    date: '2026-10-15',
    recuperable: false,
    creeLe: H,
    modifieLe: H,
    ...champs,
  };
}

const PRET_LICES: PretEnregistre = {
  bienId: 'bien-lices',
  capital: 1_200_000,
  tauxAnnuel: 0.12,
  dureeMois: 12,
  debut: '2026-10',
  assuranceMensuelle: 500,
  modifieLe: H,
};

/** Le T2 Lices (Julie, 700 €) et le Studio Baille (Antoine, 430 €), octobre 2026. */
function donnees(champs: Partial<DonneesArgent> = {}): DonneesArgent {
  return {
    biens: [bien('bien-lices', 'T2 Lices'), bien('bien-baille', 'Studio Baille')],
    locations: [
      location('location-julie'),
      location('location-antoine', {
        bienId: 'bien-baille',
        loyerHorsCharges: 40_000,
        charges: 3_000,
      }),
    ],
    paiements: [
      paiement('p1', 'location-julie', '2026-10', 70_000),
      // Le loyer de novembre d'Antoine, payé en avance le 30 octobre : compté en octobre (encaissé).
      paiement('p2', 'location-antoine', '2026-11', 43_000, '2026-10-30'),
      paiement('p3', 'location-julie', '2026-09', 70_000),
      // Une location inconnue (données incohérentes) : ignorée.
      paiement('p4', 'location-inconnue', '2026-10', 1_000),
    ],
    depenses: [
      depense('taxe', { categorie: 'taxe_fonciere', montant: 84_000, date: '2026-10-15' }),
      depense('assurance', {
        categorie: 'assurance',
        montant: 1_200,
        date: '2026-01-31',
        recurrence: { frequence: 'mensuelle' },
      }),
      depense('comptable', {
        bienId: undefined,
        categorie: 'gestion',
        montant: 30_000,
        date: '2026-10-02',
      }),
      depense('supprime', { bienId: 'bien-supprime', montant: 99_900 }),
    ],
    prets: [PRET_LICES, { ...PRET_LICES, bienId: 'bien-supprime' }],
    ...champs,
  };
}

describe('occurrences d’une dépense', () => {
  it('ponctuelle : seulement son mois', () => {
    const d = depense('d');
    expect(occurrenceDuMois(d, '2026-10')).toBe('2026-10-15');
    expect(occurrenceDuMois(d, '2026-11')).toBeNull();
  });

  it('mensuelle le 31 : le 30 en avril, le 28 en février, rien avant la première date', () => {
    const d = depense('d', { date: '2026-01-31', recurrence: { frequence: 'mensuelle' } });
    expect(occurrenceDuMois(d, '2025-12')).toBeNull();
    expect(occurrenceDuMois(d, '2026-02')).toBe('2026-02-28');
    expect(occurrenceDuMois(d, '2026-04')).toBe('2026-04-30');
    expect(occurrenceDuMois(d, '2028-02')).toBe('2028-02-29');
  });

  it('trimestrielle et annuelle : tous les 3 et 12 mois ; jusqu’au jour de fin compris', () => {
    const syndic = depense('d', {
      date: '2026-01-10',
      recurrence: { frequence: 'trimestrielle', jusquAu: '2026-10-10' },
    });
    expect(
      ['2026-01', '2026-02', '2026-04', '2026-07', '2026-10', '2027-01'].map((p) =>
        occurrenceDuMois(syndic, p),
      ),
    ).toEqual(['2026-01-10', null, '2026-04-10', '2026-07-10', '2026-10-10', null]);
    const taxe = depense('d', {
      date: '2026-10-15',
      recurrence: { frequence: 'annuelle', jusquAu: '2027-10-14' },
    });
    expect(occurrenceDuMois(taxe, '2027-10')).toBeNull();
    expect(occurrenceDuMois(taxe, '2027-09')).toBeNull();
    expect(occurrenceDuMois({ ...taxe, recurrence: { frequence: 'annuelle' } }, '2030-10')).toBe(
      '2030-10-15',
    );
  });
});

describe('bilan d’un mois', () => {
  it('octobre 2026 : encaissé, dépenses par catégorie, mensualités, cash-flow réel', () => {
    const bilan = argentDuMois(donnees(), '2026-10');
    const mensualite = echeanceDuMois(PRET_LICES, '2026-10')?.total ?? 0;
    expect(mensualite).toBe(107_119);
    expect(bilan).toMatchObject({
      debut: '2026-10',
      fin: '2026-10',
      loyers: 113_000,
      depenses: 84_000 + 1_200 + 30_000,
      mensualites: 107_119,
      cashflow: 113_000 - 115_200 - 107_119,
    });
    expect(bilan.depensesParCategorie).toEqual({
      credit: 0,
      taxe_fonciere: 84_000,
      copropriete: 0,
      assurance: 1_200,
      travaux: 0,
      entretien: 0,
      gestion: 30_000,
      autre: 0,
    });
    expect(bilan.parBien).toEqual([
      {
        bienId: 'bien-lices',
        loyers: 70_000,
        depenses: 85_200,
        mensualites: 107_119,
        cashflow: -122_319,
      },
      { bienId: 'bien-baille', loyers: 43_000, depenses: 0, mensualites: 0, cashflow: 43_000 },
    ]);
    expect(bilan.occurrences.map((o) => [o.depense.id, o.date])).toEqual([
      ['assurance', '2026-10-31'],
      ['taxe', '2026-10-15'],
      ['comptable', '2026-10-02'],
    ]);
  });

  it('filtre par bien : les dépenses sans bien et les autres biens sont écartés', () => {
    const bilan = argentDuMois(donnees(), '2026-10', { bienId: 'bien-baille' });
    expect(bilan).toMatchObject({ loyers: 43_000, depenses: 0, mensualites: 0, cashflow: 43_000 });
    expect(bilan.parBien.map((b) => b.bienId)).toEqual(['bien-baille']);
    expect(argentDuMois(donnees(), '2026-10', { bienId: 'inconnu' })).toMatchObject({
      loyers: 0,
      depenses: 0,
      parBien: [],
    });
  });

  it('deux occurrences du même jour se rangent par identifiant', () => {
    const bilan = argentDuMois(
      donnees({ depenses: [depense('b'), depense('a')], prets: [], paiements: [] }),
      '2026-10',
    );
    expect(bilan.occurrences.map((o) => o.depense.id)).toEqual(['a', 'b']);
  });

  it('cashflowReel : encaissé moins dépenses moins mensualités', () => {
    expect(cashflowReel({ loyers: 70_000, depenses: 12_000, mensualites: 61_200 })).toBe(-3_200);
  });
});

describe('bilan d’une année et courbe', () => {
  it('2026 : l’assurance mensuelle compte 12 fois, le prêt de trois mois (octobre à décembre)', () => {
    const bilan = argentDeLAnnee(donnees(), 2026);
    expect(bilan.debut).toBe('2026-01');
    expect(bilan.fin).toBe('2026-12');
    expect(bilan.depensesParCategorie.assurance).toBe(12 * 1_200);
    expect(bilan.occurrences.filter((o) => o.depense.id === 'assurance')).toHaveLength(12);
    const pret = ['2026-10', '2026-11', '2026-12'].reduce(
      (s, p) => s + (echeanceDuMois(PRET_LICES, p)?.total ?? 0),
      0,
    );
    expect(bilan.mensualites).toBe(pret);
    expect(bilan.loyers).toBe(70_000 + 43_000 + 70_000);
  });

  it('les 12 derniers mois jusqu’à octobre 2026 : de novembre 2025 à octobre 2026', () => {
    const bilan = argentDesDerniersMois(donnees(), '2026-10');
    expect([bilan.debut, bilan.fin]).toEqual(['2025-11', '2026-10']);
    expect(argentDesDerniersMois(donnees(), '2026-10', {}, 3).debut).toBe('2026-08');
  });

  it('courbe : 12 points du plus ancien au plus récent, entrées, sorties et cash-flow du mois', () => {
    const courbe = courbeDesMois(donnees(), '2026-10');
    expect(courbe).toHaveLength(12);
    expect(courbe[0]?.periode).toBe('2025-11');
    expect(courbe.at(-1)).toEqual({
      periode: '2026-10',
      entrees: 113_000,
      sorties: 115_200 + 107_119,
      cashflow: 113_000 - 115_200 - 107_119,
    });
    expect(courbeDesMois(donnees(), '2026-10', { bienId: 'bien-baille' }, 2)).toEqual([
      { periode: '2026-09', entrees: 0, sorties: 0, cashflow: 0 },
      { periode: '2026-10', entrees: 43_000, sorties: 0, cashflow: 43_000 },
    ]);
  });
});

describe('schémas des dépenses', () => {
  const nouvelle = {
    bienId: 'bien-lices',
    categorie: 'copropriete',
    montant: 27_000,
    date: '2026-10-01',
    recuperable: true,
    recurrence: { frequence: 'trimestrielle', jusquAu: '2027-12-31' },
  };

  it('une dépense valide ; sans bien, sans libellé ni récurrence aussi', () => {
    expect(NouvelleDepenseSchema.safeParse(nouvelle).success).toBe(true);
    const minimale = {
      categorie: nouvelle.categorie,
      montant: nouvelle.montant,
      date: nouvelle.date,
      recuperable: false,
    };
    expect(NouvelleDepenseSchema.safeParse(minimale).success).toBe(true);
    expect(
      DepenseSchema.safeParse({ ...nouvelle, id: 'd1', creeLe: H, modifieLe: H }).success,
    ).toBe(true);
    expect(EtatArgentSchema.parse({ depenses: [], prets: [PRET_LICES] }).prets).toHaveLength(1);
  });

  it('refusées : montant nul, catégorie inconnue, date impossible, libellé vide ou trop long, fin avant la date', () => {
    for (const faux of [
      { montant: 0 },
      { montant: 10_000_001 },
      { categorie: 'loisirs' },
      { date: '2026-02-30' },
      { libelle: '   ' },
      { libelle: 'x'.repeat(81) },
      { recurrence: { frequence: 'hebdomadaire' } },
      { recurrence: { frequence: 'annuelle', jusquAu: '2026-09-30' } },
      { recuperable: 'oui' },
    ]) {
      expect(NouvelleDepenseSchema.safeParse({ ...nouvelle, ...faux }).success).toBe(false);
    }
    expect(
      DepenseSchema.safeParse({
        ...nouvelle,
        recurrence: { frequence: 'annuelle', jusquAu: '2026-09-30' },
        id: 'd1',
        creeLe: H,
        modifieLe: H,
      }).success,
    ).toBe(false);
  });
});
