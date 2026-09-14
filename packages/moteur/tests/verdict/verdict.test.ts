import { describe, expect, it } from 'vitest';

import { projetExemple } from '../../src/exemples/t3-marseille';
import { calculerFinancement } from '../../src/financement';
import { calculerFiscalite } from '../../src/fiscalite';
import { obtenirRegles } from '../../src/regles';
import { calculerRendement } from '../../src/rendement';
import { calculerRevente } from '../../src/revente';
import { MarcheSchema, ProjetSchema, type Projet, type ProjetEntree } from '../../src/schema';
import {
  calculerVerdict,
  feuCashflow,
  feuCouverture,
  feuPrix,
  feuRendement,
  feuRisques,
  type ResultatVerdict,
} from '../../src/verdict';

const regles = obtenirRegles('2026-09');

function verdictDe(entree: ProjetEntree): { projet: Projet; verdict: ResultatVerdict } {
  const projet = ProjetSchema.parse(entree);
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
    expect(bon).toEqual({ axe: 'couverture', feu: 'bon', valeur: 0.65 });
    expect(feuCouverture(0.7, regles).feu).toBe('bon');
    expect(feuCouverture(0.84, regles).feu).toBe('surveiller');
    expect(feuCouverture(1, regles).feu).toBe('surveiller');
    expect(feuCouverture(1.1, regles).feu).toBe('probleme');
    expect(feuCouverture(null, regles)).toEqual({
      axe: 'couverture',
      feu: 'inconnu',
      valeur: null,
    });
  });

  it('risques : DPE F/G bloquant ; E, procédure ou risque fort à surveiller ; sinon bon', () => {
    const bien = ProjetSchema.parse(projetExemple).bien;
    expect(feuRisques(bien, marche)).toEqual({ axe: 'risques', feu: 'bon', valeur: 0 });
    expect(feuRisques({ ...bien, dpe: 'G' }, marche).feu).toBe('probleme');
    expect(feuRisques({ ...bien, dpe: 'E' }, marche)).toEqual({
      axe: 'risques',
      feu: 'surveiller',
      valeur: 1,
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

  it('liste les points de vigilance attendus, sans phrase rédigée', () => {
    const c = codes(verdict);
    expect(c).toEqual(
      expect.arrayContaining([
        'PV_AG_ET_CARNET',
        'CONFIRMER_CHARGES_COPRO',
        'VERIFIER_DPE',
        'SANS_ASCENSEUR_ETAGE_ELEVE',
        'EXPLIQUER_PRIX_SOUS_MARCHE',
        'CONFIRMER_TAXE_FONCIERE',
        'PS_BIC_A_CONFIRMER',
      ]),
    );
    expect(c).not.toContain('COPRO_EN_PROCEDURE');
    expect(c).not.toContain('RENOVATION_ENERGETIQUE_OBLIGATOIRE');
    expect(c).not.toContain('EFFORT_HCSF_DEPASSE');
    const pv = verdict.vigilance.find((p) => p.code === 'PV_AG_ET_CARNET');
    expect(pv?.parametres).toEqual({ lots: 24, annee: 1962 });
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

  it('DPE G, copro en procédure, risque fort : problème et codes dédiés', () => {
    const { verdict } = verdictDe(
      variante(
        { dpe: 'G', copro: { lots: 12, procedure: true } },
        { risques: [{ type: 'inondation', niveau: 'fort' }] },
      ),
    );
    expect(verdict.feux[4]?.feu).toBe('probleme');
    expect(verdict.feux[0]?.feu).toBe('inconnu');
    const c = codes(verdict);
    expect(c).toContain('COPRO_EN_PROCEDURE');
    expect(c).toContain('RISQUE_NATUREL');
    expect(c).not.toContain('EXPLIQUER_PRIX_SOUS_MARCHE');
    const reno = verdict.vigilance.find((p) => p.code === 'RENOVATION_ENERGETIQUE_OBLIGATOIRE');
    expect(reno?.parametres).toEqual({ dpe: 'G', annee: 2025 });
  });

  it('sans copro, sans DPE, sans étage : moins de points ; lots et année inconnus tolérés', () => {
    const { verdict } = verdictDe(
      variante({ copro: undefined, dpe: undefined, etage: undefined, annee: undefined }),
    );
    const c = codes(verdict);
    expect(c).not.toContain('PV_AG_ET_CARNET');
    expect(c).not.toContain('VERIFIER_DPE');
    expect(c).not.toContain('SANS_ASCENSEUR_ETAGE_ELEVE');
    const { verdict: sansLots } = verdictDe(variante({ copro: {}, annee: undefined }));
    expect(sansLots.vigilance.find((p) => p.code === 'PV_AG_ET_CARNET')?.parametres).toEqual({
      lots: 0,
      annee: 0,
    });
  });

  it('étage élevé avec ascenseur ou étage bas : pas de signal', () => {
    expect(codes(verdictDe(variante({ ascenseur: true })).verdict)).not.toContain(
      'SANS_ASCENSEUR_ETAGE_ELEVE',
    );
    expect(codes(verdictDe(variante({ etage: 1 })).verdict)).not.toContain(
      'SANS_ASCENSEUR_ETAGE_ELEVE',
    );
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
        location: { mode: 'meuble_lld', loyerHc: 1_500, vacanceSemaines: 0 },
      }),
    ).verdict;
    expect(large.feux[3]).toMatchObject({ axe: 'couverture', feu: 'bon' });
    const insuffisant = verdictDe(
      variante({}, undefined, { location: { mode: 'meuble_lld', loyerHc: 700 } }),
    ).verdict;
    expect(insuffisant.feux[3]?.feu).toBe('probleme');
    expect(insuffisant.feux[3]?.valeur).toBeCloseTo(826.65 / 700, 3);
    const sansLoyer = verdictDe(
      variante({}, undefined, {
        location: { mode: 'nu', loyerHc: 0 },
        fiscalite: { tmi: 0.3, regime: 'nu_reel' },
      }),
    ).verdict;
    expect(sansLoyer.feux[3]).toEqual({ axe: 'couverture', feu: 'inconnu', valeur: null });
    expect(sansLoyer.synthese.inconnus).toBeGreaterThanOrEqual(1);
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
