import { describe, expect, it } from 'vitest';

import { valeursDepuisChamps, type Valeurs } from '@/ecrans/formulaire/valeurs';
import { grouperChamps, groupeDeItem, resumeEstimes } from '@/verifier/groupes';
import { travauxEstimesDe } from '@/verifier/travaux';

const VIDE = valeursDepuisChamps({});
const avec = (champs: Partial<Valeurs>): Valeurs => ({ ...VIDE.valeurs, ...champs });
/** Les espaces insécables des nombres formatés deviennent des espaces simples. */
const n = (s: string): string => s.replace(/\s/g, ' ');

describe('Vérifier : travaux estimés', () => {
  it('estime d’après l’état, la surface et le DPE, seulement sans montant saisi', () => {
    expect(travauxEstimesDe(avec({ etat: 'a_rafraichir', surface: '40' }))?.estime).toBe(16_000);
    // 65 × 400 + 65 × 250 = 42 250 → 42 300.
    expect(travauxEstimesDe(avec({ etat: 'a_rafraichir', surface: '65', dpe: 'F' }))?.estime).toBe(
      42_300,
    );
    expect(travauxEstimesDe(avec({ etat: 'a_rafraichir', surface: '40,5' }))?.estime).toBe(16_200);
    expect(
      travauxEstimesDe(avec({ etat: 'a_rafraichir', surface: '40', travaux: '5000' })),
    ).toBeNull();
    expect(travauxEstimesDe(avec({ surface: '40' }))).toBeNull();
    expect(travauxEstimesDe(avec({ etat: 'a_rafraichir', surface: '' }))).toBeNull();
    expect(travauxEstimesDe(avec({ etat: 'a_rafraichir', surface: '0' }))).toBeNull();
  });

  it('range les travaux dans « Estimé pour vous » quand l’état est connu, sinon dans « Préciser »', () => {
    const lu = avec({ etat: 'a_renover', surface: '30' });
    const groupes = grouperChamps(lu, { etat: 'annonce', surface: 'annonce' });
    expect(groupeDeItem(groupes, 'travaux')).toBe('estimes');
    expect(groupeDeItem(grouperChamps(VIDE.valeurs, {}), 'travaux')).toBe('preciser');
    // Des travaux lus dans l'annonce restent « lus ».
    const avecMontant = grouperChamps(avec({ etat: 'a_renover', surface: '30', travaux: '8000' }), {
      travaux: 'annonce',
    });
    expect(groupeDeItem(avecMontant, 'travaux')).toBe('lus');
  });

  it('le résumé cite le montant estimé', () => {
    expect(n(resumeEstimes(['travaux'], avec({ etat: 'a_renover', surface: '30' }), null))).toBe(
      'travaux 36 000 €',
    );
    expect(resumeEstimes(['travaux'], VIDE.valeurs, null)).toBe('travaux');
  });
});
