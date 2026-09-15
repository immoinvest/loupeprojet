import type { EtatGestion, Locataire } from '@loupe/gestion';
import { describe, expect, it } from 'vitest';

import { actionsAFaire, cleAction } from '@/gestion/a-faire';
import {
  ajouterEmailDe,
  louerLeBien,
  loyerEnRetardDe,
  voirLesAutres,
} from '@/textes/gerer-a-faire';

import {
  BIEN_LICES,
  ETAT_SEPTEMBRE,
  HORODATAGE,
  LOCATION_ANTOINE,
  LOCATION_JULIE,
  PAIEMENT_JULIE,
} from './gestion-exemples';

const AUJOURDHUI = '2026-09-14';

const LEA: Locataire = { id: 'locataire-lea', prenom: 'Léa', nom: 'Bernard', creeLe: HORODATAGE };
const HUGO: Locataire = { id: 'locataire-hugo', prenom: 'Hugo', nom: 'Petit', creeLe: HORODATAGE };

function resume(donnees: EtatGestion): string[] {
  return actionsAFaire(donnees, AUJOURDHUI).map(cleAction);
}

describe('actionsAFaire', () => {
  it('retards, puis biens vacants, puis e-mails manquants', () => {
    const donnees: EtatGestion = {
      ...ETAT_SEPTEMBRE,
      biens: [...ETAT_SEPTEMBRE.biens, { ...BIEN_LICES, id: 'parking', nom: 'Parking Prado' }],
    };
    expect(resume(donnees)).toEqual([
      'retard-location-antoine',
      'vacant-parking',
      'email-locataire-antoine',
    ]);
    const [retard, vacant, email] = actionsAFaire(donnees, AUJOURDHUI);
    expect(retard).toMatchObject({ type: 'retard', ligne: { statut: 'en_retard' } });
    expect(vacant).toMatchObject({ type: 'vacant', bien: { nom: 'Parking Prado' } });
    expect(email).toMatchObject({ type: 'email', locataire: { prenom: 'Antoine' } });
  });

  it('vacants par nom naturel ; entrée à venir ni vacante ni sans e-mail oubliée ; ancien locataire ignoré', () => {
    const donnees: EtatGestion = {
      ...ETAT_SEPTEMBRE,
      biens: [
        ...ETAT_SEPTEMBRE.biens,
        { ...BIEN_LICES, id: 'p10', nom: 'Parking 10' },
        { ...BIEN_LICES, id: 'p2', nom: 'Parking 2' },
        { ...BIEN_LICES, id: 'neuf', nom: 'Studio neuf' },
      ],
      locataires: [...ETAT_SEPTEMBRE.locataires, LEA, HUGO],
      locations: [
        LOCATION_JULIE,
        // Antoine a payé et est parti fin août : plus rien à faire pour lui.
        { ...LOCATION_ANTOINE, fin: '2026-08-31' },
        // Léa arrive en octobre sans e-mail ; Hugo a quitté le parking 2 en juin, sans e-mail.
        {
          ...LOCATION_JULIE,
          id: 'future',
          bienId: 'neuf',
          locataireId: LEA.id,
          debut: '2026-10-01',
        },
        {
          ...LOCATION_JULIE,
          id: 'ancienne',
          bienId: 'p2',
          locataireId: HUGO.id,
          fin: '2026-06-30',
        },
      ],
      paiements: [PAIEMENT_JULIE],
    };
    expect(resume(donnees)).toEqual([
      'vacant-p2',
      'vacant-p10',
      'vacant-bien-baille',
      'email-locataire-lea',
    ]);
  });

  it('les prêts à enregistrer viennent après les biens vacants, avant les e-mails', () => {
    const donnees: EtatGestion = {
      ...ETAT_SEPTEMBRE,
      biens: [...ETAT_SEPTEMBRE.biens, { ...BIEN_LICES, id: 'parking', nom: 'Parking Prado' }],
    };
    const actions = actionsAFaire(donnees, AUJOURDHUI, [BIEN_LICES]);
    expect(actions.map(cleAction)).toEqual([
      'retard-location-antoine',
      'vacant-parking',
      'pret-bien-lices',
      'email-locataire-antoine',
    ]);
    expect(actions[2]).toEqual({ type: 'pret', bien: BIEN_LICES });
  });

  it('tout va bien : rien à faire', () => {
    const donnees: EtatGestion = {
      ...ETAT_SEPTEMBRE,
      biens: [BIEN_LICES],
      locataires: ETAT_SEPTEMBRE.locataires.filter((l) => l.email !== undefined),
      locations: [LOCATION_JULIE],
    };
    expect(actionsAFaire(donnees, AUJOURDHUI)).toEqual([]);
  });
});

describe('textes de « À faire »', () => {
  it('élision et nombre', () => {
    expect(loyerEnRetardDe('Antoine')).toBe('Loyer d’Antoine en retard');
    expect(loyerEnRetardDe('Julie')).toBe('Loyer de Julie en retard');
    expect(louerLeBien('Parking Prado')).toBe('Louer Parking Prado');
    expect(ajouterEmailDe('Julie Martin')).toBe('Ajouter l’e-mail de Julie Martin');
    expect(ajouterEmailDe('Antoine Dupont')).toBe('Ajouter l’e-mail d’Antoine Dupont');
    expect(voirLesAutres(1)).toBe('Voir l’autre');
    expect(voirLesAutres(2)).toBe('Voir les 2 autres');
  });
});
