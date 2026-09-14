import {
  QUESTIONS_VISITE,
  calculerProjet,
  projetExemple,
  questionsPourProjet,
} from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import { LONGUEUR_MAX_NOTE, VisiteSchema, type Visite } from '@/stockage/projets';
import {
  REPONSE_PAR_DEFAUT,
  VISITE_VIDE,
  aDesReponses,
  descripteurDeValeur,
  grouperParCategorie,
  marquerFaite,
  noter,
  progression,
  reponseDe,
  repondre,
  rouvrir,
  visiteDe,
} from '@/visite';

const r = calculerProjet(projetExemple);
const questions = questionsPourProjet(r.projet, r);

describe('visiteDe / reponseDe', () => {
  it('rend une visite vide et une réponse « à vérifier » quand rien n’est enregistré', () => {
    expect(visiteDe({})).toBe(VISITE_VIDE);
    expect(visiteDe({ visite: undefined })).toEqual({ faite: false, reponses: {} });
    const v: Visite = { faite: true, date: '2026-09-14', reponses: { A: { etat: 'ok' } } };
    expect(visiteDe({ visite: v })).toBe(v);
    expect(reponseDe(v, 'A')).toEqual({ etat: 'ok' });
    expect(reponseDe(v, 'B')).toBe(REPONSE_PAR_DEFAUT);
  });
});

describe('repondre / noter', () => {
  it('enregistre un état, garde la note, et retire une réponse revenue par défaut', () => {
    let v = repondre(VISITE_VIDE, 'DOC_TAXE_FONCIERE', 'probleme');
    expect(v.reponses).toEqual({ DOC_TAXE_FONCIERE: { etat: 'probleme' } });
    v = noter(v, 'DOC_TAXE_FONCIERE', '  avis 2025 : 1 320 €  ');
    expect(v.reponses.DOC_TAXE_FONCIERE).toEqual({ etat: 'probleme', note: 'avis 2025 : 1 320 €' });
    v = repondre(v, 'DOC_TAXE_FONCIERE', 'ok');
    expect(v.reponses.DOC_TAXE_FONCIERE).toEqual({ etat: 'ok', note: 'avis 2025 : 1 320 €' });
    v = repondre(v, 'DOC_TAXE_FONCIERE', 'a_verifier');
    expect(v.reponses.DOC_TAXE_FONCIERE).toEqual({
      etat: 'a_verifier',
      note: 'avis 2025 : 1 320 €',
    });
    v = noter(v, 'DOC_TAXE_FONCIERE', '');
    expect(v.reponses).toEqual({});
    expect(VISITE_VIDE.reponses).toEqual({});
  });

  it('ne touche pas aux autres réponses ni à l’état de la visite', () => {
    const v: Visite = {
      faite: true,
      date: '2026-09-14',
      reponses: { A: { etat: 'ok' }, B: { etat: 'sans_objet', note: 'n' } },
    };
    const suivant = repondre(v, 'A', 'probleme');
    expect(suivant).toEqual({
      faite: true,
      date: '2026-09-14',
      reponses: { A: { etat: 'probleme' }, B: { etat: 'sans_objet', note: 'n' } },
    });
    expect(v.reponses.A).toEqual({ etat: 'ok' });
    expect(noter(v, 'C', 'nouvelle').reponses.C).toEqual({ etat: 'a_verifier', note: 'nouvelle' });
  });

  it('borne la note à la longueur maximale, acceptée par le schéma', () => {
    const longue = 'x'.repeat(LONGUEUR_MAX_NOTE + 50);
    const v = noter(VISITE_VIDE, 'A', longue);
    expect(v.reponses.A?.note).toHaveLength(LONGUEUR_MAX_NOTE);
    expect(VisiteSchema.safeParse(v).success).toBe(true);
    expect(
      VisiteSchema.safeParse({ faite: false, reponses: { A: { etat: 'ok', note: longue } } })
        .success,
    ).toBe(false);
    expect(
      VisiteSchema.safeParse({ faite: false, reponses: { A: { etat: 'peut-etre' } } }).success,
    ).toBe(false);
    expect(VisiteSchema.parse({ faite: false })).toEqual({ faite: false, reponses: {} });
  });
});

describe('marquerFaite / rouvrir', () => {
  it('garde les réponses dans les deux sens', () => {
    const v = repondre(VISITE_VIDE, 'A', 'ok');
    const faite = marquerFaite(v, '2026-09-14T10:00:00.000Z');
    expect(faite).toEqual({
      faite: true,
      date: '2026-09-14T10:00:00.000Z',
      reponses: { A: { etat: 'ok' } },
    });
    expect(rouvrir(faite)).toEqual({ faite: false, reponses: { A: { etat: 'ok' } } });
    expect(rouvrir(faite)).not.toHaveProperty('date');
  });
});

describe('progression / aDesReponses', () => {
  it('compte les répondues et les problèmes sur les questions posées, sans les orphelines', () => {
    let v = VISITE_VIDE;
    expect(progression(questions, v)).toEqual({
      total: questions.length,
      repondues: 0,
      problemes: 0,
    });
    expect(aDesReponses(v)).toBe(false);
    const [q1, q2, q3, q4] = questions;
    v = repondre(v, q1?.id ?? '', 'ok');
    v = repondre(v, q2?.id ?? '', 'probleme');
    v = repondre(v, q3?.id ?? '', 'sans_objet');
    v = noter(v, q4?.id ?? '', 'juste une note');
    v = repondre(v, 'ORPHELINE', 'probleme');
    expect(progression(questions, v)).toEqual({
      total: questions.length,
      repondues: 3,
      problemes: 1,
    });
    expect(aDesReponses(v)).toBe(true);
    expect(progression([], v)).toEqual({ total: 0, repondues: 0, problemes: 0 });
  });
});

describe('grouperParCategorie', () => {
  it('suit l’ordre des sept groupes et retire les groupes vides', () => {
    const groupes = grouperParCategorie(questions);
    expect(groupes.map((g) => g.categorie)).toEqual([
      'documents',
      'diagnostics',
      'logement',
      'immeuble',
      'quartier',
      'vendeur',
      'exploitation',
    ]);
    expect(groupes.reduce((n, g) => n + g.questions.length, 0)).toBe(questions.length);
    const sansDocuments = questions.filter((q) => q.categorie !== 'documents');
    expect(grouperParCategorie(sansDocuments)[0]?.categorie).toBe('diagnostics');
    expect(grouperParCategorie([])).toEqual([]);
  });
});

describe('descripteurDeValeur', () => {
  it('retrouve, pour chaque question à valeur de la base, un descripteur du même type', () => {
    const posees = QUESTIONS_VISITE.map((q) => ({ ...q, parametres: {} }));
    let comptees = 0;
    for (const q of posees) {
      const d = descripteurDeValeur(q);
      if (q.valeur === undefined) {
        expect(d).toBeNull();
      } else {
        comptees += 1;
        expect(d?.chemin).toBe(q.valeur.chemin);
        expect(d?.type).toBe(q.valeur.type);
      }
    }
    expect(comptees).toBeGreaterThanOrEqual(8);
  });
});
