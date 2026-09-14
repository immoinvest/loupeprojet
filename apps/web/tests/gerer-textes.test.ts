import { describe, expect, it } from 'vitest';

import { projetsAReprendre } from '@/ecrans/gerer/Portes';
import { creerProjet, type StatutProjet } from '@/stockage/projets';
import {
  avecMajuscule,
  de,
  entreesAVenir,
  loyerRecu,
  marquerRecu,
  phraseDuMois,
  STATUTS_LOYER,
  TONS_LOYER,
} from '@/textes/gerer-ecrans';
import { bienEtChambre, nomsDesLocataires, paiementEnregistre } from '@/textes/gerer-loyers';

describe('textes des lignes de loyer', () => {
  it('tous les locataires du bail : aucun, un, deux, trois', () => {
    expect(nomsDesLocataires([])).toBe('');
    expect(nomsDesLocataires(['Julie Martin'])).toBe('Julie Martin');
    expect(nomsDesLocataires(['Julie Martin', 'Léa Bernard'])).toBe('Julie Martin et Léa Bernard');
    expect(nomsDesLocataires(['Julie Martin', 'Léa Bernard', 'Hugo Petit'])).toBe(
      'Julie Martin, Léa Bernard et Hugo Petit',
    );
  });

  it('le bien et sa chambre ; le paiement enregistré', () => {
    expect(bienEtChambre('Coloc Rouet', 'Chambre 2')).toBe('Coloc Rouet · Chambre 2');
    expect(bienEtChambre('T2 Lices', undefined)).toBe('T2 Lices');
    expect(paiementEnregistre(30_000).replace(/\s/g, ' ')).toBe('Paiement de 300 € enregistré.');
  });
});

describe('textes des écrans de Gérer', () => {
  it('phraseDuMois : aucun, un seul, tous, une partie', () => {
    expect(phraseDuMois(0, 0)).toBe('Aucun loyer attendu ce mois-ci.');
    expect(phraseDuMois(1, 1)).toBe('Le loyer est reçu.');
    expect(phraseDuMois(4, 4)).toBe('Tous les loyers sont reçus.');
    expect(phraseDuMois(3, 4)).toBe('3 loyers sur 4 reçus');
    expect(phraseDuMois(1, 4)).toBe('1 loyer sur 4 reçu');
    expect(phraseDuMois(0, 1)).toBe('0 loyer sur 1 reçu');
  });

  it('élision devant une voyelle ou un h muet', () => {
    expect(de('Julie')).toBe('de Julie');
    expect(de('Antoine')).toBe('d’Antoine');
    expect(de('Hugo')).toBe('d’Hugo');
    expect(de('Éloïse')).toBe('d’Éloïse');
    expect(loyerRecu('Antoine')).toBe('Loyer d’Antoine reçu.');
    expect(marquerRecu('Julie')).toBe('Marquer reçu le loyer de Julie');
  });

  it('entrées à venir : une, puis plusieurs', () => {
    expect(entreesAVenir([{ nom: 'T2 Lices', date: '1er octobre 2026' }])).toBe(
      'Entrée à venir : T2 Lices le 1er octobre 2026',
    );
    expect(
      entreesAVenir([
        { nom: 'T2 Lices', date: '1er octobre 2026' },
        { nom: 'Studio Baille', date: '15 novembre 2026' },
      ]),
    ).toBe('Entrées à venir : T2 Lices le 1er octobre 2026 ; Studio Baille le 15 novembre 2026');
  });

  it('majuscule, statuts et tons', () => {
    expect(avecMajuscule('septembre 2026')).toBe('Septembre 2026');
    expect(STATUTS_LOYER.en_retard).toBe('En retard');
    expect(TONS_LOYER.recu).toBe('bon');
  });
});

describe('projetsAReprendre (porte « J’ai acheté un bien analysé »)', () => {
  it('les projets déjà achetés ne sont plus proposés', () => {
    const achete = creerProjet({ nom: 'Acheté', statut: 'achete' });
    const offre = creerProjet({ nom: 'Offre', statut: 'offre' });
    expect(projetsAReprendre([achete, offre]).map((p) => p.nom)).toEqual(['Offre']);
  });

  it('offres d’abord, puis visites ; jamais les écartés ; trois au plus', () => {
    const projet = (nom: string, statut: StatutProjet): ReturnType<typeof creerProjet> =>
      creerProjet({ nom, statut });
    const liste = [
      projet('Analyse A', 'analyse'),
      projet('Écarté', 'ecarte'),
      projet('Visite B', 'visite'),
      projet('Offre C', 'offre'),
      projet('Analyse D', 'analyse'),
    ];
    expect(projetsAReprendre(liste).map((p) => p.nom)).toEqual([
      'Offre C',
      'Visite B',
      'Analyse A',
    ]);
    expect(projetsAReprendre([projet('Écarté', 'ecarte')])).toEqual([]);
  });
});
