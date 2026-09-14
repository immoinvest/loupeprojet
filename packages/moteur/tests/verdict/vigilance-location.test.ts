import { describe, expect, it } from 'vitest';

import { projetExemple } from '../../src/exemples/t3-marseille';
import { calculerFinancement } from '../../src/financement';
import { calculerFiscalite } from '../../src/fiscalite';
import { obtenirRegles } from '../../src/regles';
import { calculerRendement } from '../../src/rendement';
import { calculerRevente } from '../../src/revente';
import { ProjetSchema, type ProjetEntree } from '../../src/schema';
import { calculerVerdict, type PointVigilance } from '../../src/verdict';

const regles = obtenirRegles('2026-09');

function vigilanceDe(entree: ProjetEntree): readonly PointVigilance[] {
  const projet = ProjetSchema.parse(entree);
  const financement = calculerFinancement(projet, regles);
  const fiscalite = calculerFiscalite(projet, financement, regles);
  const revente = calculerRevente(projet, financement, fiscalite, regles);
  const rendement = calculerRendement(projet, financement, fiscalite, revente);
  return calculerVerdict(projet, financement, fiscalite, rendement, regles).vigilance;
}

const projetAvec = (
  location: ProjetEntree['hypotheses']['location'],
  bien: Partial<ProjetEntree['bien']> = {},
  marche: ProjetEntree['marche'] = projetExemple.marche,
): ProjetEntree => ({
  ...projetExemple,
  bien: { ...projetExemple.bien, ...bien },
  marche,
  hypotheses: { ...projetExemple.hypotheses, location },
});

const codes = (points: readonly PointVigilance[]): string[] => points.map((p) => p.code);
const point = (points: readonly PointVigilance[], code: string): PointVigilance | undefined =>
  points.find((p) => p.code === code);

const courteDuree: ProjetEntree['hypotheses']['location'] = {
  mode: 'courte_duree',
  nuitee: 80,
  nuiteesParMois: 15,
};

describe('vigilance — courte durée', () => {
  it('signale le changement d’usage, à vérifier en mairie hors Paris et petite couronne', () => {
    const points = vigilanceDe(projetAvec(courteDuree));
    expect(point(points, 'CHANGEMENT_USAGE_COURTE_DUREE')?.parametres).toEqual({
      zone: 'a_verifier',
      joursResidencePrincipale: 120,
    });
  });

  it('de plein droit à Paris et dans les Hauts-de-Seine, la Seine-Saint-Denis et le Val-de-Marne', () => {
    for (const departement of ['75', '92', '93', '94']) {
      const points = vigilanceDe(projetAvec(courteDuree, { departement }));
      expect(point(points, 'CHANGEMENT_USAGE_COURTE_DUREE')?.parametres.zone).toBe('plein_droit');
    }
  });

  it('DPE E, F ou G : classe minimale des meublés de tourisme ; D et mieux : rien', () => {
    const e = vigilanceDe(projetAvec(courteDuree, { dpe: 'E' }));
    expect(point(e, 'DPE_MEUBLE_TOURISME')?.parametres).toEqual({
      dpe: 'E',
      classeMinimale: 'E',
      classeTous: 'D',
      annee: 2034,
    });
    expect(codes(vigilanceDe(projetAvec(courteDuree, { dpe: 'G' })))).toContain(
      'DPE_MEUBLE_TOURISME',
    );
    expect(codes(vigilanceDe(projetAvec(courteDuree, { dpe: 'D' })))).not.toContain(
      'DPE_MEUBLE_TOURISME',
    );
    const sansDpe = { ...projetExemple.bien, dpe: undefined };
    expect(codes(vigilanceDe(projetAvec(courteDuree, sansDpe)))).not.toContain(
      'DPE_MEUBLE_TOURISME',
    );
  });

  it('en copropriété, le règlement peut interdire la location touristique ; pas en maison', () => {
    expect(
      point(vigilanceDe(projetAvec(courteDuree)), 'REGLEMENT_COPRO_LOCATION')?.parametres,
    ).toEqual({ mode: 'courte_duree' });
    const maison = { ...projetExemple.bien, type: 'maison' as const, copro: undefined };
    expect(codes(vigilanceDe(projetAvec(courteDuree, maison)))).not.toContain(
      'REGLEMENT_COPRO_LOCATION',
    );
  });

  it('ne compare jamais une nuitée au plafond d’encadrement des loyers', () => {
    const marche = { ...projetExemple.marche, plafondLoyerMensuel: 500 };
    expect(codes(vigilanceDe(projetAvec(courteDuree, {}, marche)))).not.toContain(
      'LOYER_AU_DESSUS_PLAFOND',
    );
  });
});

describe('vigilance — colocation', () => {
  const coloc: ProjetEntree['hypotheses']['location'] = {
    mode: 'colocation',
    chambres: 3,
    loyerChambre: 450,
  };

  it('rappelle la surface et le volume minimaux de chaque chambre, avec la surface moyenne du bien', () => {
    const points = vigilanceDe(projetAvec(coloc));
    expect(point(points, 'SURFACE_CHAMBRES_COLOCATION')?.parametres).toEqual({
      chambres: 3,
      surfaceParChambre: Math.round(65 / 3),
      surfaceMinimale: 9,
      volumeMinimal: 20,
    });
    expect(point(points, 'REGLEMENT_COPRO_LOCATION')?.parametres).toEqual({ mode: 'colocation' });
    expect(codes(points)).not.toContain('CHANGEMENT_USAGE_COURTE_DUREE');
    expect(codes(points)).not.toContain('BAIL_MOBILITE_CONDITIONS');
  });

  it('compare le loyer total des chambres au plafond d’encadrement', () => {
    const marche = { ...projetExemple.marche, plafondLoyerMensuel: 1_300 };
    expect(codes(vigilanceDe(projetAvec(coloc, {}, marche)))).toContain('LOYER_AU_DESSUS_PLAFOND');
    const haut = { ...projetExemple.marche, plafondLoyerMensuel: 1_400 };
    expect(codes(vigilanceDe(projetAvec(coloc, {}, haut)))).not.toContain(
      'LOYER_AU_DESSUS_PLAFOND',
    );
  });
});

describe('vigilance — moyenne durée et types classiques', () => {
  it('bail mobilité : rappelle ses conditions (1 à 10 mois)', () => {
    const points = vigilanceDe(projetAvec({ mode: 'moyenne_duree', loyerHc: 900 }));
    expect(point(points, 'BAIL_MOBILITE_CONDITIONS')?.parametres).toEqual({
      dureeMin: 1,
      dureeMax: 10,
    });
    expect(codes(points)).not.toContain('REGLEMENT_COPRO_LOCATION');
  });

  it('nue et meublée : aucun point propre au type', () => {
    const propres = [
      'CHANGEMENT_USAGE_COURTE_DUREE',
      'DPE_MEUBLE_TOURISME',
      'REGLEMENT_COPRO_LOCATION',
      'SURFACE_CHAMBRES_COLOCATION',
      'BAIL_MOBILITE_CONDITIONS',
    ];
    for (const code of propres) {
      expect(codes(vigilanceDe(projetExemple))).not.toContain(code);
      expect(codes(vigilanceDe(projetAvec({ mode: 'nu', loyerHc: 850 })))).not.toContain(code);
    }
  });
});
