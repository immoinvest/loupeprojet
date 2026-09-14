import {
  CODES_CRITERES,
  OffrePretSchema,
  ProjetFinanceSchema,
  comparerOffres,
  obtenirRegles,
  simulerPret,
  type CodeCritere,
  type ComparaisonOffres,
  type CritereCompare,
} from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import { CHAMPS_OFFRE } from '@/simulateur';

import {
  BOUTONS_SIMULATEUR,
  EXPLICATIONS_SIMULATEUR,
  LIBELLES_CRITERES,
  LIBELLES_RESULTATS,
  PHRASES_SIMULATEUR,
  TITRES_SIMULATEUR,
  criteresParCode,
  formaterCritere,
  formaterEcart,
  formaterValeur,
  phraseSynthese,
} from '@/textes/simulateur';

const n = (s: string): string => s.replace(/\s/g, ' ');
const regles = obtenirRegles('2026-09');

/** Une comparaison où tout est égal, sauf les critères passés. */
function comparaison(
  criteres: Partial<Record<CodeCritere, Partial<CritereCompare>>> = {},
): ComparaisonOffres {
  return {
    criteres: CODES_CRITERES.map((code) => ({
      code,
      a: 1,
      b: 1,
      ecart: 0,
      meilleure: null,
      ...criteres[code],
    })),
  };
}

describe('textes du simulateur', () => {
  it('libelle chaque critère de comparaison et chaque résultat', () => {
    expect(Object.keys(LIBELLES_CRITERES).sort()).toEqual([...CODES_CRITERES].sort());
    expect(LIBELLES_CRITERES.endettement).toBe("Taux d'endettement");
    expect(Object.keys(LIBELLES_RESULTATS)).toHaveLength(11);
    expect(TITRES_SIMULATEUR.page).toBe('Comparer deux offres de prêt');
    expect(BOUTONS_SIMULATEUR.telecharger).toBe('Télécharger le tableau (CSV)');
    expect(EXPLICATIONS_SIMULATEUR.endettement).toMatch(/70 % des loyers/);
  });

  it('formate les pastilles d’usure et d’endettement depuis les règles', () => {
    expect(n(PHRASES_SIMULATEUR.usure(regles.credit.tauxUsure, regles.dateReference))).toBe(
      "au-dessus du taux d'usure (5,29 %, 13 sept. 2026)",
    );
    expect(n(PHRASES_SIMULATEUR.endettementEleve(regles.credit.hcsf.seuilEffort))).toBe(
      'au-delà de 35 % : surveiller',
    );
  });

  it('range les critères par code', () => {
    const c = criteresParCode(comparaison({ dureeAnnees: { a: 25, b: 20, ecart: 5 } }));
    expect(c.dureeAnnees).toEqual({ code: 'dureeAnnees', a: 25, b: 20, ecart: 5, meilleure: null });
    expect(Object.keys(c)).toHaveLength(9);
  });
});

describe('phraseSynthese', () => {
  const noms: readonly [string, string] = ['LCL', 'CIC'];

  it('dit que les offres sont identiques', () => {
    expect(phraseSynthese(comparaison(), noms)).toBe('Les deux offres sont identiques.');
  });

  it('nomme l’offre moins chère et sa mensualité plus basse, chiffres formatés', () => {
    const c = comparaison({
      coutTotalCredit: { a: 94_000, b: 25_287, ecart: 68_713, meilleure: 'b' },
      mensualiteTotale: { a: 807.23, b: 545.54, ecart: 261.69, meilleure: 'b' },
    });
    expect(n(phraseSynthese(c, noms))).toBe(
      'CIC coûte 68 713 € de moins sur toute la durée, pour une mensualité de 262 € de moins.',
    );
  });

  it('distingue la mensualité la plus basse du coût total le plus bas', () => {
    const c = comparaison({
      coutTotalCredit: { a: 94_000, b: 60_000, ecart: 34_000, meilleure: 'b' },
      mensualiteTotale: { a: 807.23, b: 1_088.5, ecart: -281.27, meilleure: 'a' },
    });
    expect(n(phraseSynthese(c, noms))).toBe(
      'LCL a la mensualité la plus basse (281 € de moins par mois), CIC le coût total le plus bas (34 000 € de moins).',
    );
  });

  it('traite une égalité sur l’un des deux critères, ou sur les deux', () => {
    expect(
      n(
        phraseSynthese(
          comparaison({ coutTotalCredit: { a: 1_000, b: 900, ecart: 100, meilleure: 'b' } }),
          noms,
        ),
      ),
    ).toBe('CIC coûte 100 € de moins sur toute la durée, pour la même mensualité.');
    expect(
      n(
        phraseSynthese(
          comparaison({ mensualiteTotale: { a: 800, b: 810, ecart: -10, meilleure: 'a' } }),
          noms,
        ),
      ),
    ).toBe('LCL a la mensualité la plus basse (10 € de moins par mois), pour le même coût total.');
    expect(
      phraseSynthese(
        comparaison({ totalAssurance: { a: 10, b: 20, ecart: -10, meilleure: 'a' } }),
        noms,
      ),
    ).toBe('Les deux offres se valent sur le coût total et la mensualité.');
    // Un écart absent (impossible après comparerOffres) s'affiche 0 € plutôt que de casser la page.
    expect(
      n(
        phraseSynthese(
          comparaison({
            coutTotalCredit: { a: null, b: 900, ecart: null, meilleure: 'b' },
            totalInterets: { a: 10, b: 5, ecart: 5, meilleure: 'b' },
          }),
          noms,
        ),
      ),
    ).toBe('CIC coûte 0 € de moins sur toute la durée, pour la même mensualité.');
  });

  it('part d’une vraie comparaison du moteur', () => {
    const projet = ProjetFinanceSchema.parse({ prix: 155_000, fraisNotaire: 0 });
    // Même durée : le taux le plus bas gagne sur la mensualité et sur le coût total.
    const a = OffrePretSchema.parse({ nom: 'LCL', tauxNominal: 0.033, dureeAnnees: 25 });
    const b = OffrePretSchema.parse({ nom: 'CIC', tauxNominal: 0.017, dureeAnnees: 25 });
    const c = comparerOffres(simulerPret(projet, a, regles), simulerPret(projet, b, regles), a, b);
    expect(n(phraseSynthese(c, ['LCL', 'CIC']))).toMatch(
      /^CIC coûte \d[\d\s ]* € de moins sur toute la durée, pour une mensualité de \d+ € de moins\.$/,
    );
    // Durée plus courte et taux plus bas : mensualité plus lourde, coût plus bas.
    const court = OffrePretSchema.parse({ nom: 'CIC', tauxNominal: 0.028, dureeAnnees: 15 });
    const c2 = comparerOffres(
      simulerPret(projet, a, regles),
      simulerPret(projet, court, regles),
      a,
      court,
    );
    expect(n(phraseSynthese(c2, ['LCL', 'CIC']))).toMatch(
      /^LCL a la mensualité la plus basse \(\d+ € de moins par mois\), CIC le coût total le plus bas/,
    );
  });
});

describe('formatage des critères et des hypothèses', () => {
  it('formate chaque code de critère, et « — » sans valeur', () => {
    expect(n(formaterCritere('mensualiteTotale', 807.234))).toBe('807,23 €/mois');
    expect(n(formaterCritere('coutTotalCredit', 94_000.4))).toBe('94 000 €');
    expect(n(formaterCritere('totalInterets', 1))).toBe('1 €');
    expect(n(formaterCritere('totalAssurance', 1))).toBe('1 €');
    expect(n(formaterCritere('montantEmprunte', 155_000))).toBe('155 000 €');
    expect(n(formaterCritere('taegHorsAssurance', 0.03456))).toBe('3,46 %');
    expect(n(formaterCritere('taegAvecAssurance', 0.03456))).toBe('3,46 %');
    expect(n(formaterCritere('endettement', 0.3844))).toBe('38,4 %');
    expect(n(formaterCritere('dureeAnnees', 25))).toBe('25 ans');
    expect(formaterCritere('endettement', null)).toBe('—');
  });

  it('formate les écarts signés', () => {
    expect(n(formaterEcart('mensualiteTotale', 261.69))).toBe('+262 €/mois');
    expect(n(formaterEcart('coutTotalCredit', -68_713))).toBe('−68 713 €');
    expect(n(formaterEcart('totalInterets', 0))).toBe('0 €');
    expect(n(formaterEcart('totalAssurance', 5))).toBe('+5 €');
    expect(n(formaterEcart('montantEmprunte', 0))).toBe('0 €');
    expect(n(formaterEcart('taegHorsAssurance', 0.0012))).toBe('+0,12 %');
    expect(n(formaterEcart('taegAvecAssurance', -0.0012))).toBe('−0,12 %');
    expect(n(formaterEcart('endettement', 0.05))).toBe('+5,0 %');
    expect(n(formaterEcart('dureeAnnees', 5))).toBe('+5 ans');
    expect(n(formaterEcart('dureeAnnees', -5))).toBe('−5 ans');
    expect(n(formaterEcart('dureeAnnees', 0))).toBe('0 ans');
    expect(formaterEcart('dureeAnnees', null)).toBe('—');
  });

  it('formate une hypothèse d’après son descripteur', () => {
    const euros = { chemin: 'prix', libelle: 'Prix', type: 'euros' } as const;
    expect(n(formaterValeur(euros, 155_000))).toBe('155 000 €');
    expect(formaterValeur(euros, undefined)).toBe('—');
    expect(n(formaterValeur({ chemin: 't', libelle: 'Taux', type: 'pourcent' }, 0.033))).toBe(
      '3,30 %',
    );
    const bool = CHAMPS_OFFRE.find((d) => d.chemin === 'fraisBancairesFinances');
    if (bool === undefined) throw new Error('descripteur attendu');
    expect(formaterValeur(bool, true)).toBe('Oui, ajoutés au prêt');
    expect(formaterValeur(bool, false)).toBe('Non, payés à la signature');
    expect(formaterValeur({ chemin: 'b', libelle: 'B', type: 'bool' }, true)).toBe('—');
    expect(
      n(formaterValeur({ chemin: 'd', libelle: 'Durée', type: 'entier', unite: 'ans' }, 25)),
    ).toBe('25 ans');
    expect(n(formaterValeur({ chemin: 'x', libelle: 'X', type: 'nombre' }, 1.5))).toBe('2');
    expect(formaterValeur({ chemin: 'nom', libelle: 'Banque', type: 'texte' }, 'LCL')).toBe('LCL');
    expect(formaterValeur({ chemin: 'e', libelle: 'E', type: 'enum' }, 42)).toBe('—');
  });
});
