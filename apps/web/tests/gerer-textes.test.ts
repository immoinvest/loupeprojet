import { describe, expect, it } from 'vitest';

import { projetsAReprendre } from '@/ecrans/gerer/Portes';
import { creerProjet, type StatutProjet } from '@/stockage/projets';
import {
  avecMajuscule,
  biensVacants,
  de,
  loyerRecu,
  marquerRecu,
  phraseDuMois,
  STATUTS_LOYER,
  TONS_LOYER,
} from '@/textes/gerer-ecrans';

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

  it('majuscule, biens vacants, statuts et tons', () => {
    expect(avecMajuscule('septembre 2026')).toBe('Septembre 2026');
    expect(biensVacants(['Parking Prado'])).toBe('Sans locataire : Parking Prado');
    expect(biensVacants(['Parking Prado', 'Cave Rouet'])).toBe(
      'Sans locataire : Parking Prado, Cave Rouet',
    );
    expect(STATUTS_LOYER.en_retard).toBe('En retard');
    expect(TONS_LOYER.recu).toBe('bon');
  });
});

describe('projetsAReprendre (porte « J’ai acheté un bien analysé »)', () => {
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
