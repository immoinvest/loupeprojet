import { describe, expect, it } from 'vitest';

import { calculerProjet, type Resultats } from '../../src/calculer-projet';
import { projetExemple } from '../../src/exemples/t3-marseille';
import type { ProjetEntree } from '../../src/schema';
import { contexteVisite } from '../../src/visite/contexte';
import {
  QUESTIONS_VISITE,
  VERSION_QUESTIONS_VISITE,
  questionsPourContexte,
  questionsPourProjet,
} from '../../src/visite/questions';
import { CATEGORIES_VISITE, type ContexteVisite, type QuestionPosee } from '../../src/visite/types';

/** Chemins que l'onglet Hypothèses sait écrire (descripteurs du web) : les questions à valeur n'en sortent pas. */
const CHEMINS_EDITABLES = [
  'bien.surface',
  'bien.annee',
  'bien.dpe',
  'bien.copro.lots',
  'hypotheses.achat.travaux',
  'hypotheses.location.loyerHc',
  'hypotheses.location.chargesLocataire',
  'hypotheses.charges.taxeFonciere',
  'hypotheses.charges.coproAnnuel',
];

/** Maison de 2015 louée nue, sans copropriété, sans risque, sans ventes réelles. */
const maisonRecente: ProjetEntree = {
  ...projetExemple,
  bien: { type: 'maison', surface: 110, pieces: 5, annee: 2015, dpe: 'B', departement: '44' },
  marche: {},
  hypotheses: {
    ...projetExemple.hypotheses,
    achat: { prix: 250_000 },
    location: { mode: 'nu', loyerHc: 900 },
    fiscalite: { tmi: 0.3, regime: 'nu_reel' },
  },
};

/** Appartement de 1930 en procédure, DPE G, rez-de-chaussée avec terrasse, courte durée, inondable, loyer encadré. */
const ancienCourteDuree: ProjetEntree = {
  ...projetExemple,
  bien: {
    ...projetExemple.bien,
    annee: 1930,
    dpe: 'G',
    etage: 0,
    ascenseur: true,
    exterieur: true,
    copro: { lots: 8, procedure: true },
  },
  marche: {
    dvf: { medianM2: 3_050, nombreVentes: 31 },
    plafondLoyerMensuel: 900,
    risques: [
      { type: 'inondation', niveau: 'fort' },
      { type: 'radon', niveau: 'faible' },
    ],
  },
  hypotheses: {
    ...projetExemple.hypotheses,
    location: {
      mode: 'courte_duree',
      loyerHc: 980,
      courteDuree: { nuitee: 80, tauxOccupation: 0.6 },
    },
    fiscalite: { tmi: 0.3, regime: 'micro_bic' },
  },
};

/** Le projet d'exemple vendu bien au-dessus des ventes comparables. */
const tropCher: ProjetEntree = {
  ...projetExemple,
  hypotheses: {
    ...projetExemple.hypotheses,
    achat: { ...projetExemple.hypotheses.achat, prix: 260_000 },
  },
};

function questions(entree: ProjetEntree): {
  resultats: Resultats;
  posees: readonly QuestionPosee[];
} {
  const resultats = calculerProjet(entree);
  return { resultats, posees: questionsPourProjet(resultats.projet, resultats) };
}

const ids = (posees: readonly QuestionPosee[]): string[] => posees.map((q) => q.id);
const jetons = (texte: string): string[] =>
  [...texte.matchAll(/\{(\w+)\}/g)].map((m) => String(m[1]));

describe('la base de questions', () => {
  it('est datée, entre 60 et 90 questions, aux identifiants uniques en majuscules', () => {
    expect(VERSION_QUESTIONS_VISITE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(QUESTIONS_VISITE.length).toBeGreaterThanOrEqual(60);
    expect(QUESTIONS_VISITE.length).toBeLessThanOrEqual(90);
    const tous = ids([...QUESTIONS_VISITE].map((q) => ({ ...q, parametres: {} })));
    expect(new Set(tous).size).toBe(tous.length);
    for (const id of tous) expect(id).toMatch(/^[A-Z][A-Z_]+$/);
  });

  it('a une catégorie connue, un texte et une source pour chaque question', () => {
    for (const q of QUESTIONS_VISITE) {
      expect(CATEGORIES_VISITE).toContain(q.categorie);
      expect(q.texte.length).toBeGreaterThan(20);
      expect(q.source.length).toBeGreaterThan(5);
      expect(q.texte).not.toContain('—');
    }
  });

  it('range les questions par catégorie, dans l’ordre des sept groupes', () => {
    const rangs = QUESTIONS_VISITE.map((q) => CATEGORIES_VISITE.indexOf(q.categorie));
    expect([...rangs].sort((a, b) => a - b)).toEqual(rangs);
    for (const categorie of CATEGORIES_VISITE) {
      expect(QUESTIONS_VISITE.some((q) => q.categorie === categorie)).toBe(true);
    }
  });

  it('ne cite, pour les questions à valeur, que des chemins que l’onglet Hypothèses sait écrire', () => {
    const valeurs = QUESTIONS_VISITE.filter((q) => q.valeur !== undefined);
    expect(valeurs.length).toBeGreaterThanOrEqual(8);
    for (const q of valeurs) expect(CHEMINS_EDITABLES).toContain(q.valeur?.chemin);
  });

  it('fournit un paramètre pour chaque jeton du texte, et rien que des nombres ou des textes', () => {
    const { resultats } = questions(projetExemple);
    const contexte = contexteVisite(resultats.projet, resultats.verdict.feux);
    for (const q of QUESTIONS_VISITE) {
      const parametres = q.parametres?.(contexte) ?? {};
      for (const jeton of jetons(q.texte)) expect(Object.keys(parametres)).toContain(jeton);
      for (const v of Object.values(parametres)) expect(['number', 'string']).toContain(typeof v);
    }
  });

  it('calcule chaque paramètre sans erreur même hors de sa condition', () => {
    const inconnus: ProjetEntree = {
      ...projetExemple,
      bien: { ...projetExemple.bien, annee: undefined, dpe: undefined, copro: {} },
    };
    const contextes: ContexteVisite[] = [
      projetExemple,
      maisonRecente,
      ancienCourteDuree,
      inconnus,
    ].map((entree) => {
      const { resultats } = questions(entree);
      return contexteVisite(resultats.projet, resultats.verdict.feux);
    });
    for (const q of QUESTIONS_VISITE) {
      for (const c of contextes) expect(() => q.parametres?.(c)).not.toThrow();
    }
  });
});

describe('questionsPourProjet — T3 Marseille (1962, copropriété, 3e sans ascenseur, DPE D, meublé)', () => {
  const { posees } = questions(projetExemple);
  const c = ids(posees);

  it('pose entre 40 et 60 questions, dans les sept groupes', () => {
    expect(posees.length).toBeGreaterThanOrEqual(40);
    expect(posees.length).toBeLessThanOrEqual(60);
    expect(new Set(posees.map((q) => q.categorie)).size).toBe(7);
  });

  it('pose ce qui découle du bien et retient le reste', () => {
    expect(c).toEqual(
      expect.arrayContaining([
        'DOC_PV_AG',
        'DOC_CHARGES_COPRO',
        'DOC_REGLEMENT_COPRO',
        'DIAG_AMIANTE',
        'DIAG_ELECTRICITE_GAZ',
        'TRAVAUX_VOTES',
        'TRAVAUX_CHIFFRAGE',
        'TRAVAUX_AUTORISATIONS',
        'LOG_DPE_COHERENCE',
        'LOG_ETAGE_SANS_ASCENSEUR',
        'LOG_MEUBLE_INVENTAIRE',
        'IMM_PARTIES_COMMUNES',
        'IMM_SYNDIC',
        'QUA_RISQUES',
        'VEN_PRIX_SOUS_MARCHE',
        'VEN_HONORAIRES',
        'EXP_CHARGES_RECUPERABLES',
      ]),
    );
    for (const absent of [
      'DIAG_PLOMB',
      'DIAG_MERULE',
      'DOC_AUDIT_ENERGETIQUE',
      'DOC_ASSAINISSEMENT',
      'TRAVAUX_RENOVATION_ENERGETIQUE',
      'TRAVAUX_DIVISION_COLOCATION',
      'LOG_DPE_INCONNU',
      'LOG_REZ_DE_CHAUSSEE',
      'LOG_EXTERIEUR',
      'IMM_ASCENSEUR',
      'IMM_ANNEE_CONSTRUCTION',
      'IMM_LOTS',
      'IMM_COPRO_PROCEDURE',
      'IMM_MAISON_TERRAIN',
      'VEN_PRIX_AU_DESSUS',
      'EXP_ENCADREMENT_LOYERS',
      'EXP_COURTE_DUREE_AUTORISATION',
      'EXP_COLOCATION_CHAMBRES',
      'EXP_MOYENNE_DUREE',
    ]) {
      expect(c).not.toContain(absent);
    }
  });

  it('porte les paramètres attendus par l’interface', () => {
    const par = (id: string): QuestionPosee['parametres'] =>
      posees.find((q) => q.id === id)?.parametres ?? {};
    expect(par('DOC_PV_AG')).toEqual({ detail: ' (24 lots, immeuble de 1962)' });
    expect(par('DIAG_AMIANTE')).toEqual({ annee: 1962 });
    expect(par('LOG_DPE_COHERENCE')).toEqual({ dpe: 'D' });
    expect(par('LOG_ETAGE_SANS_ASCENSEUR')).toEqual({ etage: 3 });
    expect(par('LOG_SURFACE')).toEqual({ surface: 65 });
    expect(par('TRAVAUX_CHIFFRAGE')).toEqual({ travaux: 6_000 });
    expect(par('QUA_RISQUES')).toEqual({ risques: 'argiles' });
    expect(par('VEN_HONORAIRES')).toEqual({ honoraires: 7_000 });
    expect(Number(par('VEN_PRIX_SOUS_MARCHE').ecart)).toBeLessThan(-0.05);
    expect(par('LOG_ETAT_GENERAL')).toEqual({});
  });

  it('transmet la valeur à écrire et son type', () => {
    const charges = posees.find((q) => q.id === 'DOC_CHARGES_COPRO');
    expect(charges?.valeur).toEqual({ chemin: 'hypotheses.charges.coproAnnuel', type: 'euros' });
    expect(posees.find((q) => q.id === 'LOG_DPE_COHERENCE')?.valeur).toEqual({
      chemin: 'bien.dpe',
      type: 'enum',
    });
    expect(posees.find((q) => q.id === 'LOG_ETAT_GENERAL')).not.toHaveProperty('valeur');
  });

  it('est pure : deux appels donnent la même liste', () => {
    const { resultats } = questions(projetExemple);
    expect(questionsPourProjet(resultats.projet, resultats)).toEqual(posees);
  });
});

describe('questionsPourProjet — maison de 2015 louée nue', () => {
  const { posees } = questions(maisonRecente);
  const c = ids(posees);

  it('pose entre 25 et 40 questions, sans copropriété, sans diagnostics anciens, sans meublé', () => {
    expect(posees.length).toBeGreaterThanOrEqual(25);
    expect(posees.length).toBeLessThanOrEqual(40);
    for (const absent of [
      'DOC_CHARGES_COPRO',
      'DOC_PV_AG',
      'DIAG_AMIANTE',
      'DIAG_PLOMB',
      'DIAG_ELECTRICITE_GAZ',
      'TRAVAUX_VOTES',
      'TRAVAUX_CHIFFRAGE',
      'LOG_ETAGE_SANS_ASCENSEUR',
      'LOG_MEUBLE_INVENTAIRE',
      'IMM_PARTIES_COMMUNES',
      'IMM_SYNDIC',
      'QUA_RISQUES',
      'VEN_PRIX_SOUS_MARCHE',
      'VEN_PRIX_AU_DESSUS',
      'VEN_HONORAIRES',
      'EXP_CHARGES_RECUPERABLES',
      'EXP_COURTE_DUREE_AUTORISATION',
    ]) {
      expect(c).not.toContain(absent);
    }
    expect(c).toEqual(
      expect.arrayContaining([
        'DOC_ASSAINISSEMENT',
        'DIAG_TERMITES',
        'DIAG_MERULE',
        'IMM_MAISON_TERRAIN',
        'LOG_DPE_COHERENCE',
        'EXP_PERMIS_DE_LOUER',
      ]),
    );
  });
});

describe('questionsPourProjet — 1930 en procédure, DPE G, rez-de-chaussée, courte durée, inondable', () => {
  const { posees } = questions(ancienCourteDuree);
  const c = ids(posees);

  it('pose amiante, plomb, procédure, rénovation, rez-de-chaussée, terrasse, courte durée, encadrement, inondation', () => {
    expect(c).toEqual(
      expect.arrayContaining([
        'DIAG_AMIANTE',
        'DIAG_PLOMB',
        'IMM_COPRO_PROCEDURE',
        'TRAVAUX_RENOVATION_ENERGETIQUE',
        'LOG_REZ_DE_CHAUSSEE',
        'LOG_EXTERIEUR',
        'IMM_ASCENSEUR',
        'EXP_COURTE_DUREE_AUTORISATION',
        'EXP_COURTE_DUREE_COPRO',
        'EXP_COURTE_DUREE_TAXES',
        'EXP_ENCADREMENT_LOYERS',
        'QUA_RISQUES',
        'LOG_MEUBLE_INVENTAIRE',
      ]),
    );
    expect(c).not.toContain('IMM_ANNEE_CONSTRUCTION');
    expect(c).not.toContain('LOG_DPE_INCONNU');
    expect(c).not.toContain('LOG_ETAGE_SANS_ASCENSEUR');
    expect(c).not.toContain('DOC_AUDIT_ENERGETIQUE');
    const reno = posees.find((q) => q.id === 'TRAVAUX_RENOVATION_ENERGETIQUE');
    expect(reno?.parametres).toEqual({ dpe: 'G', annee: 2025 });
    expect(posees.find((q) => q.id === 'QUA_RISQUES')?.parametres).toEqual({
      risques: 'inondation',
    });
    expect(posees.find((q) => q.id === 'EXP_ENCADREMENT_LOYERS')?.parametres).toEqual({
      plafond: 900,
    });
  });
});

describe('questionsPourProjet — variantes', () => {
  it('prix au-dessus du marché : la question au vendeur change de sens', () => {
    const { posees } = questions(tropCher);
    const c = ids(posees);
    expect(c).toContain('VEN_PRIX_AU_DESSUS');
    expect(c).not.toContain('VEN_PRIX_SOUS_MARCHE');
    expect(
      Number(posees.find((q) => q.id === 'VEN_PRIX_AU_DESSUS')?.parametres.ecart),
    ).toBeGreaterThan(0.05);
  });

  it('année, DPE et lots inconnus : les questions à valeur qui les demandent apparaissent', () => {
    const { posees } = questions({
      ...projetExemple,
      bien: { ...projetExemple.bien, annee: undefined, dpe: undefined, copro: {} },
    });
    const c = ids(posees);
    expect(c).toEqual(
      expect.arrayContaining(['IMM_ANNEE_CONSTRUCTION', 'LOG_DPE_INCONNU', 'IMM_LOTS']),
    );
    expect(c).not.toContain('DIAG_AMIANTE');
    expect(c).not.toContain('LOG_DPE_COHERENCE');
    expect(c).toContain('DIAG_ELECTRICITE_GAZ');
    expect(posees.find((q) => q.id === 'IMM_ANNEE_CONSTRUCTION')?.parametres).toEqual({
      amiante: 1997,
      plomb: 1949,
    });
    expect(posees.find((q) => q.id === 'DOC_PV_AG')?.parametres).toEqual({ detail: '' });
    const lotsSeuls = questions({
      ...projetExemple,
      bien: { ...projetExemple.bien, annee: undefined, copro: { lots: 12 } },
    });
    expect(lotsSeuls.posees.find((q) => q.id === 'DOC_PV_AG')?.parametres).toEqual({
      detail: ' (12 lots)',
    });
  });

  it('colocation et moyenne durée (fiche 05) : conditions prêtes, testées par un contexte forgé', () => {
    const { resultats } = questions(projetExemple);
    const base = contexteVisite(resultats.projet, resultats.verdict.feux);
    const coloc = ids(questionsPourContexte({ ...base, exploitation: 'colocation' }));
    expect(coloc).toEqual(
      expect.arrayContaining([
        'TRAVAUX_DIVISION_COLOCATION',
        'EXP_COLOCATION_CHAMBRES',
        'EXP_COLOCATION_COMMUNS',
        'LOG_MEUBLE_INVENTAIRE',
      ]),
    );
    expect(coloc).not.toContain('EXP_MOYENNE_DUREE');
    const posees = questionsPourContexte({ ...base, exploitation: 'colocation' });
    expect(posees.find((q) => q.id === 'EXP_COLOCATION_CHAMBRES')?.parametres).toEqual({
      chambreM2: 9,
    });
    expect(posees.find((q) => q.id === 'EXP_COLOCATION_COMMUNS')?.parametres).toEqual({
      chambres: 2,
    });
    const moyenne = ids(questionsPourContexte({ ...base, exploitation: 'moyenne_duree' }));
    expect(moyenne).toContain('EXP_MOYENNE_DUREE');
    expect(moyenne).not.toContain('EXP_COLOCATION_CHAMBRES');
    const nue = ids(questionsPourContexte({ ...base, exploitation: 'nue' }));
    expect(nue).not.toContain('LOG_MEUBLE_INVENTAIRE');
  });
});
