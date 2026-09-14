import { describe, expect, it } from 'vitest';

import { projetExemple } from '../../src/exemples/t3-marseille';
import { calculerFinancement, type TauxEffort } from '../../src/financement';
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
  feuEffort,
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

  it('effort : bon jusqu’à 33 %, à surveiller jusqu’à 35 %, problème au-dessus, inconnu sans revenu', () => {
    const effort = (hcsf: number | null): TauxEffort => ({
      hcsf,
      sansLoyers: hcsf,
      seuil: 0.35,
      depasseHcsf: false,
      dureeMaxAnnees: 25,
      depasseDuree: false,
    });
    expect(feuEffort(effort(0.25), regles).feu).toBe('bon');
    expect(feuEffort(effort(0.34), regles).feu).toBe('surveiller');
    expect(feuEffort(effort(0.4), regles).feu).toBe('probleme');
    expect(feuEffort(effort(null), regles).feu).toBe('inconnu');
  });

  it('un feu inconnu porte la donnée qui manque ; un feu connu ne porte aucune raison', () => {
    const effort: TauxEffort = {
      hcsf: null,
      sansLoyers: null,
      seuil: 0.35,
      depasseHcsf: false,
      dureeMaxAnnees: 25,
      depasseDuree: false,
    };
    expect(feuEffort(effort, regles, 'REVENUS_ABSENTS')).toEqual({
      axe: 'effort',
      feu: 'inconnu',
      valeur: null,
      raison: 'REVENUS_ABSENTS',
    });
    expect(feuEffort(effort, regles).raison).toBeNull();
    expect(feuEffort({ ...effort, hcsf: 0.2 }, regles, 'REVENUS_ABSENTS').raison).toBeNull();
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

  it('cinq feux dans l’ordre : prix bon (−22 %), rendement à surveiller, cash-flow problème, effort bon, risques bon', () => {
    expect(verdict.feux.map((f) => f.axe)).toEqual([
      'prix',
      'rendement',
      'cashflow',
      'effort',
      'risques',
    ]);
    expect(verdict.feux.map((f) => f.feu)).toEqual(['bon', 'surveiller', 'probleme', 'bon', 'bon']);
    expect(verdict.feux[0]?.valeur).toBeCloseTo(155_000 / 65 / 3_050 - 1, 6);
    expect(verdict.synthese).toEqual({ bons: 3, surveiller: 1, problemes: 1, inconnus: 0 });
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

  it('sans revenus : effort inconnu avec sa raison, aucun signal d’effort dépassé', () => {
    const hypotheses = Object.fromEntries(
      Object.entries(projetExemple.hypotheses).filter(([k]) => k !== 'revenusMensuels'),
    ) as ProjetEntree['hypotheses'];
    const { verdict } = verdictDe({ ...projetExemple, hypotheses });
    expect(verdict.feux[3]).toEqual({
      axe: 'effort',
      feu: 'inconnu',
      valeur: null,
      raison: 'REVENUS_ABSENTS',
    });
    expect(verdict.synthese.inconnus).toBe(1);
    expect(codes(verdict)).not.toContain('EFFORT_HCSF_DEPASSE');
    // Les manques peuvent aussi être fournis par l'appelant : ils priment sur la lecture du projet.
    const projet = parserComplet(projetExemple);
    const financement = calculerFinancement(projet, regles);
    const fiscalite = calculerFiscalite(projet, financement, regles);
    const revente = calculerRevente(projet, financement, fiscalite, regles);
    const rendement = calculerRendement(projet, financement, fiscalite, revente);
    const force = calculerVerdict(projet, financement, fiscalite, rendement, regles, {
      manques: [],
    });
    expect(force.feux[3]?.raison).toBeNull();
  });

  it('sans fiscalité ni rendement (loyer absent) : trois feux inconnus, points fiscaux absents', () => {
    const projet = ProjetSchema.parse({
      ...projetExemple,
      marche: { ...projetExemple.marche, plafondLoyerMensuel: 900 },
    });
    const financement = calculerFinancement(projet, regles);
    const manques = [{ code: 'LOYER_ABSENT' as const, champ: 'hypotheses.location.loyerHc' }];
    const verdict = calculerVerdict(projet, financement, null, null, regles, { manques });
    // Le financement, lui, connaît les revenus et le loyer : l'effort reste jugé.
    expect(verdict.feux.map((f) => f.feu)).toEqual(['bon', 'inconnu', 'inconnu', 'bon', 'bon']);
    expect(verdict.feux.map((f) => f.raison)).toEqual([
      null,
      'LOYER_ABSENT',
      'LOYER_ABSENT',
      null,
      null,
    ]);
    // Sans fiscalité, seuls les points de la banque peuvent rester : ici l'effort et la durée passent.
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

  it('revenus trop faibles et prêt trop long : effort et durée signalés', () => {
    const { verdict } = verdictDe(
      variante({}, undefined, {
        revenusMensuels: 1_200,
        pret: { ...projetExemple.hypotheses.pret, dureeAnnees: 27 },
      }),
    );
    expect(verdict.feux[3]?.feu).toBe('probleme');
    expect(codes(verdict)).toContain('EFFORT_HCSF_DEPASSE');
    expect(codes(verdict)).toContain('DUREE_PRET_HORS_HCSF');
  });

  it('régime micro au-dessus du plafond et loyer au-dessus de l’encadrement', () => {
    const { verdict } = verdictDe(
      variante(
        {},
        { ...projetExemple.marche, plafondLoyerMensuel: 900 },
        {
          location: { mode: 'meuble_lld', loyerHc: 8_000, vacanceSemaines: 0 },
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
