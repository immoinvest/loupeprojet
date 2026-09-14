import {
  calculerProjet,
  projetExemple,
  type CodeCorrection,
  type Correction,
  type EstimationPrix,
} from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import type { TendanceAdresse } from '@/enrichissement';
import {
  eurosArrondis,
  libelleSemestre,
  phraseEstimation,
  phraseTendance,
  raisonCorrection,
} from '@/textes/estimation';

const n = (s: string): string => s.replace(/\s/g, ' ');

const r = calculerProjet(projetExemple);
const estimation = r.estimation!;
const { bien } = r.projet;
const correction = (code: CodeCorrection): Correction => ({
  code,
  taux: 0,
  montant: 0,
  ignoree: false,
});

describe('textes de l’estimation', () => {
  it('arrondit au millier et nomme les semestres', () => {
    expect(n(eurosArrondis(206_733))).toBe('207 000 €');
    expect(libelleSemestre('2025-S1')).toBe('1er semestre 2025');
    expect(libelleSemestre('2024-S2')).toBe('2e semestre 2024');
  });

  it('phrase de la fourchette, écart au prix affiché', () => {
    expect(n(phraseEstimation(estimation))).toBe(
      'Estimé entre 190 000 € et 223 000 €. Le prix affiché est à −25 % de l’estimation.',
    );
  });

  it('raison de chaque correction, avec les chiffres du bien', () => {
    expect(raisonCorrection(correction('dpe'), { ...bien, dpe: 'E' }, estimation)).toBe(
      'DPE E, comparé à un DPE D.',
    );
    expect(raisonCorrection(correction('dpe'), { ...bien, dpe: undefined }, estimation)).toBe(
      'DPE ?, comparé à un DPE D.',
    );
    expect(raisonCorrection(correction('etage'), bien, estimation)).toBe(
      '3e étage sans ascenseur, comparé à un 2e étage.',
    );
    expect(raisonCorrection(correction('etage'), { ...bien, ascenseur: true }, estimation)).toBe(
      '3e étage avec ascenseur, comparé à un 2e étage.',
    );
    expect(raisonCorrection(correction('etage'), { ...bien, etage: 0 }, estimation)).toBe(
      'Rez-de-chaussée.',
    );
    expect(raisonCorrection(correction('etage'), { ...bien, etage: undefined }, estimation)).toBe(
      'Rez-de-chaussée.',
    );
    expect(raisonCorrection(correction('exterieur'), bien, estimation)).toBe('Balcon ou terrasse.');
    expect(raisonCorrection(correction('occupation'), bien, estimation)).toBe(
      'Locataire en place : un bien occupé se vend moins cher qu’un bien libre.',
    );
    expect(n(raisonCorrection(correction('charges'), bien, estimation))).toBe(
      '1 080 € par an, 610 € en dessous du repère de 1 690 €, capitalisés au rendement local de 5,9 %.',
    );
    const cheres: EstimationPrix = {
      ...estimation,
      charges: {
        repereAnnuel: 1690,
        excedentAnnuel: 3000,
        rendementLocal: 0.05,
        borneAtteinte: true,
      },
    };
    expect(n(raisonCorrection(correction('charges'), bien, cheres))).toBe(
      '4 690 € par an, 3 000 € au-dessus du repère de 1 690 €, capitalisés au rendement local de 5,0 %. Effet plafonné.',
    );
    expect(raisonCorrection(correction('charges'), bien, { ...estimation, charges: null })).toBe(
      '',
    );
  });

  it('phrase de tendance : zone et évolutions connues', () => {
    const tendance: TendanceAdresse = {
      zone: 'commune',
      periodeReference: '2025-S1',
      evolution1an: 0.05,
      evolution2ans: -0.031,
      points: [],
    };
    expect(n(phraseTendance(tendance))).toBe(
      'Prix ramenés au 1er semestre 2025 par l’évolution de la commune : +5,0 % sur un an, −3,1 % sur deux ans.',
    );
    expect(
      phraseTendance({ ...tendance, zone: 'departement', evolution1an: null, evolution2ans: null }),
    ).toBe('Prix ramenés au 1er semestre 2025 par l’évolution du département.');
  });
});
