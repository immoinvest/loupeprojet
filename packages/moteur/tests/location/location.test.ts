import { describe, expect, it } from 'vitest';

import {
  defautsPourMode,
  estModeMeuble,
  loyerMensuelHc,
  loyerMensuelReference,
  tauxProportionnel,
  vacanceSemaines,
} from '../../src/location';
import { obtenirRegles } from '../../src/regles';
import {
  LocationSchema,
  MODES_LOCATION,
  loyerConnu,
  type LocationComplete,
  type LocationEntree,
} from '../../src/schema';

const regles = obtenirRegles('2026-09');

/** Une location validée dont le loyer est donné : les équivalents n'existent qu'avec lui. */
function complete(entree: LocationEntree): LocationComplete {
  const l = LocationSchema.parse(entree);
  if (!loyerConnu(l)) throw new Error('loyer attendu');
  return l;
}

const nu = complete({ mode: 'nu', loyerHc: 800, gestionTaux: 0.07 });
const meuble = complete({ mode: 'meuble', loyerHc: 980 });
const coloc = complete({
  mode: 'colocation',
  chambres: 4,
  loyerChambre: 460,
  vacanceSemaines: 5,
  gestionTaux: 0.08,
});
const cd = complete({
  mode: 'courte_duree',
  nuitee: 80,
  nuiteesParMois: 15,
  conciergerieTaux: 0.2,
  plateformeTaux: 0.03,
});
const md = complete({
  mode: 'moyenne_duree',
  loyerHc: 900,
  vacanceSemaines: 6,
  gestionTaux: 0.05,
  plateformeTaux: 0.04,
});

describe('équivalents', () => {
  it('loyerMensuelHc : loyer, chambres × loyer par chambre, nuitée × nuitées', () => {
    expect(loyerMensuelHc(nu)).toBe(800);
    expect(loyerMensuelHc(meuble)).toBe(980);
    expect(loyerMensuelHc(coloc)).toBe(1_840);
    expect(loyerMensuelHc(cd)).toBe(1_200);
    expect(loyerMensuelHc(md)).toBe(900);
  });

  it('loyerMensuelReference : le loyer meublé longue durée équivalent', () => {
    expect(loyerMensuelReference(nu, regles)).toBeCloseTo(920, 10);
    expect(loyerMensuelReference(meuble, regles)).toBe(980);
    expect(loyerMensuelReference(coloc, regles)).toBeCloseTo(1_840 / 1.35, 10);
    expect(loyerMensuelReference(cd, regles)).toBe(1_200);
    expect(loyerMensuelReference(md, regles)).toBe(900);
  });

  it('vacance et frais proportionnels par type', () => {
    expect(vacanceSemaines(cd)).toBe(0);
    expect(vacanceSemaines(coloc)).toBe(5);
    expect(tauxProportionnel(nu)).toBe(0.07);
    expect(tauxProportionnel(coloc)).toBe(0.08);
    expect(tauxProportionnel(cd)).toBeCloseTo(0.23, 10);
    expect(tauxProportionnel(md)).toBeCloseTo(0.09, 10);
  });

  it('estModeMeuble : tout sauf la location nue', () => {
    expect(MODES_LOCATION.filter(estModeMeuble)).toEqual([
      'meuble',
      'colocation',
      'courte_duree',
      'moyenne_duree',
    ]);
  });
});

describe('defautsPourMode', () => {
  const contexte = { loyerMensuel: 980, chambres: 2 };

  it('nue : loyer ÷ prime meublé, vacance et gestion des règles, aucun abonnement', () => {
    expect(defautsPourMode('nu', regles, contexte)).toEqual({
      location: {
        mode: 'nu',
        loyerHc: 852,
        chargesLocataire: 0,
        vacanceSemaines: 3,
        gestionTaux: 0,
      },
      charges: { energieMensuel: 0, internetMensuel: 0 },
    });
  });

  it('meublée : le loyer de référence tel quel', () => {
    expect(defautsPourMode('meuble', regles, contexte).location).toEqual({
      mode: 'meuble',
      loyerHc: 980,
      chargesLocataire: 0,
      vacanceSemaines: 3,
      gestionTaux: 0,
    });
  });

  it('colocation : loyer × prime colocation ÷ chambres, forfait = abonnements ÷ chambres', () => {
    const d = defautsPourMode('colocation', regles, contexte);
    expect(d.location).toEqual({
      mode: 'colocation',
      chambres: 2,
      loyerChambre: Math.round((980 * 1.35) / 2),
      forfaitChargesChambre: 110,
      vacanceSemaines: 4,
      gestionTaux: 0,
    });
    expect(d.charges).toEqual({ energieMensuel: 190, internetMensuel: 30 });
    // Chambres décimales ou nulles : arrondies, au moins une.
    expect(
      defautsPourMode('colocation', regles, { loyerMensuel: 980, chambres: 0 }).location,
    ).toMatchObject({ chambres: 1, forfaitChargesChambre: 220 });
  });

  it('courte durée : nuitée = deux loyers journaliers (30 € au moins), défauts de l’Excel', () => {
    const d = defautsPourMode('courte_duree', regles, contexte);
    expect(d.location).toEqual({
      mode: 'courte_duree',
      nuitee: Math.round((980 / 30) * 2),
      nuiteesParMois: 15,
      dureeSejourNuits: 4,
      menageFactureParSejour: 27,
      menageCoutParSejour: 27,
      plateformeTaux: 0.03,
      conciergerieTaux: 0,
      tourismeClasse: false,
    });
    expect(d.charges).toEqual({ energieMensuel: 190, internetMensuel: 30 });
    expect(
      defautsPourMode('courte_duree', regles, { loyerMensuel: 100, chambres: 1 }).location,
    ).toMatchObject({ nuitee: 30 });
  });

  it('moyenne durée : loyer de référence, forfait = abonnements, séjours de 4 mois', () => {
    const d = defautsPourMode('moyenne_duree', regles, contexte);
    expect(d.location).toEqual({
      mode: 'moyenne_duree',
      loyerHc: 980,
      forfaitCharges: 220,
      dureeSejourMois: 4,
      vacanceSemaines: 4,
      menageCoutParSejour: 0,
      plateformeTaux: 0,
      gestionTaux: 0,
    });
    expect(d.charges).toEqual({ energieMensuel: 190, internetMensuel: 30 });
  });

  it('chaque variante produite est acceptée par le schéma et revient à sa référence', () => {
    for (const mode of MODES_LOCATION) {
      const { location } = defautsPourMode(mode, regles, contexte);
      expect(LocationSchema.parse(location)).toEqual(location);
      // Les arrondis (loyer, nuitée) écartent la référence de quelques euros au plus.
      expect(Math.abs(loyerMensuelReference(location, regles) - 980)).toBeLessThan(10);
    }
  });
});
