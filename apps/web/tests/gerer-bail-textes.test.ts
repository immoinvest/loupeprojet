import { describe, expect, it } from 'vitest';

import {
  alerteAFaire,
  alerteEnLettres,
  aPartirDuMois,
  dpeEnLettres,
  effetEnLettres,
  ERREURS_BAIL,
  FORMES_BAIL_TEXTES,
  indiceEnLettres,
  indicesEnLettres,
  lettreCalcul,
  lettreEffet,
  lettreFaitLe,
  lettreIndice,
  lettreIntroduction,
  lettreSource,
  nouveauLoyerEnLettres,
  numeroLettreEnLettres,
  phraseRevision,
  PROVENANCES,
  revisionAFaire,
  revisionAppliquee,
  trimestreEnLettres,
  URL_SOURCE_IRL,
  variationEnLettres,
  zoneEnLettres,
} from '@/textes/gerer-bail';

import { lettreJulie, propositionJulie } from './bail-exemples';

/** Les montants et pourcentages portent des espaces insécables : comparés en espaces simples. */
const simple = (texte: string): string => texte.replace(/\s/g, ' ');

describe('textes de la conformité', () => {
  it('DPE, zone tendue, provenances, formes du bail', () => {
    expect(dpeEnLettres(null, null)).toBe('Non renseigné');
    expect(dpeEnLettres('D', null)).toBe('Classe D');
    expect(dpeEnLettres('D', '2024-03-01')).toBe('Classe D, réalisé le 1er mars 2024');
    expect([zoneEnLettres(null), zoneEnLettres(true), zoneEnLettres(false)]).toEqual([
      'Non renseignée',
      'Oui',
      'Non',
    ]);
    expect(PROVENANCES.analyse).toBe('analyse');
    expect(FORMES_BAIL_TEXTES.mobilite).toBe('Bail mobilité (1 à 10 mois)');
    expect(ERREURS_BAIL.indisponible).toMatch(/^Bientôt disponible/);
  });

  it('alertes : sur la fiche et dans « À faire »', () => {
    const interdite = { code: 'location_interdite', classe: 'G', depuis: '2025-01-01' } as const;
    const bientot = {
      code: 'location_interdite_bientot',
      classe: 'F',
      aPartirDu: '2028-01-01',
    } as const;
    const perime = { code: 'dpe_perime', depuis: '2023-01-01' } as const;
    const manquant = { code: 'dpe_manquant' } as const;
    const fin = {
      code: 'fin_bail_court',
      locationId: 'l',
      forme: 'etudiant',
      fin: '2026-09-30',
    } as const;
    const mobilite = { ...fin, forme: 'mobilite' } as const;
    expect(alerteEnLettres(interdite)).toBe(
      'Classe G : nouveau bail et renouvellement interdits depuis le 1er janvier 2025.',
    );
    expect(alerteEnLettres(bientot)).toBe(
      'Classe F : nouveau bail et renouvellement interdits à partir du 1er janvier 2028.',
    );
    expect(alerteEnLettres(perime)).toMatch(/^DPE plus valable depuis le 1er janvier 2023/);
    expect(alerteEnLettres(manquant)).toMatch(/^DPE non renseigné/);
    expect(alerteEnLettres(fin)).toBe('Bail étudiant : fin prévue le 30 septembre 2026.');
    expect(alerteEnLettres(mobilite)).toBe('Bail mobilité : fin prévue le 30 septembre 2026.');

    expect(alerteAFaire(interdite, 'T2 Lices')).toBe('Location interdite : T2 Lices (DPE G)');
    expect(alerteAFaire(perime, 'T2 Lices')).toBe('DPE à refaire : T2 Lices');
    expect(alerteAFaire(fin, 'T2 Lices')).toBe(
      'Fin du bail étudiant le 30 septembre 2026 : T2 Lices',
    );
    expect(alerteAFaire(bientot, 'x')).toBe(alerteEnLettres(bientot));
    expect(alerteAFaire(manquant, 'x')).toBe(alerteEnLettres(manquant));
  });
});

describe('textes de la révision', () => {
  it('trimestres, indices, variation, nouveau loyer, mois d’effet', () => {
    const p = propositionJulie();
    expect(trimestreEnLettres('2026-T1')).toBe('1er trimestre 2026');
    expect(trimestreEnLettres('2026-T2')).toBe('2e trimestre 2026');
    expect(indiceEnLettres(14_837)).toBe('148,37');
    expect(simple(variationEnLettres(1.15))).toBe('+1,15 %');
    expect(simple(nouveauLoyerEnLettres(p))).toBe('650 € → 657,49 € (+1,15 %)');
    expect(aPartirDuMois('2026-10')).toBe('à partir d’octobre 2026');
    expect(aPartirDuMois('2026-09')).toBe('à partir de septembre 2026');
    expect(effetEnLettres(p)).toBe(
      'Loyer hors charges, à partir d’octobre 2026 (anniversaire du bail le 1er octobre 2026).',
    );
    expect(indicesEnLettres(p)).toBe(
      'IRL du 2e trimestre 2026 : 148,37 (publié le 10 juillet 2026), contre 146,68 un an plus tôt.',
    );
    expect(URL_SOURCE_IRL).toMatch(/^https:\/\/www\.insee\.fr\//);
    expect(simple(revisionAppliquee(65_749, '2026-10'))).toBe(
      'Révision appliquée : 657,49 € à partir d’octobre 2026.',
    );
    expect(simple(revisionAFaire('Antoine', p))).toBe(
      'Réviser le loyer d’Antoine : 650 € → 657,49 €',
    );
  });

  it('une phrase par état sans hausse', () => {
    const a = '2026-10-01';
    expect(phraseRevision({ statut: 'inactive' })).toBe('Révision désactivée pour cette location.');
    expect(phraseRevision({ statut: 'terminee' })).toBe('Location terminée : plus de révision.');
    expect(phraseRevision({ statut: 'pas_encore', prochaine: a })).toMatch(
      /^Prochaine révision le 1er octobre 2026/,
    );
    expect(phraseRevision({ statut: 'appliquee', anniversaire: a, prochaine: '2027-10-01' })).toBe(
      'Révision du 1er octobre 2026 appliquée. Prochaine : 1er octobre 2027.',
    );
    expect(phraseRevision({ statut: 'gelee', anniversaire: a, classe: 'F' })).toMatch(
      /^Loyer gelé : logement classé F/,
    );
    expect(
      phraseRevision({
        statut: 'indice_attendu',
        anniversaire: a,
        trimestre: '2026-T3',
        publicationPrevue: '2026-10-15',
      }),
    ).toMatch(/3e trimestre 2026.*15 octobre 2026/);
    expect(phraseRevision({ statut: 'reference_inconnue', anniversaire: a })).toMatch(/réglages/);
    expect(
      phraseRevision({ statut: 'sans_hausse', anniversaire: a, aPartirDe: '2026-10' }),
    ).toMatch(/pas de hausse/);
  });

  it('la lettre : introduction, indices, calcul, effet, source, date, numéro', () => {
    const { contenu } = lettreJulie();
    expect(lettreIntroduction(contenu)).toMatch(
      /article 17-1 .* date anniversaire du 1er octobre 2026/,
    );
    expect(lettreIndice('2025-T2', true)).toBe('IRL de référence (2e trimestre 2025)');
    expect(lettreIndice('2026-T2', false)).toBe('IRL du 2e trimestre 2026');
    expect(simple(lettreCalcul(contenu))).toBe('Calcul : 650 € × 148,37 ÷ 146,68 = 657,49 €.');
    expect(
      lettreEffet({
        ...contenu,
        locataires: [...contenu.locataires, { prenom: 'Léa', nom: 'Bernard' }],
      }),
    ).toMatch(
      /^Ce nouveau loyer s’applique à partir d’octobre 2026, sans effet rétroactif\. Il concerne le bail de Julie Martin et Léa Bernard\.$/,
    );
    expect(lettreSource(contenu)).toMatch(/^Indice publié par l’INSEE le 10 juillet 2026/);
    expect(lettreFaitLe('2026-09-14')).toBe('Fait le 14 septembre 2026.');
    expect(numeroLettreEnLettres('V-202610-LOCATION')).toBe('N° V-202610-LOCATION');
  });
});
