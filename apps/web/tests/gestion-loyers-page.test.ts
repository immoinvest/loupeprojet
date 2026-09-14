import { resumeDuMois, type EtatGestion, type LigneLoyer } from '@loupe/gestion';
import { describe, expect, it } from 'vitest';

import {
  GROUPES_LOYERS,
  groupesDuMois,
  paiementEnPartie,
  paiementsAvecRecu,
  periodeDepuisRecherche,
  quittancePossible,
  saisieEnPartie,
} from '@/gestion/loyers-page';
import {
  ERREURS_EN_PARTIE,
  GROUPES_LOYERS_TEXTES,
  recuDe,
  resteAPayer,
  TEXTES_LOYERS,
} from '@/textes/gerer-loyers';

import { ETAT_SEPTEMBRE, LOCATION_JULIE } from './gestion-exemples';

const AUJOURDHUI = '2026-09-14';

/** Les lignes du mois de septembre, calculées comme à l'écran. */
function lignesDe(etat: EtatGestion): readonly LigneLoyer[] {
  return resumeDuMois(etat, '2026-09', AUJOURDHUI).lignes;
}

function ligne(etat: EtatGestion, locationId: string): LigneLoyer {
  const trouvee = lignesDe(etat).find((l) => l.location.id === locationId);
  if (trouvee === undefined) throw new Error(`pas de loyer pour ${locationId}`);
  return trouvee;
}

/** Antoine a payé 100 € sur 430 € ; un locataire entre le 20. */
const AVEC_PARTIEL_ET_A_VENIR: EtatGestion = {
  ...ETAT_SEPTEMBRE,
  locations: [
    ...ETAT_SEPTEMBRE.locations,
    { ...LOCATION_JULIE, id: 'location-future', bienId: 'bien-baille', debut: '2026-09-20' },
  ],
  paiements: [
    ...ETAT_SEPTEMBRE.paiements,
    {
      id: 'paiement-antoine',
      locationId: 'location-antoine',
      periode: '2026-09',
      montant: 10_000,
      date: '2026-09-04',
      source: 'manuel',
      creeLe: '2026-09-04T08:00:00.000Z',
    },
  ],
};

describe('periodeDepuisRecherche', () => {
  it('le mois demandé s’il est valide, sinon le mois en cours', () => {
    expect(periodeDepuisRecherche('2026-10', AUJOURDHUI)).toBe('2026-10');
    expect(periodeDepuisRecherche(null, AUJOURDHUI)).toBe('2026-09');
    expect(periodeDepuisRecherche('2026-13', AUJOURDHUI)).toBe('2026-09');
    expect(periodeDepuisRecherche('octobre', AUJOURDHUI)).toBe('2026-09');
  });
});

describe('groupesDuMois', () => {
  it('en retard puis reçus ; les groupes vides n’apparaissent pas', () => {
    const groupes = groupesDuMois(lignesDe(ETAT_SEPTEMBRE));
    expect(groupes.map((g) => [g.groupe, g.lignes.map((l) => l.location.id)])).toEqual([
      ['en_retard', ['location-antoine']],
      ['recu', ['location-julie']],
    ]);
  });

  it('un loyer partiel a son groupe ; « à venir » rejoint les attendus', () => {
    const groupes = groupesDuMois(lignesDe(AVEC_PARTIEL_ET_A_VENIR));
    expect(groupes.map((g) => [g.groupe, g.lignes.map((l) => l.location.id)])).toEqual([
      ['partiel', ['location-antoine']],
      ['attendu', ['location-future']],
      ['recu', ['location-julie']],
    ]);
    expect(GROUPES_LOYERS).toEqual(['en_retard', 'partiel', 'attendu', 'recu']);
  });

  it('aucun loyer : aucun groupe', () => {
    expect(groupesDuMois([])).toEqual([]);
  });
});

describe('paiementEnPartie', () => {
  const antoine = ligne(ETAT_SEPTEMBRE, 'location-antoine');

  it('saisie de départ : montant vide, date du jour', () => {
    expect(saisieEnPartie(AUJOURDHUI)).toEqual({ montant: '', date: AUJOURDHUI });
  });

  it('un montant lisible, au plus le reste dû, une date passée : le paiement à envoyer', () => {
    expect(paiementEnPartie(antoine, { montant: '300', date: '2026-09-10' }, AUJOURDHUI)).toEqual({
      ok: true,
      paiement: {
        locationId: 'location-antoine',
        periode: '2026-09',
        montant: 30_000,
        date: '2026-09-10',
      },
    });
    expect(paiementEnPartie(antoine, { montant: '430', date: AUJOURDHUI }, AUJOURDHUI).ok).toBe(
      true,
    );
  });

  it('au-delà du reste dû, nul ou illisible : le montant ; futur ou impossible : la date', () => {
    expect(paiementEnPartie(antoine, { montant: '430,01', date: AUJOURDHUI }, AUJOURDHUI)).toEqual({
      ok: false,
      erreurs: ['montant'],
    });
    expect(paiementEnPartie(antoine, { montant: '0', date: AUJOURDHUI }, AUJOURDHUI)).toEqual({
      ok: false,
      erreurs: ['montant'],
    });
    expect(
      paiementEnPartie(antoine, { montant: 'trois cents', date: '2026-09-15' }, AUJOURDHUI),
    ).toEqual({ ok: false, erreurs: ['montant', 'date'] });
    expect(paiementEnPartie(antoine, { montant: '300', date: '2026-02-30' }, AUJOURDHUI)).toEqual({
      ok: false,
      erreurs: ['date'],
    });
  });

  it('après un premier paiement, le reste dû baisse', () => {
    const partiel = ligne(AVEC_PARTIEL_ET_A_VENIR, 'location-antoine');
    expect(paiementEnPartie(partiel, { montant: '330', date: AUJOURDHUI }, AUJOURDHUI).ok).toBe(
      true,
    );
    expect(paiementEnPartie(partiel, { montant: '331', date: AUJOURDHUI }, AUJOURDHUI).ok).toBe(
      false,
    );
  });
});

describe('quittance et reçus d’une ligne', () => {
  it('quittance : loyer reçu par au moins un paiement ; pas pour un loyer nul ni un loyer dû', () => {
    expect(quittancePossible(ligne(ETAT_SEPTEMBRE, 'location-julie'))).toBe(true);
    expect(quittancePossible(ligne(ETAT_SEPTEMBRE, 'location-antoine'))).toBe(false);
    const prete: EtatGestion = {
      ...ETAT_SEPTEMBRE,
      paiements: [],
      locations: [{ ...LOCATION_JULIE, loyerHorsCharges: 0, charges: 0 }],
    };
    expect(quittancePossible(ligne(prete, 'location-julie'))).toBe(false);
  });

  it('reçus : les paiements d’un loyer partiel, rien pour un loyer reçu', () => {
    expect(
      paiementsAvecRecu(ligne(AVEC_PARTIEL_ET_A_VENIR, 'location-antoine')).map((p) => p.id),
    ).toEqual(['paiement-antoine']);
    expect(paiementsAvecRecu(ligne(ETAT_SEPTEMBRE, 'location-julie'))).toEqual([]);
  });
});

describe('textes de la page Loyers', () => {
  it('groupes, reste dû, reçu, erreurs', () => {
    expect(GROUPES_LOYERS_TEXTES).toEqual({
      en_retard: 'En retard',
      partiel: 'Partiels',
      attendu: 'Attendus',
      recu: 'Reçus',
    });
    expect(resteAPayer(40_000).replace(/\s/g, ' ')).toBe('400 € restent');
    expect(recuDe(30_050).replace(/\s/g, ' ')).toBe('Reçu de 300,50 €');
    expect(TEXTES_LOYERS.enPartie).toBe('En partie');
    expect(ERREURS_EN_PARTIE.montant).toContain('ce qui reste dû');
    expect(ERREURS_EN_PARTIE.date).toContain('aujourd’hui');
  });
});
