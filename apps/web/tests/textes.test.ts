import {
  calculerProjet,
  projetExemple,
  type PointVigilance,
  type ProjetEntree,
} from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import { AXES, ETATS, libelleFeu } from '@/textes/feux';
import { PHASES, TEXTES_FINANCEMENT, phraseCouverture } from '@/textes/financement';
import {
  CRITERES_PRIX,
  MODES,
  ORDRE_REGIMES,
  REGIMES,
  SCENARIOS,
  explicationRegime,
} from '@/textes/regimes';
import { reponseCourte, texteVerdict } from '@/textes/verdict';
import {
  CATEGORIES,
  ORDRE_CATEGORIES,
  categorieVigilance,
  phraseVigilance,
} from '@/textes/vigilance';

const n = (s: string): string => s.replace(/\s/g, ' ');

const variante = (
  h: Partial<ProjetEntree['hypotheses']>,
  marche?: ProjetEntree['marche'],
): ProjetEntree => ({
  ...projetExemple,
  ...(marche === undefined ? {} : { marche }),
  hypotheses: { ...projetExemple.hypotheses, ...h },
});

describe('financement', () => {
  it('a une phrase par feu de couverture et des libellés paramétrés', () => {
    expect(phraseCouverture('bon')).toContain('porte le crédit');
    expect(phraseCouverture('surveiller')).toContain('couvre la mensualité');
    expect(phraseCouverture('probleme')).toContain('ne couvre même pas');
    expect(phraseCouverture('inconnu')).toContain('Indiquez un loyer');
    expect(TEXTES_FINANCEMENT.dureeMax(27)).toBe('plus long que le maximum bancaire de 27 ans');
    expect(TEXTES_FINANCEMENT.effortDepasse('35 %')).toBe('au-dessus de 35 %');
    expect(Object.keys(PHASES)).toEqual(['differe_total', 'differe_partiel', 'amortissement']);
  });
});

describe('feux', () => {
  it('libelle chaque axe avec sa valeur formatée', () => {
    expect(n(libelleFeu({ axe: 'prix', feu: 'bon', valeur: -0.218 }))).toBe('Prix −22 %');
    expect(n(libelleFeu({ axe: 'rendement', feu: 'surveiller', valeur: 0.0428 }))).toBe(
      'Rendement net 4,3 %',
    );
    expect(n(libelleFeu({ axe: 'cashflow', feu: 'probleme', valeur: -210.3 }))).toBe(
      'Cash-flow −210 €/mois',
    );
    expect(n(libelleFeu({ axe: 'couverture', feu: 'surveiller', valeur: 0.8435 }))).toBe(
      'Crédit 84 % du loyer',
    );
    expect(libelleFeu({ axe: 'risques', feu: 'bon', valeur: 0 })).toBe('Risques : aucun');
    expect(libelleFeu({ axe: 'risques', feu: 'surveiller', valeur: 1 })).toBe('Risques : 1 signal');
    expect(libelleFeu({ axe: 'risques', feu: 'probleme', valeur: 2 })).toBe('Risques : 2 signaux');
    expect(libelleFeu({ axe: 'prix', feu: 'inconnu', valeur: null })).toBe(
      'Prix vs ventes réelles : pas de données',
    );
  });

  it('a un libellé pour chaque axe, état, régime, mode, scénario, critère', () => {
    expect(Object.keys(AXES)).toHaveLength(5);
    expect(Object.keys(ETATS)).toHaveLength(4);
    expect(Object.keys(REGIMES)).toHaveLength(4);
    expect(Object.keys(MODES)).toHaveLength(3);
    expect(Object.keys(SCENARIOS)).toHaveLength(7);
    expect(Object.keys(CRITERES_PRIX)).toHaveLength(3);
  });
});

describe('vigilance', () => {
  const p = (
    code: PointVigilance['code'],
    parametres: PointVigilance['parametres'] = {},
  ): PointVigilance => ({ code, parametres });

  it('a une phrase pour chaque code', () => {
    const codes: PointVigilance['code'][] = [
      'PV_AG_ET_CARNET',
      'CONFIRMER_CHARGES_COPRO',
      'COPRO_EN_PROCEDURE',
      'VERIFIER_DPE',
      'RENOVATION_ENERGETIQUE_OBLIGATOIRE',
      'EXPLIQUER_PRIX_SOUS_MARCHE',
      'CONFIRMER_TAXE_FONCIERE',
      'RISQUE_NATUREL',
      'SANS_ASCENSEUR_ETAGE_ELEVE',
      'EFFORT_HCSF_DEPASSE',
      'DUREE_PRET_HORS_HCSF',
      'PLAFOND_MICRO_DEPASSE',
      'LOYER_AU_DESSUS_PLAFOND',
      'PS_BIC_A_CONFIRMER',
    ];
    const parametres = {
      lots: 24,
      annee: 1962,
      dpe: 'D',
      ecart: -0.22,
      type: 'inondation',
      etage: 3,
      seuil: 0.35,
      dureeMax: 25,
      plafond: 900,
      taux: 0.186,
    };
    for (const code of codes) {
      expect(phraseVigilance(p(code, parametres)).length).toBeGreaterThan(10);
    }
  });

  it('insère les paramètres', () => {
    expect(phraseVigilance(p('PV_AG_ET_CARNET', { lots: 24, annee: 1962 }))).toContain(
      '(24 lots, 1962)',
    );
    expect(phraseVigilance(p('PV_AG_ET_CARNET', { lots: 0, annee: 0 }))).not.toContain('(');
    expect(phraseVigilance(p('PV_AG_ET_CARNET', { lots: 12, annee: 0 }))).toContain('(12 lots)');
    expect(n(phraseVigilance(p('EXPLIQUER_PRIX_SOUS_MARCHE', { ecart: -0.22 })))).toContain(
      '−22 %',
    );
    expect(
      phraseVigilance(p('RENOVATION_ENERGETIQUE_OBLIGATOIRE', { dpe: 'G', annee: 2025 })),
    ).toContain('2025');
    expect(n(phraseVigilance(p('LOYER_AU_DESSUS_PLAFOND', { plafond: 900 })))).toContain('900 €');
    expect(phraseVigilance(p('VERIFIER_DPE'))).toContain('DPE ');
    expect(phraseVigilance(p('EFFORT_HCSF_DEPASSE', { seuil: 'x' }))).toContain('0 %');
  });
});

describe('régimes : explications et ordre', () => {
  const r = calculerProjet(projetExemple);
  const dix = r.projet.hypotheses.revente.annees;

  it('couvre les quatre régimes dans un ordre meublé puis nu', () => {
    expect(ORDRE_REGIMES).toEqual(['lmnp_reel', 'micro_bic', 'nu_reel', 'micro_foncier']);
  });

  it('LMNP réel sans impôt : réserve d’amortissements ; nu réel : première année imposable', () => {
    expect(n(explicationRegime(r.fiscalite.regimes.lmnp_reel, dix))).toContain(
      'aucun impôt sur 10 ans, et 50 807 € restent en réserve',
    );
    expect(explicationRegime(r.fiscalite.regimes.nu_reel, dix)).toContain("à partir de l'année 6");
    expect(explicationRegime(r.fiscalite.regimes.micro_bic, dix)).toContain('50 %');
    expect(explicationRegime(r.fiscalite.regimes.micro_foncier, dix)).toContain('30 %');
  });

  it('LMNP réel imposé et nu réel jamais imposé : les autres phrases', () => {
    const riche = calculerProjet(
      variante({ location: { mode: 'meuble_lld', loyerHc: 2_300, vacanceSemaines: 0 } }),
    );
    expect(riche.fiscalite.regimes.lmnp_reel.premiereAnneeImposable).not.toBeNull();
    expect(explicationRegime(riche.fiscalite.regimes.lmnp_reel, dix)).toMatch(
      /jusqu'à l'année \d+/,
    );
    const nuSansImpot = calculerProjet(
      variante({
        location: { mode: 'nu', loyerHc: 400 },
        fiscalite: { tmi: 0.3, regime: 'nu_reel' },
      }),
    );
    expect(nuSansImpot.fiscalite.regimes.nu_reel.premiereAnneeImposable).toBeNull();
    expect(explicationRegime(nuSansImpot.fiscalite.regimes.nu_reel, dix)).toContain(
      'aucun impôt sur 10 ans',
    );
  });

  it('plafond dépassé', () => {
    const gros = calculerProjet(
      variante({ location: { mode: 'meuble_lld', loyerHc: 8_000, vacanceSemaines: 0 } }),
    );
    expect(explicationRegime(gros.fiscalite.regimes.micro_bic, dix)).toContain('inaccessible');
  });
});

describe('catégories de vigilance', () => {
  it('chaque code a une catégorie, et chaque catégorie un libellé', () => {
    const codes = [
      'PV_AG_ET_CARNET',
      'CONFIRMER_CHARGES_COPRO',
      'COPRO_EN_PROCEDURE',
      'VERIFIER_DPE',
      'RENOVATION_ENERGETIQUE_OBLIGATOIRE',
      'EXPLIQUER_PRIX_SOUS_MARCHE',
      'CONFIRMER_TAXE_FONCIERE',
      'RISQUE_NATUREL',
      'SANS_ASCENSEUR_ETAGE_ELEVE',
      'EFFORT_HCSF_DEPASSE',
      'DUREE_PRET_HORS_HCSF',
      'PLAFOND_MICRO_DEPASSE',
      'LOYER_AU_DESSUS_PLAFOND',
      'PS_BIC_A_CONFIRMER',
    ] as const;
    for (const code of codes) {
      expect(ORDRE_CATEGORIES).toContain(categorieVigilance(code));
    }
    expect(categorieVigilance('PV_AG_ET_CARNET')).toBe('documents');
    expect(categorieVigilance('VERIFIER_DPE')).toBe('sur_place');
    expect(categorieVigilance('EFFORT_HCSF_DEPASSE')).toBe('finances');
    expect(Object.keys(CATEGORIES)).toHaveLength(3);
  });
});

describe('verdict', () => {
  it('prix bon + cash-flow négatif (exemple)', () => {
    const t = texteVerdict(calculerProjet(projetExemple));
    expect(t.titre).toBe('Le prix est bon. Le loyer ne couvre pas tout.');
    expect(n(t.sousTitre)).toContain('−25 % par rapport au prix estimé');
    expect(n(t.sousTitre)).toContain('le crédit prend 84 % du loyer');
    expect(n(t.sousTitre)).toContain('210 € à sortir chaque mois');
  });

  it('prix dans le marché, cash-flow positif', () => {
    const r = calculerProjet(
      variante({
        achat: { ...projetExemple.hypotheses.achat, prix: 198_000 },
        location: { mode: 'meuble_lld', loyerHc: 1_600, vacanceSemaines: 0 },
      }),
    );
    const t = texteVerdict(r);
    expect(t.titre).toBe('Le prix est dans le marché. Le loyer couvre tout.');
    expect(t.sousTitre).toContain('dans la poche');
  });

  it('prix élevé, crédit qui dépasse le loyer', () => {
    const r = calculerProjet(
      variante({
        achat: { ...projetExemple.hypotheses.achat, prix: 240_000 },
        location: { mode: 'meuble_lld', loyerHc: 1_100, vacanceSemaines: 0 },
      }),
    );
    const t = texteVerdict(r);
    expect(t.titre.startsWith('Le prix est élevé.')).toBe(true);
    expect(n(t.sousTitre)).toMatch(/le crédit dépasse le loyer \(1\d\d %\)/);
  });

  it('sans marché ni loyer : phrases de repli, sans mention du crédit', () => {
    const r = calculerProjet(variante({ location: { mode: 'nu', loyerHc: 0 } }, { risques: [] }));
    const t = texteVerdict(r);
    expect(t.titre).toBe('Prix sans repère de marché. Le loyer ne couvre pas tout.');
    expect(t.sousTitre).not.toContain('crédit');
    expect(t.sousTitre).not.toContain('quartier');
  });

  it('cash-flow presque : entre −100 et 0', () => {
    const r = calculerProjet(
      variante({ location: { mode: 'meuble_lld', loyerHc: 1_120, vacanceSemaines: 0 } }),
    );
    expect(r.cashflow.mensuel).toBeGreaterThan(-100);
    expect(r.cashflow.mensuel).toBeLessThan(0);
    expect(texteVerdict(r).titre).toContain('Le loyer couvre presque tout.');
  });

  it('réponses courtes', () => {
    expect(reponseCourte('oui')).toBe('Oui.');
    expect(reponseCourte('presque')).toBe('Pas tout à fait.');
    expect(reponseCourte('non')).toBe('Non.');
  });
});
