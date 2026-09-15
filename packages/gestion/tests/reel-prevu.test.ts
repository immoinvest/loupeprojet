import { calculerProjet, projetExemple } from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import { argentDeLAnnee, type DonneesArgent } from '../src/argent';
import type { Depense } from '../src/depenses';
import {
  cashflowDesPostes,
  comparerReelPrevu,
  ECART_MINIMUM,
  moisDeComparaison,
  POSTES_REEL,
  prevuDuBien,
  projetDuBien,
  reelMensuel,
  regimeDeLAnalyse,
  type Mensuel,
  type MontantsParPoste,
} from '../src/reel-prevu';
import { bien, location, paiement } from './exemples';

const H = '2026-09-01T08:00:00.000Z';

function postes(champs: Partial<Record<keyof MontantsParPoste, number>>): MontantsParPoste {
  return { ...Object.fromEntries(POSTES_REEL.map((p) => [p, 0])), ...champs } as MontantsParPoste;
}

function mensuel(champs: Partial<Record<keyof MontantsParPoste, number>>): Mensuel {
  const p = postes(champs);
  return { postes: p, cashflow: cashflowDesPostes(p) };
}

describe('prévu d’un bien venu d’une analyse', () => {
  it('le T3 de Marseille (meublé, LMNP réel) : postes vérifiés à la main, mensualité du moteur, cash-flow = somme des postes', () => {
    const prevu = prevuDuBien({ projet: { ...projetExemple } });
    if (!prevu.ok) throw new Error('prévu attendu');
    const r = calculerProjet(projetExemple, { avecScenarios: false });
    if (!r.complet) throw new Error('rapport complet attendu');
    expect(prevu.versionRegles).toBe('2026-09');
    expect(prevu.postes).toEqual({
      // 980 € × 12 = 11 760 €, moins 3 semaines vides sur 52 = 11 081,54 € par an → 923,46 € par
      // mois, plus 60 € de charges refacturées (payées avec le loyer).
      loyers: 92_346 + 6_000,
      mensualites: Math.round(r.financement.mensualiteTotale * 100),
      // 1 050 € ÷ 12 = 87,50 €.
      taxe_fonciere: 8_750,
      // 1 080 € ÷ 12 = 90 €, plus les 60 € refacturés que la copropriété appelle.
      copropriete: 9_000 + 6_000,
      // Assurance du propriétaire non occupant : 180 € ÷ 12.
      assurance: 1_500,
      travaux: 0,
      // 0,5 % de 155 000 € = 775 € ÷ 12 = 64,58 €.
      entretien: 6_458,
      // Comptable (LMNP réel) : 420 € ÷ 12 ; pas de gestion déléguée.
      gestion: 3_500,
      // CFE du meublé : 180 € ÷ 12.
      autre: 1_500,
    });
    expect(prevu.cashflow).toBe(cashflowDesPostes(prevu.postes));
    // Les charges refacturées s'annulent : le cash-flow prévu reste celui du moteur, au centime près.
    expect(Math.abs(prevu.cashflow - Math.round(r.cashflow.mensuel * 100))).toBeLessThanOrEqual(2);
  });

  it('en location nue, les charges refacturées comptent aussi ; en colocation, aucune (forfaits dans les loyers)', () => {
    const nue = prevuDuBien({
      projet: {
        ...projetExemple,
        hypotheses: {
          ...projetExemple.hypotheses,
          location: { mode: 'nu', loyerHc: 800, chargesLocataire: 50, vacanceSemaines: 0 },
          fiscalite: { tmi: 0.3, regime: 'micro_foncier' },
        },
      },
    });
    if (!nue.ok) throw new Error('prévu attendu');
    // 800 € × 12 ÷ 12 sans vacance, plus 50 € ; ni comptable ni CFE hors meublé.
    expect(nue.postes.loyers).toBe(85_000);
    expect(nue.postes.copropriete).toBe(9_000 + 5_000);
    expect(nue.postes.gestion).toBe(0);
    expect(nue.postes.autre).toBe(0);

    const coloc = prevuDuBien({
      projet: {
        ...projetExemple,
        hypotheses: {
          ...projetExemple.hypotheses,
          location: {
            mode: 'colocation',
            chambres: 2,
            loyerChambre: 450,
            forfaitChargesChambre: 50,
            vacanceSemaines: 0,
          },
        },
      },
    });
    if (!coloc.ok) throw new Error('prévu attendu');
    // (450 + 50) × 2 × 12 ÷ 12 : les forfaits sont des recettes du moteur ; copropriété seule.
    expect(coloc.postes.loyers).toBe(100_000);
    expect(coloc.postes.copropriete).toBe(9_000);
  });

  it('sans analyse, instantané illisible, analyse sans loyer : pas de prévu, et la raison', () => {
    expect(prevuDuBien({})).toEqual({ ok: false, raison: 'sans_analyse' });
    expect(prevuDuBien({ projet: { bien: 'rien' } })).toEqual({ ok: false, raison: 'illisible' });
    expect(
      prevuDuBien({
        projet: {
          ...projetExemple,
          hypotheses: {
            ...projetExemple.hypotheses,
            location: { mode: 'meuble', chargesLocataire: 0, vacanceSemaines: 3 },
          },
        },
      }),
    ).toEqual({ ok: false, raison: 'sans_loyer' });
  });

  it('le projet et le régime retenu de l’analyse ; rien sans instantané lisible', () => {
    expect(projetDuBien({ projet: { ...projetExemple } })?.id).toBe('exemple-t3-marseille');
    expect(projetDuBien({})).toBeNull();
    expect(regimeDeLAnalyse({ projet: { ...projetExemple } })).toBe('lmnp_reel');
    expect(regimeDeLAnalyse({ projet: { faux: true } })).toBeNull();
  });
});

describe('mois comparés', () => {
  it('les 12 derniers mois complets pour un bien ancien', () => {
    expect(moisDeComparaison({ creeLe: '2024-01-15T10:00:00.000Z' }, '2027-03-10')).toEqual({
      debut: '2026-03',
      fin: '2027-02',
      mois: 12,
    });
  });

  it('un bien ajouté en septembre : d’octobre au mois dernier ; ajouté le mois dernier : rien encore', () => {
    expect(moisDeComparaison({ creeLe: H }, '2027-03-10')).toEqual({
      debut: '2026-10',
      fin: '2027-02',
      mois: 5,
    });
    expect(moisDeComparaison({ creeLe: '2027-02-01T08:00:00.000Z' }, '2027-03-10')).toBeNull();
    expect(moisDeComparaison({ creeLe: '2027-01-20T08:00:00.000Z' }, '2027-03-01', 12)).toEqual({
      debut: '2027-02',
      fin: '2027-02',
      mois: 1,
    });
  });
});

describe('réel mensuel', () => {
  it('moyenne d’un bilan d’Argent par mois, « Crédit » avec les mensualités, arrondie au centime', () => {
    const depense = (id: string, champs: Partial<Depense>): Depense => ({
      id,
      bienId: 'bien-lices',
      categorie: 'autre',
      montant: 1_000,
      date: '2026-03-10',
      recuperable: false,
      creeLe: H,
      modifieLe: H,
      ...champs,
    });
    const donnees: DonneesArgent = {
      biens: [bien('bien-lices', 'T2 Lices')],
      locations: [location('location-julie')],
      paiements: [
        paiement('p1', 'location-julie', '2026-01', 70_000),
        paiement('p2', 'location-julie', '2026-02', 70_000),
        paiement('p3', 'location-julie', '2026-03', 35_000),
      ],
      depenses: [
        depense('taxe', { categorie: 'taxe_fonciere', montant: 84_000, date: '2026-10-15' }),
        depense('credit', { categorie: 'credit', montant: 50_000, date: '2026-01-10' }),
        depense('copro', {
          categorie: 'copropriete',
          montant: 25_000,
          date: '2026-01-05',
          recurrence: { frequence: 'trimestrielle' },
        }),
        depense('assurance', { categorie: 'assurance', montant: 1_500, date: '2026-01-01' }),
        depense('travaux', { categorie: 'travaux', montant: 120_000, date: '2026-06-01' }),
        depense('entretien', { categorie: 'entretien', montant: 9_000, date: '2026-07-01' }),
        depense('gestion', { categorie: 'gestion', montant: 30_000, date: '2026-12-01' }),
        depense('autre', { categorie: 'autre', montant: 7_000 }),
      ],
      prets: [],
    };
    const reel = reelMensuel(argentDeLAnnee(donnees, 2026, { bienId: 'bien-lices' }), 12);
    expect(reel.postes).toEqual({
      // 175 000 ÷ 12 = 14 583,33 → 14 583.
      loyers: 14_583,
      // Aucun prêt enregistré ; la dépense « Crédit » de 500 € : 4 166,67 → 4 167.
      mensualites: 4_167,
      taxe_fonciere: 7_000,
      // 4 appels de 250 € : 1 000 € ÷ 12 = 83,33 €.
      copropriete: 8_333,
      assurance: 125,
      travaux: 10_000,
      entretien: 750,
      gestion: 2_500,
      autre: 583,
    });
    expect(reel.cashflow).toBe(14_583 - 4_167 - 7_000 - 8_333 - 125 - 10_000 - 750 - 2_500 - 583);
  });
});

describe('réel contre prévu', () => {
  it('le cas des specs : prévu −35 €, réel −73 € → 38 € par mois de moins ; loyers puis taxe foncière nommés', () => {
    const prevu = mensuel({
      loyers: 71_600,
      mensualites: 60_000,
      taxe_fonciere: 8_000,
      copropriete: 4_000,
      assurance: 1_500,
      gestion: 800,
      entretien: 800,
    });
    const reel = mensuel({
      loyers: 67_600,
      mensualites: 60_000,
      taxe_fonciere: 9_400,
      copropriete: 4_000,
      assurance: 1_500,
    });
    expect(prevu.cashflow).toBe(-3_500);
    expect(reel.cashflow).toBe(-7_300);
    const comparaison = comparerReelPrevu(prevu, reel);
    expect(comparaison.ecart).toBe(-3_800);
    expect(comparaison.principaux).toEqual([
      { poste: 'loyers', prevu: 71_600, reel: 67_600, effet: -4_000 },
      { poste: 'taxe_fonciere', prevu: 8_000, reel: 9_400, effet: -1_400 },
    ]);
  });

  it('un écart sous 1 € par mois n’est pas nommé ; à effet égal, l’ordre des postes ; un mieux que prévu est positif', () => {
    const prevu = mensuel({ loyers: 70_000, assurance: 1_500, gestion: 3_000, entretien: 2_000 });
    const reel = mensuel({
      loyers: 70_000 + ECART_MINIMUM - 1,
      assurance: 1_000,
      gestion: 2_500,
      entretien: 2_000,
    });
    const comparaison = comparerReelPrevu(prevu, reel);
    expect(comparaison.principaux.map((e) => [e.poste, e.effet])).toEqual([
      ['assurance', 500],
      ['gestion', 500],
    ]);
    expect(comparaison.ecart).toBe(ECART_MINIMUM - 1 + 1_000);
    expect(comparerReelPrevu(prevu, prevu)).toEqual({
      prevu,
      reel: prevu,
      ecart: 0,
      principaux: [],
    });
  });
});
