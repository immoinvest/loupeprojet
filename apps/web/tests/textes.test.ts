import {
  calculerProjet,
  projetExemple,
  type PointVigilance,
  type ProjetEntree,
} from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import { AXES, ETATS, libelleFeu } from '@/textes/feux';
import {
  CRITERES_PRIX,
  MODES,
  ORDRE_REGIMES,
  REGIMES,
  SCENARIOS,
  explicationRegime,
} from '@/textes/regimes';
import { reponseCourte, texteVerdict } from '@/textes/verdict';
import { phraseVigilance } from '@/textes/vigilance';
import {
  CATEGORIES_VISITE,
  ETATS_REPONSE,
  ORDRE_ETATS,
  phraseProgression,
  phraseVisite,
  texteQuestion,
} from '@/textes/visite';

const n = (s: string): string => s.replace(/\s/g, ' ');

const variante = (
  h: Partial<ProjetEntree['hypotheses']>,
  marche?: ProjetEntree['marche'],
): ProjetEntree => ({
  ...projetExemple,
  ...(marche === undefined ? {} : { marche }),
  hypotheses: { ...projetExemple.hypotheses, ...h },
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
    expect(n(libelleFeu({ axe: 'effort', feu: 'bon', valeur: 0.2516 }))).toBe('Effort 25 %');
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

  it('a une phrase pour chaque code financier', () => {
    const codes: PointVigilance['code'][] = [
      'EFFORT_HCSF_DEPASSE',
      'DUREE_PRET_HORS_HCSF',
      'PLAFOND_MICRO_DEPASSE',
      'LOYER_AU_DESSUS_PLAFOND',
      'PS_BIC_A_CONFIRMER',
    ];
    const parametres = { seuil: 0.35, dureeMax: 25, plafond: 900, taux: 0.186 };
    for (const code of codes) {
      expect(phraseVigilance(p(code, parametres)).length).toBeGreaterThan(10);
    }
  });

  it('insère les paramètres', () => {
    expect(n(phraseVigilance(p('LOYER_AU_DESSUS_PLAFOND', { plafond: 900 })))).toContain('900 €');
    expect(phraseVigilance(p('DUREE_PRET_HORS_HCSF', { dureeMax: 25 }))).toContain('25 ans');
    expect(n(phraseVigilance(p('PS_BIC_A_CONFIRMER', { taux: 0.186 })))).toContain('18,6 %');
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

describe('textes de la visite', () => {
  it('nomme les sept catégories et les quatre états', () => {
    expect(Object.keys(CATEGORIES_VISITE)).toHaveLength(7);
    expect(CATEGORIES_VISITE.documents).toBe('Documents à demander');
    expect(Object.keys(ETATS_REPONSE)).toHaveLength(4);
    expect(ORDRE_ETATS).toEqual(['a_verifier', 'ok', 'probleme', 'sans_objet']);
    expect(ORDRE_ETATS.map((e) => ETATS_REPONSE[e])).toEqual([
      'À vérifier',
      'OK',
      'Problème',
      'Sans objet',
    ]);
  });

  it('met en forme les paramètres du moteur dans le texte de la question', () => {
    const t = (texte: string, parametres: Record<string, number | string>): string =>
      n(texteQuestion({ texte, parametres }));
    expect(t('Le prix est {ecart} sous', { ecart: -0.224 })).toBe('Le prix est 22 % sous');
    expect(t('Le prix est {ecart} au-dessus', { ecart: 0.08 })).toBe('Le prix est 8 % au-dessus');
    expect(t('Honoraires ({honoraires})', { honoraires: 7_000 })).toBe('Honoraires (7 000 €)');
    expect(t('Travaux ({travaux}), plafond {plafond}', { travaux: 6_000, plafond: 900 })).toBe(
      'Travaux (6 000 €), plafond 900 €',
    );
    expect(t('Zone ({risques})', { risques: 'inondation,retraitGonflementArgile' })).toBe(
      'Zone (inondation, retrait-gonflement des argiles)',
    );
    expect(t('{surface} m²', { surface: 65 })).toBe('65 m²');
    expect(t('{surface} m²', { surface: 32.5 })).toBe('32,5 m²');
    expect(
      t('DPE {dpe}, {etage}e, {annee}{detail}', { dpe: 'D', etage: 3, annee: 1962, detail: '' }),
    ).toBe('DPE D, 3e, 1962');
    expect(t('carnet{detail}', { detail: ' (24 lots)' })).toBe('carnet (24 lots)');
    expect(t('sans {inconnu} paramètre', {})).toBe('sans {inconnu} paramètre');
  });

  it('phrase la progression et le lien du rapport', () => {
    expect(phraseProgression({ total: 48, repondues: 0, problemes: 0 })).toBe('0 sur 48 répondues');
    expect(phraseProgression({ total: 48, repondues: 1, problemes: 1 })).toBe(
      '1 sur 48 répondue, 1 problème',
    );
    expect(phraseProgression({ total: 48, repondues: 12, problemes: 2 })).toBe(
      '12 sur 48 répondues, 2 problèmes',
    );
    const compte = { total: 48, repondues: 12, problemes: 2 };
    expect(phraseVisite({ faite: false }, compte)).toBe('Préparer la visite : 48 questions');
    expect(phraseVisite({ faite: false }, { ...compte, total: 1 })).toBe(
      'Préparer la visite : 1 question',
    );
    expect(phraseVisite({ faite: true, date: '2026-09-14T10:00:00.000Z' }, compte)).toBe(
      'Visite faite le 14 sept. 2026 · 2 problèmes',
    );
    expect(phraseVisite({ faite: true }, { ...compte, problemes: 1 })).toBe(
      'Visite faite · 1 problème',
    );
    expect(phraseVisite({ faite: true }, { ...compte, problemes: 0 })).toBe(
      'Visite faite · aucun problème relevé',
    );
  });
});

describe('verdict', () => {
  it('prix bon + cash-flow négatif (exemple)', () => {
    const t = texteVerdict(calculerProjet(projetExemple));
    expect(t.titre).toBe('Le prix est bon. Le loyer ne couvre pas tout.');
    expect(n(t.sousTitre)).toContain('−25 % par rapport au prix estimé');
    expect(n(t.sousTitre)).toContain("banque d'accord (effort 25 %)");
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

  it('prix élevé, effort au-dessus du seuil', () => {
    const r = calculerProjet(
      variante({
        achat: { ...projetExemple.hypotheses.achat, prix: 240_000 },
        location: { mode: 'meuble_lld', loyerHc: 1_500, vacanceSemaines: 0 },
        revenusMensuels: 1_500,
      }),
    );
    const t = texteVerdict(r);
    expect(t.titre.startsWith('Le prix est élevé.')).toBe(true);
    expect(t.sousTitre).toContain('au-dessus du seuil');
  });

  it('sans marché ni revenus : phrases de repli', () => {
    const r = calculerProjet(
      variante({ location: { mode: 'nu', loyerHc: 0 }, revenusMensuels: 0 }, { risques: [] }),
    );
    const t = texteVerdict(r);
    expect(t.titre).toBe('Prix sans repère de marché. Le loyer ne couvre pas tout.');
    expect(t.sousTitre).not.toContain('effort');
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
