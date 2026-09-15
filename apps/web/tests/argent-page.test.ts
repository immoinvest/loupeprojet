import type { BienGere, Depense, EtatArgent, PretEnregistre } from '@loupe/gestion';
import { calculerFinancement, obtenirRegles, projetExemple, ProjetSchema } from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import {
  anneesProposees,
  bienDuFiltre,
  bilanDeLaVue,
  categoriesDuBilan,
  courbeDeLaVue,
  donneesArgent,
  moisProposes,
  pretsAEnregistrer,
  vueDepuisRecherche,
  type Vue,
} from '@/gestion/argent/page';
import { pretDepuisAnalyse } from '@/gestion/argent/pret-analyse';

import { BIEN_BAILLE, BIEN_LICES, ETAT_SEPTEMBRE, HORODATAGE } from './gestion-exemples';

const TAXE: Depense = {
  id: 'taxe',
  bienId: 'bien-lices',
  categorie: 'taxe_fonciere',
  montant: 84_000,
  date: '2026-09-10',
  recuperable: false,
  creeLe: HORODATAGE,
  modifieLe: HORODATAGE,
};

const ASSURANCE: Depense = {
  ...TAXE,
  id: 'assurance',
  categorie: 'assurance',
  montant: 1_200,
  date: '2026-01-05',
  recurrence: { frequence: 'mensuelle' },
};

const PRET: PretEnregistre = {
  bienId: 'bien-lices',
  capital: 1_200_000,
  tauxAnnuel: 0.12,
  dureeMois: 12,
  debut: '2026-09',
  assuranceMensuelle: 500,
  modifieLe: HORODATAGE,
};

const ARGENT: EtatArgent = { depenses: [TAXE, ASSURANCE], prets: [PRET] };

/** Le T2 Lices acheté depuis le projet d'exemple le 1er septembre 2026. */
const ACHETE: BienGere = { ...BIEN_LICES, projetId: 'p1', projet: { ...projetExemple } };

describe('vue et filtre de la page Argent', () => {
  it('?mois=, ?annee=, sinon le mois en cours ; une valeur fausse est ignorée', () => {
    const vue = (texte: string): Vue =>
      vueDepuisRecherche(new URLSearchParams(texte), '2026-09-14');
    expect(vue('')).toEqual({ type: 'mois', periode: '2026-09' });
    expect(vue('mois=2026-03')).toEqual({ type: 'mois', periode: '2026-03' });
    expect(vue('mois=2026-13')).toEqual({ type: 'mois', periode: '2026-09' });
    expect(vue('annee=2025&mois=2026-03')).toEqual({ type: 'annee', annee: 2025 });
    expect(vue('annee=deux-mille')).toEqual({ type: 'mois', periode: '2026-09' });
  });

  it('?bien= seulement s’il existe ; mois et années proposés, les plus récents d’abord', () => {
    const biens = ETAT_SEPTEMBRE.biens;
    expect(bienDuFiltre(new URLSearchParams('bien=bien-baille'), biens)).toBe('bien-baille');
    expect(bienDuFiltre(new URLSearchParams('bien=supprime'), biens)).toBeUndefined();
    expect(bienDuFiltre(new URLSearchParams(''), biens)).toBeUndefined();
    const mois = moisProposes('2026-09-14');
    expect(mois).toHaveLength(24);
    expect([mois[0], mois[23]]).toEqual(['2026-09', '2024-10']);
    expect(anneesProposees('2026-09-14')).toEqual([2026, 2025, 2024, 2023, 2022]);
  });
});

describe('bilans de la page', () => {
  const donnees = donneesArgent(ETAT_SEPTEMBRE, ARGENT);

  it('septembre 2026 : encaissé, dépenses, mensualités ; filtre par bien', () => {
    const bilan = bilanDeLaVue(donnees, { type: 'mois', periode: '2026-09' });
    expect(bilan).toMatchObject({ loyers: 70_000, depenses: 85_200, mensualites: 107_119 });
    expect(
      bilanDeLaVue(donnees, { type: 'mois', periode: '2026-09' }, 'bien-baille'),
    ).toMatchObject({
      loyers: 0,
      depenses: 0,
    });
    expect(categoriesDuBilan(bilan)).toEqual([
      { categorie: 'taxe_fonciere', montant: 84_000 },
      { categorie: 'assurance', montant: 1_200 },
    ]);
  });

  it('année 2026 et sa courbe (janvier à décembre) ; courbe d’un mois (les 12 mois jusqu’à lui)', () => {
    const annee = bilanDeLaVue(donnees, { type: 'annee', annee: 2026 });
    expect(annee.depensesParCategorie.assurance).toBe(14_400);
    const courbe = courbeDeLaVue(donnees, { type: 'annee', annee: 2026 });
    expect([courbe[0]?.periode, courbe[11]?.periode]).toEqual(['2026-01', '2026-12']);
    const duMois = courbeDeLaVue(donnees, { type: 'mois', periode: '2026-09' }, 'bien-lices');
    expect([duMois[0]?.periode, duMois[11]?.periode]).toEqual(['2025-10', '2026-09']);
  });
});

describe('prêt proposé par l’analyse', () => {
  it('le prêt du projet d’exemple, calculé par le moteur, première échéance le mois qui suit l’achat', () => {
    const projet = ProjetSchema.parse(projetExemple);
    const financement = calculerFinancement(projet, obtenirRegles(projet.versionRegles), {
      avecTaeg: false,
    });
    expect(financement.montantEmprunte).toBeGreaterThan(0);
    expect(pretDepuisAnalyse(ACHETE)).toEqual({
      capital: Math.round(financement.montantEmprunte * 100),
      tauxAnnuel: projet.hypotheses.pret.tauxNominal,
      dureeMois: projet.hypotheses.pret.dureeAnnees * 12,
      debut: '2026-10',
      assuranceMensuelle: Math.round(financement.assuranceMensuelle * 100),
    });
  });

  it('rien sans instantané, avec un instantané illisible, ou sans emprunt', () => {
    expect(pretDepuisAnalyse(BIEN_LICES)).toBeNull();
    expect(pretDepuisAnalyse({ ...BIEN_LICES, projet: { nom: 'abîmé' } })).toBeNull();
    const sansEmprunt = {
      ...projetExemple,
      hypotheses: {
        ...projetExemple.hypotheses,
        pret: { ...projetExemple.hypotheses.pret, apport: 10_000_000 },
      },
    };
    expect(pretDepuisAnalyse({ ...BIEN_LICES, projet: sansEmprunt })).toBeNull();
  });

  it('« À faire » : les biens achetés avec emprunt sans prêt enregistré, par nom', () => {
    const autre: BienGere = { ...ACHETE, id: 'bien-aaa', nom: 'Appartement Rouet' };
    expect(
      pretsAEnregistrer([ACHETE, BIEN_BAILLE, autre], { depenses: [], prets: [] }).map(
        (p) => p.bien.id,
      ),
    ).toEqual(['bien-aaa', 'bien-lices']);
    expect(pretsAEnregistrer([ACHETE], ARGENT)).toEqual([]);
  });
});
