import { describe, expect, it } from 'vitest';

import { clientGestionMemoire, ETAT_GESTION_VIDE } from '@/gestion/memoire';

import { CREATION_LOUEE, CREATION_VACANTE, ETAT_SEPTEMBRE } from './gestion-exemples';

const PAIEMENT = {
  locationId: 'location-antoine',
  periode: '2026-09',
  montant: 43_000,
  date: '2026-09-14',
};

describe('clientGestionMemoire', () => {
  it('part vide par défaut et rend son état', async () => {
    const client = clientGestionMemoire();
    expect(await client.etat()).toEqual({ ok: true, valeur: ETAT_GESTION_VIDE });
    expect(client.appels).toEqual(['etat']);
  });

  it('crée un bien loué puis un bien vacant, avec des identifiants et l’horodatage', async () => {
    const client = clientGestionMemoire({ maintenant: '2026-09-14T10:00:00.000Z' });
    const louee = await client.creer(CREATION_LOUEE);
    expect(louee).toMatchObject({
      ok: true,
      valeur: {
        bien: { id: 'bien-1', nom: 'Coloc Rouet', creeLe: '2026-09-14T10:00:00.000Z' },
        locataire: { id: 'locataire-2', prenom: 'Léa' },
        location: { id: 'location-3', bienId: 'bien-1', locataireId: 'locataire-2' },
      },
    });
    const vacante = await client.creer(CREATION_VACANTE);
    expect(vacante).toMatchObject({ ok: true, valeur: { locataire: null, location: null } });
    expect(client.donnees().biens).toHaveLength(2);
    expect(client.donnees().locataires).toHaveLength(1);
    expect(client.donnees().locations).toHaveLength(1);
  });

  it('refuse une création invalide sans rien garder', async () => {
    const client = clientGestionMemoire();
    const r = await client.creer({ ...CREATION_LOUEE, location: null });
    expect(r).toEqual({ ok: false, code: 'invalide' });
    expect(client.donnees().biens).toEqual([]);
  });

  it('paie : invalide, location inconnue, déjà reçu, autre mois accepté', async () => {
    const client = clientGestionMemoire({ etat: ETAT_SEPTEMBRE });
    expect(await client.payer({ ...PAIEMENT, montant: 0 })).toEqual({
      ok: false,
      code: 'invalide',
    });
    expect(await client.payer({ ...PAIEMENT, locationId: 'inconnue' })).toEqual({
      ok: false,
      code: 'introuvable',
    });
    expect(await client.payer({ ...PAIEMENT, locationId: 'location-julie' })).toEqual({
      ok: false,
      code: 'deja_recu',
    });
    const octobre = await client.payer({
      ...PAIEMENT,
      locationId: 'location-julie',
      periode: '2026-10',
    });
    expect(octobre.ok).toBe(true);
    const septembre = await client.payer(PAIEMENT);
    expect(septembre).toMatchObject({ ok: true, valeur: { source: 'manuel', montant: 43_000 } });
    expect(client.donnees().paiements).toHaveLength(3);
  });

  it('annule un paiement existant, sinon introuvable', async () => {
    const client = clientGestionMemoire({ etat: ETAT_SEPTEMBRE });
    expect(await client.annulerPaiement('paiement-julie')).toEqual({ ok: true, valeur: undefined });
    expect(client.donnees().paiements).toEqual([]);
    expect(await client.annulerPaiement('paiement-julie')).toEqual({
      ok: false,
      code: 'introuvable',
    });
  });

  it('enregistre le menu, refuse de tout masquer', async () => {
    const client = clientGestionMemoire();
    expect(await client.enregistrerPreferences({ analyser: false, gerer: true })).toEqual({
      ok: true,
      valeur: { analyser: false, gerer: true },
    });
    expect(client.donnees().preferences).toEqual({ analyser: false, gerer: true });
    expect(await client.enregistrerPreferences({ analyser: false, gerer: false })).toEqual({
      ok: false,
      code: 'invalide',
    });
  });

  it('une erreur forcée remplace le résultat et l’appel est compté', async () => {
    const client = clientGestionMemoire({ erreurs: { etat: 'indisponible', payer: 'reseau' } });
    expect(await client.etat()).toEqual({ ok: false, code: 'indisponible' });
    expect(await client.payer(PAIEMENT)).toEqual({ ok: false, code: 'reseau' });
    expect(client.appels).toEqual(['etat', 'payer']);
  });
});
