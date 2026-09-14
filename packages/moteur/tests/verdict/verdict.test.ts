import { describe, expect, it } from 'vitest';

import { projetExemple } from '../../src/exemples/t3-marseille';
import { calculerFinancement } from '../../src/financement';
import { calculerFiscalite } from '../../src/fiscalite';
import { obtenirRegles } from '../../src/regles';
import { calculerRendement } from '../../src/rendement';
import { calculerRevente } from '../../src/revente';
import {
  MarcheSchema,
  ProjetSchema,
  parserComplet,
  type Projet,
  type ProjetEntree,
} from '../../src/schema';
import {
  calculerVerdict,
  feuCashflow,
  feuCouverture,
  feuPrix,
  feuRendement,
  feuRisques,
  pointsDeVigilance,
  type ResultatVerdict,
} from '../../src/verdict';

const regles = obtenirRegles('2026-09');

function verdictDe(entree: ProjetEntree): { projet: Projet; verdict: ResultatVerdict } {
  const projet = parserComplet(entree);
  const financement = calculerFinancement(projet, regles);
  const fiscalite = calculerFiscalite(projet, financement, regles);
  const revente = calculerRevente(projet, financement, fiscalite, regles);
  const rendement = calculerRendement(projet, financement, fiscalite, revente);
  return { projet, verdict: calculerVerdict(projet, financement, fiscalite, rendement, regles) };
}

const codes = (v: ResultatVerdict): string[] => v.vigilance.map((p) => p.code);

describe('feux unitaires', () => {
  const marche = MarcheSchema.parse({ dvf: { medianM2: 3_000, nombreVentes: 20 } });

  it('prix : bon sous −5 %, à surveiller jusqu’à +5 %, problème au-dessus, inconnu sans DVF', () => {
    const bon = feuPrix(2_700, marche, regles);
    expect(bon.axe).toBe('prix');
    expect(bon.feu).toBe('bon');
    expect(bon.valeur).toBeCloseTo(-0.1, 10);
    expect(feuPrix(3_000, marche, regles).feu).toBe('surveiller');
    expect(feuPrix(3_300, marche, regles).feu).toBe('probleme');
    expect(feuPrix(3_000, MarcheSchema.parse({}), regles)).toEqual({
      axe: 'prix',
      feu: 'inconnu',
      valeur: null,
      raison: null,
    });
  });

  it('prix : compare au prix au m² estimé quand il est fourni, plutôt qu’à la médiane', () => {
    expect(feuPrix(3_000, marche, regles, 3_500).valeur).toBeCloseTo(3_000 / 3_500 - 1, 10);
    expect(feuPrix(3_000, marche, regles, 3_500).feu).toBe('bon');
    expect(feuPrix(3_000, MarcheSchema.parse({}), regles, 3_500).feu).toBe('inconnu');
  });

  it('rendement net : bon dès 5,5 %, à surveiller dès 4 %, problème en dessous', () => {
    expect(feuRendement(0.06, regles).feu).toBe('bon');
    expect(feuRendement(0.045, regles).feu).toBe('surveiller');
    expect(feuRendement(0.03, regles).feu).toBe('probleme');
  });

  it('cash-flow : bon dès 0, à surveiller jusqu’à −100, problème en dessous', () => {
    expect(feuCashflow(12, regles).feu).toBe('bon');
    expect(feuCashflow(-60, regles).feu).toBe('surveiller');
    expect(feuCashflow(-134, regles).feu).toBe('probleme');
  });

  it('couverture : bon jusqu’à 70 % du loyer, à surveiller jusqu’à 100 %, problème au-dessus, inconnu sans loyer', () => {
    const bon = feuCouverture(0.65, regles);
    expect(bon).toEqual({ axe: 'couverture', feu: 'bon', valeur: 0.65, raison: null });
    expect(feuCouverture(0.7, regles).feu).toBe('bon');
    expect(feuCouverture(0.84, regles).feu).toBe('surveiller');
    expect(feuCouverture(1, regles).feu).toBe('surveiller');
    expect(feuCouverture(1.1, regles).feu).toBe('probleme');
    expect(feuCouverture(null, regles)).toEqual({
      axe: 'couverture',
      feu: 'inconnu',
      valeur: null,
      raison: null,
    });
  });

  it('un feu inconnu porte la donnée qui manque ; un feu connu ne porte aucune raison', () => {
    expect(feuCouverture(null, regles, 'LOYER_ABSENT')).toEqual({
      axe: 'couverture',
      feu: 'inconnu',
      valeur: null,
      raison: 'LOYER_ABSENT',
    });
    expect(feuCouverture(0.84, regles, 'LOYER_ABSENT').raison).toBeNull();
    expect(feuRendement(null, regles, 'LOYER_ABSENT')).toEqual({
      axe: 'rendement',
      feu: 'inconnu',
      valeur: null,
      raison: 'LOYER_ABSENT',
    });
    expect(feuRendement(null, regles).raison).toBeNull();
    expect(feuRendement(0.06, regles, 'LOYER_ABSENT').raison).toBeNull();
    expect(feuCashflow(null, regles, 'LOYER_ABSENT')).toEqual({
      axe: 'cashflow',
      feu: 'inconnu',
      valeur: null,
      raison: 'LOYER_ABSENT',
    });
    expect(feuCashflow(null, regles).raison).toBeNull();
    expect(feuCashflow(12, regles, 'LOYER_ABSENT').raison).toBeNull();
  });

  it('risques : DPE F/G bloquant ; E, procédure ou risque fort à surveiller ; sinon bon', () => {
    const bien = ProjetSchema.parse(projetExemple).bien;
    expect(feuRisques(bien, marche)).toEqual({
      axe: 'risques',
      feu: 'bon',
      valeur: 0,
      raison: null,
    });
    expect(feuRisques({ ...bien, dpe: 'G' }, marche).feu).toBe('probleme');
    expect(feuRisques({ ...bien, dpe: 'E' }, marche)).toEqual({
      axe: 'risques',
      feu: 'surveiller',
      valeur: 1,
      raison: null,
    });
    expect(feuRisques({ ...bien, copro: { procedure: true } }, marche).feu).toBe('surveiller');
    const inondable = MarcheSchema.parse({ risques: [{ type: 'inondation', niveau: 'fort' }] });
    expect(feuRisques(bien, inondable).valeur).toBe(1);
    expect(feuRisques({ ...bien, dpe: undefined, copro: undefined }, marche).feu).toBe('bon');
  });
});

describe('calculerVerdict — T3 Marseille', () => {
  const { verdict } = verdictDe(projetExemple);

  it('cinq feux dans l’ordre : prix bon (−22 %), rendement à surveiller, cash-flow problème, couverture à surveiller (84 %), risques bon', () => {
    expect(verdict.feux.map((f) => f.axe)).toEqual([
      'prix',
      'rendement',
      'cashflow',
      'couverture',
      'risques',
    ]);
    expect(verdict.feux.map((f) => f.feu)).toEqual([
      'bon',
      'surveiller',
      'probleme',
      'surveiller',
      'bon',
    ]);
    expect(verdict.feux[0]?.valeur).toBeCloseTo(155_000 / 65 / 3_050 - 1, 6);
    // Mensualité assurance comprise 827 € pour 980 € de loyer.
    expect(verdict.feux[3]?.valeur).toBeCloseTo(826.65 / 980, 3);
    expect(verdict.synthese).toEqual({ bons: 2, surveiller: 2, problemes: 1, inconnus: 0 });
  });

  it('ne liste que les points financiers, sans phrase rédigée : ici les PS du meublé à confirmer', () => {
    expect(codes(verdict)).toEqual(['PS_BIC_A_CONFIRMER']);
    expect(verdict.vigilance[0]?.parametres).toEqual({ taux: 0.186 });
    for (const p of verdict.vigilance) {
      expect(p.code).toMatch(/^[A-Z_]+$/);
    }
  });
});

describe('calculerVerdict — variantes', () => {
  const variante = (
    bien: Partial<ProjetEntree['bien']>,
    marche?: ProjetEntree['marche'],
    hypotheses?: Partial<ProjetEntree['hypotheses']>,
  ): ProjetEntree => ({
    ...projetExemple,
    bien: { ...projetExemple.bien, ...bien },
    ...(marche !== undefined ? { marche } : {}),
    hypotheses: { ...projetExemple.hypotheses, ...hypotheses },
  });

  it('DPE G, copro en procédure, risque fort : problème aux feux, mais ces signaux ne sont plus des points (ils sont dans la liste de visite)', () => {
    const { verdict } = verdictDe(
      variante(
        { dpe: 'G', copro: { lots: 12, procedure: true } },
        { risques: [{ type: 'inondation', niveau: 'fort' }] },
      ),
    );
    expect(verdict.feux[4]?.feu).toBe('probleme');
    expect(verdict.feux[0]?.feu).toBe('inconnu');
    expect(codes(verdict)).toEqual(['PS_BIC_A_CONFIRMER']);
  });

  it('les manques fournis par l’appelant priment sur la lecture du projet', () => {
    const projet = parserComplet(projetExemple);
    const financement = calculerFinancement(projet, regles);
    const force = calculerVerdict(projet, financement, null, null, regles, { manques: [] });
    expect(force.feux.map((f) => f.feu)).toEqual(['bon', 'inconnu', 'inconnu', 'inconnu', 'bon']);
    expect(force.feux.every((f) => f.raison === null)).toBe(true);
  });

  it('sans fiscalité ni rendement (loyer absent) : trois feux inconnus, points fiscaux absents', () => {
    const projet = ProjetSchema.parse({
      ...projetExemple,
      marche: { ...projetExemple.marche, plafondLoyerMensuel: 900 },
    });
    const financement = calculerFinancement(projet, regles);
    const manques = [{ code: 'LOYER_ABSENT' as const, champ: 'hypotheses.location.loyerHc' }];
    const verdict = calculerVerdict(projet, financement, null, null, regles, { manques });
    expect(verdict.feux.map((f) => f.feu)).toEqual(['bon', 'inconnu', 'inconnu', 'inconnu', 'bon']);
    expect(verdict.feux.map((f) => f.raison)).toEqual([
      null,
      'LOYER_ABSENT',
      'LOYER_ABSENT',
      'LOYER_ABSENT',
      null,
    ]);
    // Sans fiscalité, seuls les points de la banque peuvent rester : ici aucun.
    expect(codes(verdict)).toEqual([]);
  });

  it('loyer encadré : le point n’est posé que si le loyer est connu et au-dessus du plafond', () => {
    const plafonne = { ...projetExemple.marche, plafondLoyerMensuel: 900 };
    const complet = parserComplet({ ...projetExemple, marche: plafonne });
    const financement = calculerFinancement(complet, regles);
    const fiscalite = calculerFiscalite(complet, financement, regles);
    const avecLoyer = pointsDeVigilance(complet, financement, fiscalite);
    expect(avecLoyer.map((p) => p.code)).toContain('LOYER_AU_DESSUS_PLAFOND');
    // Même fiscalité, projet sans loyer : le plafond ne peut pas être comparé.
    const location = Object.fromEntries(
      Object.entries(complet.hypotheses.location).filter(([k]) => k !== 'loyerHc'),
    );
    const sansLoyer = ProjetSchema.parse({
      ...complet,
      hypotheses: { ...complet.hypotheses, location },
    });
    const codesSansLoyer = pointsDeVigilance(sansLoyer, financement, fiscalite).map((p) => p.code);
    expect(codesSansLoyer).not.toContain('LOYER_AU_DESSUS_PLAFOND');
    expect(codesSansLoyer).toContain('PS_BIC_A_CONFIRMER');
  });

  it('revenus trop faibles (projet ancien) et prêt trop long : effort HCSF et durée signalés', () => {
    const { verdict } = verdictDe(
      variante({}, undefined, {
        revenusMensuels: 1_200,
        pret: { ...projetExemple.hypotheses.pret, dureeAnnees: 27 },
      }),
    );
    expect(codes(verdict)).toContain('EFFORT_HCSF_DEPASSE');
    expect(codes(verdict)).toContain('DUREE_PRET_HORS_HCSF');
  });

  it('sans revenus, l’effort HCSF n’est jamais signalé ; avec des revenus suffisants non plus', () => {
    expect(codes(verdictDe(projetExemple).verdict)).not.toContain('EFFORT_HCSF_DEPASSE');
    expect(
      codes(verdictDe(variante({}, undefined, { revenusMensuels: 2_600 })).verdict),
    ).not.toContain('EFFORT_HCSF_DEPASSE');
  });

  it('couverture : bon quand le loyer porte largement le crédit, problème quand il ne le couvre plus, inconnu sans loyer', () => {
    const large = verdictDe(
      variante({}, undefined, {
        location: { mode: 'meuble', loyerHc: 1_500, vacanceSemaines: 0 },
      }),
    ).verdict;
    expect(large.feux[3]).toMatchObject({ axe: 'couverture', feu: 'bon' });
    const insuffisant = verdictDe(
      variante({}, undefined, { location: { mode: 'meuble', loyerHc: 700 } }),
    ).verdict;
    expect(insuffisant.feux[3]?.feu).toBe('probleme');
    expect(insuffisant.feux[3]?.valeur).toBeCloseTo(826.65 / 700, 3);
    const sansLoyer = verdictDe(
      variante({}, undefined, {
        location: { mode: 'nu', loyerHc: 0 },
        fiscalite: { tmi: 0.3, regime: 'nu_reel' },
      }),
    ).verdict;
    expect(sansLoyer.feux[3]).toEqual({
      axe: 'couverture',
      feu: 'inconnu',
      valeur: null,
      raison: null,
    });
    expect(sansLoyer.synthese.inconnus).toBeGreaterThanOrEqual(1);
  });

  it('régime micro au-dessus du plafond et loyer au-dessus de l’encadrement', () => {
    const { verdict } = verdictDe(
      variante(
        {},
        { ...projetExemple.marche, plafondLoyerMensuel: 900 },
        {
          location: { mode: 'meuble', loyerHc: 8_000, vacanceSemaines: 0 },
          fiscalite: { tmi: 0.3, regime: 'micro_bic' },
        },
      ),
    );
    expect(codes(verdict)).toContain('PLAFOND_MICRO_DEPASSE');
    expect(codes(verdict)).toContain('LOYER_AU_DESSUS_PLAFOND');
  });

  it('en nu, pas d’alerte sur les prélèvements sociaux BIC', () => {
    const { verdict } = verdictDe(
      variante({}, undefined, {
        location: { mode: 'nu', loyerHc: 850 },
        fiscalite: { tmi: 0.3, regime: 'nu_reel' },
      }),
    );
    expect(codes(verdict)).not.toContain('PS_BIC_A_CONFIRMER');
    expect(codes(verdict)).not.toContain('PLAFOND_MICRO_DEPASSE');
  });
});
