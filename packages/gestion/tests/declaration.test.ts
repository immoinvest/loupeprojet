import { obtenirRegles, projetExemple } from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import type { DonneesArgent } from '../src/argent';
import {
  declarationDeLAnnee,
  recettesDeLAnnee,
  type LmnpReel,
  type MicroBic,
  type MicroFoncier,
  type ReelFoncier,
} from '../src/declaration';
import type { Depense, PretEnregistre } from '../src/depenses';
import { tableauDuPret } from '../src/pret';
import type { BienGere } from '../src/schemas';
import { bien, location, paiement } from './exemples';

const H = '2026-09-01T08:00:00.000Z';
const REGLES = obtenirRegles('2026-09');

/** Le Studio Baille, loué vide à Antoine : 400 € + 30 € de charges depuis octobre 2025. */
const STUDIO: BienGere = { ...bien('bien-baille', 'Studio Baille'), meuble: false };
/** Le T2 Lices, meublé, loué à Julie : 650 € + 50 €. */
const LICES: BienGere = bien('bien-lices', 'T2 Lices');

function depense(id: string, champs: Partial<Depense>): Depense {
  return {
    id,
    bienId: 'bien-baille',
    categorie: 'autre',
    montant: 1_000,
    date: '2026-03-10',
    recuperable: false,
    creeLe: H,
    modifieLe: H,
    ...champs,
  };
}

/** Une dépense commune à tous les biens (sans `bienId`). */
function sansBien(d: Depense): Depense {
  const copie = { ...d };
  delete copie.bienId;
  return copie;
}

/** Un prêt à 0 % : les intérêts sont nuls, seule l'assurance (5 € par mois) va en ligne 250. */
const PRET_SANS_INTERETS: PretEnregistre = {
  bienId: 'bien-baille',
  capital: 1_200_000,
  tauxAnnuel: 0,
  dureeMois: 120,
  debut: '2025-06',
  assuranceMensuelle: 500,
  modifieLe: H,
};

const PAIEMENTS_ANTOINE = Array.from({ length: 12 }, (_, i) => {
  const mois = `2026-${String(i + 1).padStart(2, '0')}`;
  return paiement(`a${String(i)}`, 'location-antoine', mois, 43_000, `${mois}-03`);
});

function donnees(champs: Partial<DonneesArgent> = {}): DonneesArgent {
  return {
    biens: [LICES, STUDIO],
    locations: [
      location('location-julie'),
      location('location-antoine', {
        bienId: 'bien-baille',
        locataireId: 'locataire-antoine',
        loyerHorsCharges: 40_000,
        charges: 3_000,
      }),
    ],
    paiements: [
      ...PAIEMENTS_ANTOINE,
      paiement('j1', 'location-julie', '2026-01', 70_000),
      paiement('j2', 'location-julie', '2026-02', 70_000),
      paiement('j3', 'location-julie', '2026-03', 70_000),
      // Le loyer de janvier 2026 payé le 30 décembre 2025 : compté en 2025.
      paiement('j0', 'location-julie', '2026-01', 70_000, '2025-12-30'),
      // Une location inconnue : ignorée.
      paiement('x', 'location-inconnue', '2026-01', 9_999),
    ],
    depenses: [
      depense('taxe', { categorie: 'taxe_fonciere', montant: 60_000, date: '2026-10-15' }),
      depense('copro', {
        categorie: 'copropriete',
        montant: 25_000,
        date: '2026-01-05',
        recurrence: { frequence: 'trimestrielle' },
      }),
      depense('pno', { categorie: 'assurance', montant: 12_000, date: '2026-02-01' }),
      depense('travaux', { categorie: 'travaux', montant: 150_000, date: '2026-05-20' }),
      depense('entretien', { categorie: 'entretien', montant: 8_000, date: '2026-07-01' }),
      depense('agence', { categorie: 'gestion', montant: 24_000, date: '2026-12-01' }),
      depense('autre', { categorie: 'autre', montant: 5_000, date: '2026-04-01' }),
      depense('credit', { categorie: 'credit', montant: 3_000, date: '2026-04-02' }),
      // Récupérable : refacturée au locataire, jamais déduite.
      depense('eau', { categorie: 'copropriete', montant: 20_000, recuperable: true }),
      // Sans bien : Deklic ne sait pas à quel groupe l'attribuer.
      sansBien(depense('banque', { categorie: 'gestion', montant: 10_000 })),
      // Sur le meublé : hors revenus fonciers.
      depense('lices', { bienId: 'bien-lices', categorie: 'taxe_fonciere', montant: 70_000 }),
      // Une autre année : absente.
      depense('vieille', { categorie: 'travaux', montant: 99_000, date: '2025-11-01' }),
    ],
    prets: [PRET_SANS_INTERETS],
    ...champs,
  };
}

function reelFoncier(d: DonneesArgent, annee = 2026): ReelFoncier {
  const r = declarationDeLAnnee(d, annee, REGLES).foncier?.regimes.find(
    (x) => x.regime === 'nu_reel',
  );
  if (r?.regime !== 'nu_reel') throw new Error('réel attendu');
  return r;
}

describe('recettes de l’année', () => {
  it('à la date d’encaissement ; part hors charges au prorata du loyer du mois ; loyer et charges nuls : tout en loyer', () => {
    const d = donnees();
    // 12 × 430 € ; 400 ÷ 430 de chaque paiement = 400 €.
    expect(recettesDeLAnnee(d, 2026, new Set(['bien-baille']))).toEqual({
      loyers: 480_000,
      charges: 36_000,
      total: 516_000,
    });
    // Trois loyers de Julie en 2026, un en 2025.
    expect(recettesDeLAnnee(d, 2026, new Set(['bien-lices']))).toEqual({
      loyers: 195_000,
      charges: 15_000,
      total: 210_000,
    });
    expect(recettesDeLAnnee(d, 2025, new Set(['bien-lices'])).total).toBe(70_000);

    const gratuite = {
      locations: [location('l', { loyerHorsCharges: 0, charges: 0 })],
      paiements: [paiement('p', 'l', '2026-01', 5_000)],
    };
    expect(recettesDeLAnnee(gratuite, 2026, new Set(['bien-lices']))).toEqual({
      loyers: 5_000,
      charges: 0,
      total: 5_000,
    });
    // Un loyer de 333,33 € + 66,67 € payé 400 € : 333,33 € hors charges, arrondi au centime.
    const arrondi = {
      locations: [location('l', { loyerHorsCharges: 33_333, charges: 6_667 })],
      paiements: [paiement('p', 'l', '2026-01', 40_000)],
    };
    expect(recettesDeLAnnee(arrondi, 2026, new Set(['bien-lices'])).loyers).toBe(33_333);
  });
});

describe('déclaration des revenus 2026 (en 2027)', () => {
  it('revenus fonciers au réel (2044) : lignes vérifiées à la main, bénéfice en 4BA', () => {
    const r = reelFoncier(donnees());
    expect(r.loyers).toBe(480_000);
    expect(r.charges).toEqual({
      // 221 : l'agence.
      fraisGestion: 24_000,
      // 222 : un local loué × 20 €.
      forfaitGestion: 2_000,
      // 223 : l'assurance du propriétaire.
      assurance: 12_000,
      // 224 : travaux 1 500 € + entretien 80 €.
      travaux: 158_000,
      // 227.
      taxeFonciere: 60_000,
      // 229 : quatre appels de 250 € (l'eau récupérable n'est pas déduite).
      copropriete: 100_000,
    });
    expect(r.locaux).toBe(1);
    // 240 = 240 + 20 + 120 + 1 580 + 600 + 1 000 = 3 560 €.
    expect(r.totalCharges).toBe(356_000);
    // 250 : prêt à 0 %, 12 × 5 € d'assurance.
    expect(r.interets).toBe(6_000);
    // 420 = 4 800 − 3 560 − 60 = 1 180 €.
    expect(r.resultat).toBe(118_000);
    expect(r.benefice).toBe(118_000);
    expect(r.deficitRevenuGlobal).toBe(0);
    expect(r.deficitRevenusFonciers).toBe(0);
    expect(r.plafondRevenuGlobal).toBe(1_070_000);
  });

  it('micro-foncier (4BE) : 30 % d’abattement, plafond de 15 000 € lu dans les règles du moteur', () => {
    const declaration = declarationDeLAnnee(donnees(), 2026, REGLES);
    const micro = declaration.foncier?.regimes[0] as MicroFoncier;
    expect(micro).toEqual({
      regime: 'micro_foncier',
      recettes: 480_000,
      abattementTaux: 0.3,
      abattement: 144_000,
      imposable: 336_000,
      plafond: 1_500_000,
      depassePlafond: false,
    });
    const reglesBasses = {
      ...REGLES,
      fiscalite: { ...REGLES.fiscalite, microFoncier: { abattement: 0.3, plafond: 4_000 } },
    };
    const basse = declarationDeLAnnee(donnees(), 2026, reglesBasses).foncier?.regimes.find(
      (x) => x.regime === 'micro_foncier',
    );
    expect(basse).toMatchObject({ plafond: 400_000, depassePlafond: true });
  });

  it('déficit : dans la limite de 10 700 € sur le revenu global (4BC), le reste en 4BB', () => {
    const d = donnees();
    const gros = reelFoncier({
      ...d,
      depenses: [
        ...d.depenses,
        depense('toiture', { categorie: 'travaux', montant: 1_500_000, date: '2026-06-01' }),
      ],
    });
    // 420 = 4 800 − (3 560 + 15 000) − 60 = −13 820 € → 10 700 € en 4BC, 3 120 € en 4BB.
    expect(gros.resultat).toBe(-1_382_000);
    expect(gros.deficitRevenuGlobal).toBe(1_070_000);
    expect(gros.deficitRevenusFonciers).toBe(312_000);
    expect(gros.benefice).toBe(0);

    const petit = reelFoncier({
      ...d,
      depenses: [
        ...d.depenses,
        depense('toiture', { categorie: 'travaux', montant: 200_000, date: '2026-06-01' }),
      ],
    });
    // 420 = 4 800 − 5 560 − 60 = −820 € : tout en 4BC.
    expect(petit.deficitRevenuGlobal).toBe(82_000);
    expect(petit.deficitRevenusFonciers).toBe(0);
  });

  it('intérêts plus grands que les loyers : seules les autres charges vont au revenu global', () => {
    const sansLoyer = reelFoncier(
      donnees({
        paiements: [],
        prets: [{ ...PRET_SANS_INTERETS, tauxAnnuel: 0.06, capital: 10_000_000, dureeMois: 240 }],
      }),
    );
    const tableau = tableauDuPret({
      ...PRET_SANS_INTERETS,
      tauxAnnuel: 0.06,
      capital: 10_000_000,
      dureeMois: 240,
    });
    const attendus = tableau
      .filter((e) => e.periode.startsWith('2026-'))
      .reduce((t, e) => t + e.interets + e.assurance, 0);
    expect(sansLoyer.interets).toBe(attendus);
    expect(sansLoyer.loyers).toBe(0);
    // 4BC = autres charges (3 560 €, sous le plafond) ; 4BB = intérêts − loyers.
    expect(sansLoyer.deficitRevenuGlobal).toBe(356_000);
    expect(sansLoyer.deficitRevenusFonciers).toBe(attendus);

    const tresGros = reelFoncier(
      donnees({
        paiements: [],
        prets: [{ ...PRET_SANS_INTERETS, tauxAnnuel: 0.06, capital: 10_000_000, dureeMois: 240 }],
        depenses: [depense('toiture', { categorie: 'travaux', montant: 1_200_000 })],
      }),
    );
    // Autres charges 12 000 € + 20 € de forfait : 10 700 € en 4BC, 1 320 € + intérêts en 4BB.
    expect(tresGros.deficitRevenuGlobal).toBe(1_070_000);
    expect(tresGros.deficitRevenusFonciers).toBe(1_202_000 - 1_070_000 + attendus);
  });

  it('ligne 250 : seuls les prêts des biens loués vides, et seulement les échéances de l’année', () => {
    const r = reelFoncier(
      donnees({
        prets: [
          // Le prêt du meublé ne va pas dans la 2044.
          { ...PRET_SANS_INTERETS, bienId: 'bien-lices', assuranceMensuelle: 9_900 },
          // Première échéance en novembre 2026 : deux mois × 5 € d'assurance.
          { ...PRET_SANS_INTERETS, debut: '2026-11' },
        ],
      }),
    );
    expect(r.interets).toBe(1_000);
  });

  it('un bien vide sans location dans l’année ne compte pas de forfait ; une location finie en 2025 non plus', () => {
    const d = donnees();
    const vacant = reelFoncier({
      ...d,
      locations: d.locations.map((l) =>
        l.bienId === 'bien-baille' ? { ...l, debut: '2024-01-01', fin: '2025-12-31' } : l,
      ),
    });
    expect(vacant.locaux).toBe(0);
    expect(vacant.charges.forfaitGestion).toBe(0);
    const aVenir = reelFoncier({
      ...d,
      locations: d.locations.map((l) =>
        l.bienId === 'bien-baille' ? { ...l, debut: '2027-01-01' } : l,
      ),
    });
    expect(aVenir.locaux).toBe(0);
  });

  it('dépenses non reportées : « Crédit », « Autre », et les dépenses sans bien, la plus récente d’abord', () => {
    const declaration = declarationDeLAnnee(donnees(), 2026, REGLES);
    expect(declaration.nonReportees.map((n) => [n.depense.id, n.date, n.raison])).toEqual([
      ['credit', '2026-04-02', 'credit'],
      ['autre', '2026-04-01', 'autre'],
      ['banque', '2026-03-10', 'sans_bien'],
    ]);
  });

  it('meublé : micro-BIC (5NI) sur les recettes charges comprises, 50 % et 305 € au moins ; LMNP réel : recettes seules', () => {
    const declaration = declarationDeLAnnee(donnees(), 2026, REGLES);
    expect(declaration.meuble?.recettes.total).toBe(210_000);
    const [micro, reel] = declaration.meuble?.regimes ?? [];
    expect(micro as MicroBic).toEqual({
      regime: 'micro_bic',
      recettes: 210_000,
      abattementTaux: 0.5,
      abattement: 105_000,
      imposable: 105_000,
      plafond: 8_360_000,
      depassePlafond: false,
    });
    expect(reel as LmnpReel).toEqual({ regime: 'lmnp_reel', recettes: 210_000 });

    // 400 € de recettes : 50 % = 200 €, relevé à 305 € ; 200 € de recettes : abattement plafonné aux recettes.
    const faible = (montant: number): MicroBic =>
      declarationDeLAnnee(
        donnees({ paiements: [paiement('j', 'location-julie', '2026-01', montant)] }),
        2026,
        REGLES,
      ).meuble?.regimes[0] as MicroBic;
    expect(faible(40_000)).toMatchObject({ abattement: 30_500, imposable: 9_500 });
    expect(faible(20_000)).toMatchObject({ abattement: 20_000, imposable: 0 });
    const reglesBasses = {
      ...REGLES,
      fiscalite: {
        ...REGLES.fiscalite,
        microBic: { ...REGLES.fiscalite.microBic, plafond: 1_000 },
      },
    };
    expect(declarationDeLAnnee(donnees(), 2026, reglesBasses).meuble?.regimes[0]).toMatchObject({
      depassePlafond: true,
    });
  });

  it('le régime retenu dans l’analyse passe en premier, s’il convient au groupe', () => {
    const analyseMeublee = { ...LICES, projet: { ...projetExemple } };
    const analyseNue: BienGere = {
      ...STUDIO,
      projet: {
        ...projetExemple,
        hypotheses: {
          ...projetExemple.hypotheses,
          location: { mode: 'nu', loyerHc: 400, vacanceSemaines: 3 },
          fiscalite: { tmi: 0.3, regime: 'nu_reel' },
        },
      },
    };
    const avecAnalyses = declarationDeLAnnee(
      donnees({ biens: [analyseMeublee, analyseNue] }),
      2026,
      REGLES,
    );
    expect(avecAnalyses.meuble?.retenu).toBe('lmnp_reel');
    expect(avecAnalyses.meuble?.regimes.map((r) => r.regime)).toEqual(['lmnp_reel', 'micro_bic']);
    expect(avecAnalyses.foncier?.retenu).toBe('nu_reel');
    expect(avecAnalyses.foncier?.regimes.map((r) => r.regime)).toEqual([
      'nu_reel',
      'micro_foncier',
    ]);

    // Une analyse en meublé sur un bien géré vide : régime incompatible, ordre par défaut.
    const incompatible = declarationDeLAnnee(
      donnees({ biens: [LICES, { ...STUDIO, projet: { ...projetExemple } }] }),
      2026,
      REGLES,
    );
    expect(incompatible.foncier?.retenu).toBeNull();
    expect(incompatible.foncier?.regimes.map((r) => r.regime)).toEqual([
      'micro_foncier',
      'nu_reel',
    ]);
    expect(incompatible.meuble?.retenu).toBeNull();
  });

  it('années, version de règles, cases relues pour les revenus 2025 seulement ; groupes absents sans bien', () => {
    const d2026 = declarationDeLAnnee(donnees(), 2026);
    expect(d2026).toMatchObject({
      anneeRevenus: 2026,
      anneeDeclaration: 2027,
      casesVerifiees: false,
      versionRegles: '2026-09',
    });
    expect(declarationDeLAnnee(donnees(), 2025, REGLES).casesVerifiees).toBe(true);
    const sansMeuble = declarationDeLAnnee(donnees({ biens: [STUDIO] }), 2026, REGLES);
    expect(sansMeuble.meuble).toBeNull();
    const sansFoncier = declarationDeLAnnee(donnees({ biens: [LICES] }), 2026, REGLES);
    expect(sansFoncier.foncier).toBeNull();
  });
});
