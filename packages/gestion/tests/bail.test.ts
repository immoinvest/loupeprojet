import { describe, expect, it } from 'vitest';

import {
  ajouterAnnees,
  anniversaireCourant,
  moisDEffet,
  propositionRevision,
  publicationIrl,
  revisionParDefaut,
  RevisionSaisieSchema,
  trimestrePublieA,
  type EntreesRevision,
} from '../src/bail';
import { IRL, SOURCE_IRL } from '../src/regles-bail';
import { location, paiement } from './exemples';

/** Le cas de la spec G4-1 : location de Julie, 650 €, référence T2 2025 (146,68), DPE D, le 01/09/2026. */
function entrees(surcharges: Partial<EntreesRevision> = {}): EntreesRevision {
  return {
    location: location('l1'),
    paiements: [],
    revision: {
      active: true,
      anniversaire: '2025-10-01',
      trimestre: '2025-T2',
      formeBail: 'classique',
      derniereRevision: null,
    },
    classeDpe: 'D',
    aujourdhui: '2026-09-01',
    ...surcharges,
  };
}

function avecRevision(changement: Partial<EntreesRevision['revision']>): EntreesRevision {
  const base = entrees();
  return { ...base, revision: { ...base.revision, ...changement } };
}

describe('tableau de l’IRL', () => {
  it('trimestres consécutifs de 2022-T1 à 2026-T2, publications dans l’ordre, 148,37 au T2 2026', () => {
    expect(IRL[0]?.trimestre).toBe('2022-T1');
    for (let i = 1; i < IRL.length; i += 1) {
      const precedent = IRL[i - 1];
      const courant = IRL[i];
      expect(courant!.publieLe > precedent!.publieLe).toBe(true);
      const annee = Number(precedent!.trimestre.slice(0, 4));
      const numero = Number(precedent!.trimestre.slice(6));
      const attendu =
        numero === 4 ? `${String(annee + 1)}-T1` : `${String(annee)}-T${String(numero + 1)}`;
      expect(courant!.trimestre).toBe(attendu);
    }
    expect(IRL.at(-1)).toEqual({ trimestre: '2026-T2', valeur: 14_837, publieLe: '2026-07-10' });
    expect(SOURCE_IRL.prochainePublication).toBe('2026-10-15');
  });
});

describe('dates et trimestres', () => {
  it('ajouterAnnees : même jour, 29 février ramené au 28', () => {
    expect(ajouterAnnees('2026-10-01', 1)).toBe('2027-10-01');
    expect(ajouterAnnees('2028-02-29', 1)).toBe('2029-02-28');
    expect(ajouterAnnees('2027-10-01', -1)).toBe('2026-10-01');
  });

  it('publicationIrl : publiée, sinon estimée au 15 du mois habituel (T4 en janvier suivant)', () => {
    expect(publicationIrl('2026-T2')).toEqual({ date: '2026-07-10', valeur: 14_837 });
    expect(publicationIrl('2026-T3')).toEqual({ date: '2026-10-15', valeur: null });
    expect(publicationIrl('2026-T4')).toEqual({ date: '2027-01-15', valeur: null });
    expect(publicationIrl('2021-T1')).toEqual({ date: '2021-04-15', valeur: null });
  });

  it('trimestrePublieA : le dernier indice paru ce jour-là', () => {
    expect(trimestrePublieA('2025-10-01')).toBe('2025-T2');
    expect(trimestrePublieA('2025-10-15')).toBe('2025-T3');
    expect(trimestrePublieA('2026-01-10')).toBe('2025-T3');
    expect(trimestrePublieA('2026-01-20')).toBe('2025-T4');
  });

  it('anniversaireCourant : proposé un mois avant, le plus récent ; aucun avant la première année', () => {
    expect(anniversaireCourant('2025-10-01', '2026-08-31')).toBeNull();
    expect(anniversaireCourant('2025-10-01', '2026-09-01')).toBe('2026-10-01');
    expect(anniversaireCourant('2025-10-01', '2027-03-01')).toBe('2026-10-01');
    expect(anniversaireCourant('2025-10-01', '2027-09-02')).toBe('2027-10-01');
    expect(anniversaireCourant('2026-12-01', '2026-09-01')).toBeNull();
  });

  it('revisionParDefaut : active, anniversaire de l’entrée, référence supposée révisée chaque année', () => {
    const attendu = { active: true, anniversaire: '2025-10-01', formeBail: 'classique' };
    expect(revisionParDefaut(location('l1'), '2026-09-01')).toEqual({
      ...attendu,
      trimestre: '2025-T2',
    });
    // Première année pas encore arrivée : le trimestre de l'entrée.
    expect(revisionParDefaut(location('l1'), '2026-01-01')).toEqual({
      ...attendu,
      trimestre: '2025-T2',
    });
    // Entrée en 2023 : la révision de 2025 est supposée faite, la référence est T2 2025.
    const ancienne = revisionParDefaut(location('l2', { debut: '2023-10-01' }), '2026-09-01');
    expect(ancienne).toEqual({ ...attendu, anniversaire: '2023-10-01', trimestre: '2025-T2' });
    expect(RevisionSaisieSchema.safeParse(ancienne).success).toBe(true);
  });

  it('moisDEffet : jamais avant la demande ni l’anniversaire, après le dernier mois payé', () => {
    const l = location('l1');
    expect(moisDEffet('2026-10-01', '2026-09-01', l, [])).toBe('2026-10');
    expect(moisDEffet('2026-10-01', '2026-11-15', l, [])).toBe('2026-12');
    expect(moisDEffet('2026-10-01', '2026-11-01', l, [])).toBe('2026-11');
    expect(moisDEffet('2026-10-15', '2026-09-01', l, [])).toBe('2026-11');
    const payeDecembre = [paiement('p1', 'l1', '2026-12', 70_000)];
    expect(moisDEffet('2026-10-01', '2026-09-01', l, payeDecembre)).toBe('2027-01');
  });
});

describe('propositionRevision', () => {
  it('cas de la spec : 650 € → 657,49 € (+1,15 %), T2 2025 146,68 → T2 2026 148,37, effet octobre', () => {
    expect(propositionRevision(entrees())).toEqual({
      statut: 'proposee',
      anniversaire: '2026-10-01',
      aPartirDe: '2026-10',
      loyerActuel: 65_000,
      nouveauLoyer: 65_749,
      charges: 5_000,
      indiceAncien: { trimestre: '2025-T2', valeur: 14_668 },
      indiceNouveau: { trimestre: '2026-T2', valeur: 14_837, publieLe: '2026-07-10' },
      variationPourcent: 1.15,
    });
  });

  it('demandée le 15 novembre : effet en décembre ; loyer en vigueur ce mois-là (changement G1c)', () => {
    const tardive = propositionRevision(entrees({ aujourdhui: '2026-11-15' }));
    expect(tardive).toMatchObject({
      statut: 'proposee',
      aPartirDe: '2026-12',
      nouveauLoyer: 65_749,
    });
    const changee = location('l1', {
      changements: [{ aPartirDe: '2026-06', loyerHorsCharges: 68_000, charges: 6_000, apl: 0 }],
    });
    expect(propositionRevision(entrees({ location: changee }))).toMatchObject({
      loyerActuel: 68_000,
      nouveauLoyer: Math.round((68_000 * 14_837) / 14_668),
      charges: 6_000,
    });
  });

  it('désactivée, pas encore, terminée, déjà appliquée', () => {
    expect(propositionRevision(avecRevision({ active: false }))).toEqual({ statut: 'inactive' });
    expect(propositionRevision(entrees({ aujourdhui: '2026-08-01' }))).toEqual({
      statut: 'pas_encore',
      prochaine: '2026-10-01',
    });
    expect(
      propositionRevision(entrees({ location: location('l1', { fin: '2026-09-30' }) })),
    ).toEqual({ statut: 'terminee' });
    expect(propositionRevision(avecRevision({ derniereRevision: '2026-10-01' }))).toEqual({
      statut: 'appliquee',
      anniversaire: '2026-10-01',
      prochaine: '2027-10-01',
    });
  });

  it('gel des loyers : F et G jamais révisés ; E proposé', () => {
    for (const classe of ['F', 'G'] as const) {
      expect(propositionRevision(entrees({ classeDpe: classe }))).toEqual({
        statut: 'gelee',
        anniversaire: '2026-10-01',
        classe,
      });
    }
    expect(propositionRevision(entrees({ classeDpe: 'E' })).statut).toBe('proposee');
    expect(propositionRevision(entrees({ classeDpe: null })).statut).toBe('proposee');
  });

  it('indice pas encore publié : attendu, avec sa publication prévue', () => {
    const t3 = avecRevision({ anniversaire: '2025-11-01', trimestre: '2025-T3' });
    expect(propositionRevision({ ...t3, aujourdhui: '2026-10-05' })).toEqual({
      statut: 'indice_attendu',
      anniversaire: '2026-11-01',
      trimestre: '2026-T3',
      publicationPrevue: '2026-10-15',
    });
  });

  it('référence de l’année : rien à comparer avant un an', () => {
    expect(propositionRevision(avecRevision({ trimestre: '2026-T2' }))).toEqual({
      statut: 'pas_encore',
      prochaine: '2027-10-01',
    });
  });

  it('T4 : en janvier avant la publication, l’indice de deux ans plus tôt', () => {
    const t4 = avecRevision({ anniversaire: '2025-01-10', trimestre: '2023-T4' });
    expect(propositionRevision({ ...t4, aujourdhui: '2026-01-05' })).toMatchObject({
      statut: 'proposee',
      indiceAncien: { trimestre: '2023-T4', valeur: 14_206 },
      indiceNouveau: { trimestre: '2024-T4', valeur: 14_464 },
    });
  });

  it('ancien indice hors du tableau : référence inconnue', () => {
    const vieille = {
      ...avecRevision({ anniversaire: '2021-09-01', trimestre: '2021-T2' }),
      location: location('l1', { debut: '2021-09-01' }),
      aujourdhui: '2022-08-15',
    };
    expect(propositionRevision(vieille)).toEqual({
      statut: 'reference_inconnue',
      anniversaire: '2022-09-01',
    });
  });

  it('aucune hausse au centime près : sans hausse', () => {
    const minuscule = location('l1', { loyerHorsCharges: 1 });
    expect(propositionRevision(entrees({ location: minuscule }))).toEqual({
      statut: 'sans_hausse',
      anniversaire: '2026-10-01',
      aPartirDe: '2026-10',
    });
  });
});
