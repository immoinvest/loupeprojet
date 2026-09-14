import type { EtatGestion } from '@loupe/gestion';
import { describe, expect, it } from 'vitest';

import { clientGestionMemoire, ETAT_GESTION_VIDE } from '@/gestion/memoire';

import {
  BAILLEUR,
  CREATION_LOUEE,
  CREATION_VACANTE,
  ETAT_SEPTEMBRE,
  HORODATAGE,
  LOCATION_ANTOINE,
  LOCATION_JULIE,
  PAIEMENT_JULIE,
} from './gestion-exemples';

const PAIEMENT = {
  locationId: 'location-antoine',
  periode: '2026-09',
  montant: 43_000,
  date: '2026-09-14',
};
const INVALIDE = { ok: false, code: 'invalide' };
const INTROUVABLE = { ok: false, code: 'introuvable' };
const QUITTANCE_JULIE = {
  type: 'quittance',
  locationId: 'location-julie',
  periode: '2026-09',
} as const;

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

  it('colocation : le locataire en titre, puis les colocataires rattachés à la location', async () => {
    const client = clientGestionMemoire();
    const r = await client.creer({
      ...CREATION_LOUEE,
      colocataires: [{ prenom: 'Hugo', nom: 'Petit' }],
    });
    expect(r).toMatchObject({
      ok: true,
      valeur: {
        locataire: { id: 'locataire-2', prenom: 'Léa' },
        colocataires: [{ id: 'locataire-3', prenom: 'Hugo' }],
        location: { id: 'location-4', locataireId: 'locataire-2', colocataireIds: ['locataire-3'] },
      },
    });
    expect(client.donnees().locataires.map((l) => l.prenom)).toEqual(['Léa', 'Hugo']);
  });

  it('refuse une création invalide sans rien garder', async () => {
    const client = clientGestionMemoire();
    const r = await client.creer({ ...CREATION_LOUEE, location: null });
    expect(r).toEqual({ ok: false, code: 'invalide' });
    expect(client.donnees().biens).toEqual([]);
  });

  it('paie : invalide, location inconnue, hors location, date future, montant de trop, puis accepté', async () => {
    const client = clientGestionMemoire({ etat: ETAT_SEPTEMBRE });
    expect(await client.payer({ ...PAIEMENT, montant: 0 })).toEqual(INVALIDE);
    expect(await client.payer({ ...PAIEMENT, locationId: 'inconnue' })).toEqual(INTROUVABLE);
    // Antoine est entré le 1er octobre 2025 : rien n'est dû en septembre 2025.
    expect(await client.payer({ ...PAIEMENT, periode: '2025-09' })).toEqual(INVALIDE);
    expect(await client.payer({ ...PAIEMENT, date: '2026-09-15' })).toEqual({
      ok: false,
      code: 'date_invalide',
    });
    expect(await client.payer({ ...PAIEMENT, locationId: 'location-julie' })).toEqual({
      ok: false,
      code: 'montant_depasse',
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

  it('identité du bailleur : invalide refusée, puis enregistrée', async () => {
    const client = clientGestionMemoire({ etat: ETAT_SEPTEMBRE });
    expect(await client.emettreDocument(QUITTANCE_JULIE)).toEqual({
      ok: false,
      code: 'bailleur_manquant',
    });
    expect(await client.enregistrerBailleur({ nom: ' ', adresse: 'x' })).toEqual(INVALIDE);
    expect(await client.enregistrerBailleur(BAILLEUR)).toEqual({ ok: true, valeur: BAILLEUR });
    expect(client.donnees().bailleur).toEqual(BAILLEUR);
  });

  it('quittance émise une fois : même document ensuite, listée sans contenu, relue par son id', async () => {
    const client = clientGestionMemoire({ etat: { ...ETAT_SEPTEMBRE, bailleur: BAILLEUR } });
    const r = await client.emettreDocument(QUITTANCE_JULIE);
    if (!r.ok) throw new Error(r.code);
    expect(r.valeur).toMatchObject({
      id: 'document-1',
      type: 'quittance',
      locationId: 'location-julie',
      periode: '2026-09',
      emisLe: '2026-09-14T09:00:00.000Z',
      contenu: {
        emisLe: '2026-09-14',
        locataires: [{ prenom: 'Julie', nom: 'Martin' }],
        total: 70_000,
        mentions: ['pour_acquit'],
      },
    });
    expect(await client.emettreDocument(QUITTANCE_JULIE)).toEqual(r);
    expect(client.donnees().documents).toEqual([
      {
        id: 'document-1',
        type: 'quittance',
        numero: r.valeur.numero,
        locationId: 'location-julie',
        periode: '2026-09',
        emisLe: '2026-09-14T09:00:00.000Z',
      },
    ]);
    expect(await client.document('document-1')).toEqual(r);
    expect(await client.document('inconnu')).toEqual(INTROUVABLE);
    // Le paiement attesté ne s'annule plus.
    expect(await client.annulerPaiement('paiement-julie')).toEqual({
      ok: false,
      code: 'document_emis',
    });
  });

  it('reçu d’une chambre en colocation ; refus : mois non soldé, paiement qui solde, demandes fausses', async () => {
    const coloc: EtatGestion = {
      ...ETAT_SEPTEMBRE,
      bailleur: BAILLEUR,
      locataires: [
        ...ETAT_SEPTEMBRE.locataires,
        { id: 'locataire-lea', prenom: 'Léa', nom: 'Bernard', creeLe: HORODATAGE },
      ],
      locations: [
        LOCATION_JULIE,
        { ...LOCATION_ANTOINE, libelle: 'Chambre 2', colocataireIds: ['locataire-lea'] },
      ],
      paiements: [
        PAIEMENT_JULIE,
        {
          ...PAIEMENT,
          id: 'partiel',
          montant: 20_000,
          date: '2026-09-04',
          source: 'manuel',
          creeLe: HORODATAGE,
        },
      ],
    };
    const client = clientGestionMemoire({ etat: coloc });
    expect(await client.emettreDocument({ type: 'recu', paiementId: 'partiel' })).toMatchObject({
      ok: true,
      valeur: {
        type: 'recu',
        paiementId: 'partiel',
        locationId: 'location-antoine',
        contenu: {
          locataires: [
            { prenom: 'Antoine', nom: 'Dupont' },
            { prenom: 'Léa', nom: 'Bernard' },
          ],
          logement: { nom: 'Studio Baille', libelle: 'Chambre 2' },
          montantRecu: 20_000,
          resteDu: 23_000,
        },
      },
    });
    expect(await client.annulerPaiement('partiel')).toEqual({ ok: false, code: 'document_emis' });

    const quittanceAntoine = {
      type: 'quittance',
      locationId: 'location-antoine',
      periode: '2026-09',
    } as const;
    expect(await client.emettreDocument(quittanceAntoine)).toEqual({
      ok: false,
      code: 'loyer_non_regle',
    });
    expect(await client.emettreDocument({ type: 'recu', paiementId: 'paiement-julie' })).toEqual({
      ok: false,
      code: 'loyer_regle',
    });
    expect(await client.emettreDocument({ type: 'recu', paiementId: 'inconnu' })).toEqual(
      INTROUVABLE,
    );
    expect(await client.emettreDocument({ ...QUITTANCE_JULIE, locationId: 'inconnue' })).toEqual(
      INTROUVABLE,
    );
    // Hors location (Julie est entrée en octobre 2025) et demande illisible.
    expect(await client.emettreDocument({ ...QUITTANCE_JULIE, periode: '2025-09' })).toEqual(
      INVALIDE,
    );
    expect(await client.emettreDocument({ type: 'recu', paiementId: '' })).toEqual(INVALIDE);
  });

  it('un bien disparu : document introuvable ; un document listé ne se relit qu’avec son contenu', async () => {
    const orphelin = clientGestionMemoire({
      etat: { ...ETAT_SEPTEMBRE, bailleur: BAILLEUR, biens: [] },
    });
    expect(await orphelin.emettreDocument(QUITTANCE_JULIE)).toEqual(INTROUVABLE);

    const premier = clientGestionMemoire({ etat: { ...ETAT_SEPTEMBRE, bailleur: BAILLEUR } });
    const r = await premier.emettreDocument(QUITTANCE_JULIE);
    if (!r.ok) throw new Error(r.code);
    const sansContenu = clientGestionMemoire({ etat: premier.donnees() });
    expect(await sansContenu.emettreDocument(QUITTANCE_JULIE)).toEqual(INTROUVABLE);
    const avecContenu = clientGestionMemoire({ etat: premier.donnees(), documents: [r.valeur] });
    expect(await avecContenu.emettreDocument(QUITTANCE_JULIE)).toEqual(r);
    expect(await avecContenu.document(r.valeur.id)).toEqual(r);
  });

  it('fin de location : date illisible, location inconnue, avant l’entrée, loyers reçus après ; puis enregistrée', async () => {
    const client = clientGestionMemoire({ etat: ETAT_SEPTEMBRE });
    expect(await client.terminerLocation('location-julie', '2026-02-30')).toEqual(INVALIDE);
    expect(await client.terminerLocation('inconnue', '2026-12-31')).toEqual(INTROUVABLE);
    expect(await client.terminerLocation('location-julie', '2025-09-30')).toEqual({
      ok: false,
      code: 'fin_avant_entree',
    });
    expect(await client.terminerLocation('location-julie', '2026-08-15')).toEqual({
      ok: false,
      code: 'paiements_apres_sortie',
    });
    const terminee = { ...LOCATION_JULIE, fin: '2026-12-31' };
    expect(await client.terminerLocation('location-julie', '2026-12-31')).toEqual({
      ok: true,
      valeur: terminee,
    });
    expect(client.donnees().locations).toEqual([terminee, LOCATION_ANTOINE]);
  });

  it('une erreur forcée remplace le résultat et l’appel est compté', async () => {
    const client = clientGestionMemoire({ erreurs: { etat: 'indisponible', payer: 'reseau' } });
    expect(await client.etat()).toEqual({ ok: false, code: 'indisponible' });
    expect(await client.payer(PAIEMENT)).toEqual({ ok: false, code: 'reseau' });
    expect(client.appels).toEqual(['etat', 'payer']);
  });
});
