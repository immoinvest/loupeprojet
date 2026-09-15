import { describe, expect, it } from 'vitest';

import { calculerProjet } from '../../src/calculer-projet';
import {
  choisirTravaux,
  estimerTravaux,
  montantSelonChoix,
  recalerTravaux,
} from '../../src/estimation/travaux';
import { projetExemple } from '../../src/exemples/t3-marseille';
import { obtenirRegles } from '../../src/regles';
import { ProjetSchema, type ProjetEntree } from '../../src/schema';
import { ResultatsSchema } from '../../src/schema/resultats';
import { QUESTIONS_VISITE } from '../../src/visite';
import { contexteVisite, travauxEstimes } from '../../src/visite/contexte';
import type { ContexteVisite } from '../../src/visite/types';

const regles = obtenirRegles('2026-09');

/** Le T3 d'exemple (65 m²) avec d'autres caractéristiques et un autre achat. */
function projet(
  bien: Partial<ProjetEntree['bien']>,
  achat: Partial<ProjetEntree['hypotheses']['achat']> = {},
): ProjetEntree {
  return {
    ...projetExemple,
    bien: { ...projetExemple.bien, ...bien },
    hypotheses: {
      ...projetExemple.hypotheses,
      achat: { ...projetExemple.hypotheses.achat, ...achat },
    },
  };
}

describe('estimerTravaux', () => {
  it('65 m² à rafraîchir, DPE F : 65 × 400 + 65 × 250 = 42 250 €, fourchette 65 × 350 et 65 × 1 200', () => {
    const e = estimerTravaux({ surface: 65, etat: 'a_rafraichir', dpe: 'F' }, regles);
    // Calcul à la main : état 26 000 (9 750 à 45 500) ; énergie 16 250 (13 000 à 32 500).
    // Totaux 42 250 → 42 300 ; 22 750 → 22 800 ; 78 000.
    expect(e).toEqual({
      etat: 'a_rafraichir',
      dpe: 'F',
      lignes: [
        {
          code: 'etat',
          surface: 65,
          prixM2: { bas: 150, estime: 400, haut: 700 },
          montant: { bas: 9_750, estime: 26_000, haut: 45_500 },
        },
        {
          code: 'renovation_energetique',
          surface: 65,
          prixM2: { bas: 200, estime: 250, haut: 500 },
          montant: { bas: 13_000, estime: 16_250, haut: 32_500 },
        },
      ],
      bas: 22_800,
      estime: 42_300,
      haut: 78_000,
    });
  });

  it('30 m² à rénover, DPE G : moitié de la rénovation énergétique', () => {
    const e = estimerTravaux({ surface: 30, etat: 'a_renover', dpe: 'G' }, regles);
    // 30 × 1 200 = 36 000 ; 30 × 125 = 3 750 ; total 39 750 → 39 800. Bas 30 × 1 100 = 33 000, haut 30 × 2 250 = 67 500.
    expect(e?.lignes[1]?.prixM2).toEqual({ bas: 100, estime: 125, haut: 250 });
    expect(e).toMatchObject({ dpe: 'G', bas: 33_000, estime: 39_800, haut: 67_500 });
  });

  it('maison de 110 m² en bon état, DPE D : rien d’estimé, jusqu’à 16 500 €', () => {
    const e = estimerTravaux({ surface: 110, etat: 'bon_etat', dpe: 'D' }, regles);
    expect(e).toMatchObject({ dpe: null, bas: 0, estime: 0, haut: 16_500 });
    expect(e?.lignes).toHaveLength(1);
  });

  it('rénové sans DPE : zéro partout ; arrondi à la centaine', () => {
    expect(estimerTravaux({ surface: 42, etat: 'renove' }, regles)).toMatchObject({
      dpe: null,
      bas: 0,
      estime: 0,
      haut: 0,
    });
    // 41,3 × 400 = 16 520 → 16 500.
    expect(estimerTravaux({ surface: 41.3, etat: 'a_rafraichir' }, regles)?.estime).toBe(16_500);
  });

  it('état inconnu : aucune estimation, même avec un DPE G', () => {
    expect(estimerTravaux({ surface: 65, dpe: 'G' }, regles)).toBeNull();
  });
});

describe('montantSelonChoix', () => {
  it('rend la valeur estimée, le bas ou le haut', () => {
    const e = estimerTravaux({ surface: 65, etat: 'a_rafraichir' }, regles);
    if (e === null) throw new Error('estimation attendue');
    expect(montantSelonChoix(e, 'estime')).toBe(26_000);
    expect(montantSelonChoix(e, 'bas')).toBe(9_800);
    expect(montantSelonChoix(e, 'haut')).toBe(45_500);
  });
});

describe('recalerTravaux', () => {
  it('un projet existant (sans choix) ou saisi ne bouge pas', () => {
    const existant = projet({ etat: 'a_renover' });
    expect(recalerTravaux(existant)).toBe(existant);
    const saisi = projet({ etat: 'a_renover' }, { travaux: 5_000, travauxChoix: 'saisi' });
    expect(recalerTravaux(saisi)).toBe(saisi);
    expect(ProjetSchema.parse(existant).hypotheses.achat.travaux).toBe(6_000);
    expect(ProjetSchema.parse(existant).hypotheses.achat.travauxChoix).toBeUndefined();
  });

  it('suit l’état, la surface et le DPE ; la provenance devient « estimé »', () => {
    const suivi = recalerTravaux(projet({ etat: 'a_rafraichir' }, { travauxChoix: 'estime' }));
    expect(suivi.hypotheses.achat.travaux).toBe(26_000);
    expect(suivi.provenance?.['achat.travaux']).toBe('estime');
    const haut = recalerTravaux(
      projet({ etat: 'a_rafraichir', dpe: 'G' }, { travauxChoix: 'haut' }),
    );
    expect(haut.hypotheses.achat.travaux).toBe(78_000);
  });

  it('état inconnu : 0 €, le choix est gardé ; sans provenance, elle est créée', () => {
    const avec = projet({ etat: undefined }, { travauxChoix: 'bas' });
    const r = recalerTravaux({
      id: avec.id,
      versionRegles: avec.versionRegles,
      bien: avec.bien,
      hypotheses: avec.hypotheses,
    });
    expect(r.hypotheses.achat).toMatchObject({ travaux: 0, travauxChoix: 'bas' });
    expect(r.provenance).toEqual({ 'achat.travaux': 'estime' });
  });
});

describe('choisirTravaux', () => {
  it('un choix estimé recalcule, « saisi » garde le montant', () => {
    const base = projet({ etat: 'a_renover', surface: 30 });
    expect(choisirTravaux(base, 'estime').hypotheses.achat.travaux).toBe(36_000);
    const saisi = choisirTravaux(base, 'saisi');
    expect(saisi.hypotheses.achat).toMatchObject({ travaux: 6_000, travauxChoix: 'saisi' });
  });
});

describe('visite : travaux estimés à faire chiffrer', () => {
  const contexte = (entree: ProjetEntree): ContexteVisite =>
    contexteVisite(ProjetSchema.parse(entree), []);
  const question = QUESTIONS_VISITE.find((q) => q.id === 'TRAVAUX_ESTIMES_DEVIS');
  const chiffrage = QUESTIONS_VISITE.find((q) => q.id === 'TRAVAUX_CHIFFRAGE');

  it('remplace la question de chiffrage quand le montant vient de l’estimation', () => {
    const estime = contexte(
      projet({ etat: 'a_rafraichir' }, { travaux: 26_000, travauxChoix: 'estime' }),
    );
    expect(travauxEstimes(estime)).toBe(true);
    expect(question?.condition?.(estime)).toBe(true);
    expect(chiffrage?.condition?.(estime)).toBe(false);
    expect(question?.parametres?.(estime)).toEqual({ travaux: 26_000, bas: 9_800, haut: 45_500 });

    // Projet d'avant (sans choix), montant saisi ou estimé à zéro : la question de chiffrage reste.
    const existant = contexte(projet({ etat: 'a_rafraichir' }));
    expect(travauxEstimes(existant)).toBe(false);
    expect(chiffrage?.condition?.(existant)).toBe(true);
    expect(travauxEstimes(contexte(projet({}, { travaux: 5_000, travauxChoix: 'saisi' })))).toBe(
      false,
    );
    expect(
      travauxEstimes(contexte(projet({ etat: 'renove' }, { travaux: 0, travauxChoix: 'estime' }))),
    ).toBe(false);
  });

  it('sans état connu, la fourchette vaut zéro', () => {
    const sansEtat = contexte(projet({ etat: undefined }, { travaux: 3_000, travauxChoix: 'bas' }));
    expect(question?.parametres?.(sansEtat)).toEqual({ travaux: 3_000, bas: 0, haut: 0 });
  });
});

describe('résultats', () => {
  it('portent les travaux estimés, validés par le schéma de sortie, complets ou partiels', () => {
    const complet = calculerProjet(projet({ etat: 'a_rafraichir' }));
    expect(complet.travaux?.estime).toBe(26_000);
    expect(ResultatsSchema.safeParse(complet).success).toBe(true);
    // Location nue sans loyer : rapport partiel.
    const partiel = calculerProjet({
      ...projet({ etat: undefined }),
      hypotheses: { ...projetExemple.hypotheses, location: { mode: 'nu' } },
    });
    expect(partiel.complet).toBe(false);
    expect(partiel.travaux).toBeNull();
    expect(ResultatsSchema.safeParse(partiel).success).toBe(true);
  });
});
