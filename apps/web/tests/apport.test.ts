import { describe, expect, it } from 'vitest';

import {
  PART_APPORT_DEFAUT,
  apportParDefaut,
  construireProjet,
  coutTotalDuProjet,
  partDuCoutTotal,
  type SaisieProjet,
} from '@/annonces';
import { apercuApport, valeursDepuisChamps } from '@/ecrans/formulaire/valeurs';
import { GROUPE_FINANCEMENT } from '@/hypotheses/groupes-finances';
import { texteApport } from '@/textes/apport';

const MINIMAL: SaisieProjet = {
  prix: 120_000,
  surface: 40,
  codePostal: '69003',
  ville: 'Lyon',
  mode: 'meuble',
  provenance: {},
};

/** Les espaces insécables des nombres formatés deviennent des espaces simples. */
const n = (texte: string): string => texte.replace(/\s/g, ' ');

describe('apport par défaut', () => {
  it('vaut 10 % du coût total, arrondi à la centaine', () => {
    expect(PART_APPORT_DEFAUT).toBe(0.1);
    expect(apportParDefaut(123_456)).toBe(12_300);
    expect(apportParDefaut(124_950)).toBe(12_500);
    expect(apportParDefaut(0)).toBe(0);
  });

  it('rapporte un apport au coût total, sans coût total positif : rien', () => {
    expect(partDuCoutTotal(12_400, 124_000)).toBe(0.1);
    expect(partDuCoutTotal(12_400, null)).toBeNull();
    expect(partDuCoutTotal(12_400, 0)).toBeNull();
  });

  it('construireProjet pose 10 % du coût total (prix, frais, mobilier), marqué estimé', () => {
    const projet = construireProjet(MINIMAL, 'p');
    const cout = coutTotalDuProjet(projet);
    // Prix 120 000 €, frais d'acquisition, frais bancaires et mobilier meublé (3 000 €).
    expect(cout).toBeGreaterThan(130_000);
    expect(projet.hypotheses.pret.apport).toBe(apportParDefaut(cout ?? 0));
    expect(projet.provenance?.['pret.apport']).toBe('estime');
    // Le coût total ne dépend pas de l'apport.
    const saisi = construireProjet({ ...MINIMAL, apport: 5_000 }, 'p');
    expect(coutTotalDuProjet(saisi)).toBe(cout);
    expect(saisi.hypotheses.pret.apport).toBe(5_000);
    expect(saisi.provenance?.['pret.apport']).toBe('utilisateur');
  });

  it('les travaux entrent dans le coût total, donc dans l’apport par défaut', () => {
    const sans = construireProjet(MINIMAL, 'p').hypotheses.pret.apport ?? 0;
    const avec = construireProjet({ ...MINIMAL, travaux: 20_000 }, 'p').hypotheses.pret.apport;
    expect(avec).toBe(sans + 2_000);
  });

  it('un projet que le moteur refuse n’a pas de coût total : apport nul', () => {
    const refuse = construireProjet({ ...MINIMAL, prix: -1 }, 'p');
    expect(coutTotalDuProjet(refuse)).toBeNull();
    expect(refuse.hypotheses.pret.apport).toBe(0);
  });
});

describe('texteApport', () => {
  it('dit la part du coût total, ou la règle du défaut sans coût total', () => {
    expect(n(texteApport(12_400, 124_000))).toBe('Soit 10 % du coût total du projet (124 000 €).');
    expect(n(texteApport(0, 124_000))).toBe('Soit 0 % du coût total du projet (124 000 €).');
    const regle = 'Par défaut, 10 % du coût total : prix, frais, travaux et mobilier.';
    expect(n(texteApport(null, 124_000))).toBe(regle);
    expect(n(texteApport(12_400, null))).toBe(regle);
  });
});

describe('apercuApport (formulaire Vérifier)', () => {
  const { valeurs, provenance } = valeursDepuisChamps({});
  const rempli = { ...valeurs, prix: '120000', surface: '40', codePostal: '69003', ville: 'Lyon' };

  it('sans prix, surface et code postal : champ vide et règle du défaut', () => {
    expect(provenance.apport).toBe('estime');
    const apercu = apercuApport(valeurs, provenance);
    expect(apercu.texte).toBe('');
    expect(n(apercu.indication)).toMatch(/^Par défaut, 10 %/);
  });

  it('estimé : montre les 10 % que recevra le projet, et suit le prix', () => {
    const attendu = construireProjet(MINIMAL, 'p').hypotheses.pret.apport;
    const apercu = apercuApport(rempli, provenance);
    expect(apercu.texte).toBe(String(attendu));
    expect(n(apercu.indication)).toMatch(/^Soit 10 % du coût total du projet \(\d+ \d{3} €\)\.$/);
    expect(Number(apercuApport({ ...rempli, prix: '240000' }, provenance).texte)).toBeGreaterThan(
      Number(apercu.texte),
    );
  });

  it('saisi : garde la saisie et en donne la part ; illisible : la règle du défaut', () => {
    const aToi = { ...provenance, apport: 'utilisateur' as const };
    const saisi = apercuApport({ ...rempli, apport: '27000' }, aToi);
    expect(saisi.texte).toBe('27000');
    expect(n(saisi.indication)).toMatch(/^Soit 20 % du coût total/);
    const illisible = apercuApport({ ...rempli, apport: 'abc' }, aToi);
    expect(illisible.texte).toBe('abc');
    expect(n(illisible.indication)).toMatch(/^Par défaut/);
  });
});

describe('Hypothèses : aide du champ Apport', () => {
  it('donne la part du coût total du projet', () => {
    const apport = GROUPE_FINANCEMENT.champs.find((d) => d.chemin === 'hypotheses.pret.apport');
    const projet = construireProjet({ ...MINIMAL, apport: 0 }, 'p');
    expect(n(apport?.aideSelon?.(projet) ?? '')).toMatch(/^Soit 0 % du coût total du projet/);
  });

  it('sans apport dans le projet (défaut du schéma) : la règle du défaut', () => {
    const projet = construireProjet(MINIMAL, 'p');
    const { apport: montant, ...pretSansApport } = projet.hypotheses.pret;
    expect(montant).toBeGreaterThan(0);
    const sansApport = { ...projet, hypotheses: { ...projet.hypotheses, pret: pretSansApport } };
    const champ = GROUPE_FINANCEMENT.champs.find((d) => d.chemin === 'hypotheses.pret.apport');
    expect(n(champ?.aideSelon?.(sansApport) ?? '')).toMatch(/^Par défaut, 10 %/);
  });
});
