import { ajouterMois, CHANGEMENTS_MAX, type EtatGestion } from '@loupe/gestion';
import { describe, expect, it } from 'vitest';

import { clientGestionMemoire } from '@/gestion/memoire';
import { modifierEnMemoire, retirerBien } from '@/gestion/memoire-modifications';

import {
  BAILLEUR,
  ETAT_SEPTEMBRE,
  HORODATAGE,
  LOCATION_ANTOINE,
  LOCATION_JULIE,
} from './gestion-exemples';

const AUJOURDHUI = '2026-09-14';

function montants(aPartirDe: string, loyerHorsCharges = 68_000): object {
  return { montants: { aPartirDe, loyerHorsCharges, charges: 5_000, apl: 0 } };
}

describe('modifier une location en mémoire', () => {
  it('montants à partir d’octobre, jour, dépôt ; le même mois remplace ; l’état suit', () => {
    const { donnees, resultat } = modifierEnMemoire(
      ETAT_SEPTEMBRE,
      'location-julie',
      { ...montants('2026-10'), jourLoyer: 10, depot: 65_000 },
      AUJOURDHUI,
    );
    const attendue = {
      ...LOCATION_JULIE,
      jourLoyer: 10,
      depot: 65_000,
      changements: [{ aPartirDe: '2026-10', loyerHorsCharges: 68_000, charges: 5_000, apl: 0 }],
    };
    expect(resultat).toEqual({ ok: true, valeur: attendue });
    expect(donnees.locations).toEqual([attendue, LOCATION_ANTOINE]);
    const encore = modifierEnMemoire(
      donnees,
      'location-julie',
      montants('2026-10', 69_000),
      AUJOURDHUI,
    );
    expect(encore.donnees.locations[0]?.changements).toEqual([
      { aPartirDe: '2026-10', loyerHorsCharges: 69_000, charges: 5_000, apl: 0 },
    ]);
  });

  it('refus : invalide, introuvable, mois payé, hors location, chambre déjà prise ; rien ne change', () => {
    const etat: EtatGestion = {
      ...ETAT_SEPTEMBRE,
      locations: [
        { ...LOCATION_JULIE, libelle: 'Chambre 1' },
        { ...LOCATION_JULIE, id: 'chambre-2', libelle: 'Chambre 2' },
        LOCATION_ANTOINE,
      ],
    };
    const essayer = (locationId: string, modification: unknown): unknown =>
      modifierEnMemoire(etat, locationId, modification, AUJOURDHUI).resultat;
    expect(essayer('location-julie', {})).toEqual({ ok: false, code: 'invalide' });
    expect(essayer('inconnue', { jourLoyer: 10 })).toEqual({ ok: false, code: 'introuvable' });
    // Septembre est payé (paiement de Julie).
    expect(essayer('location-julie', montants('2026-09'))).toEqual({
      ok: false,
      code: 'periode_payee',
    });
    expect(essayer('location-julie', montants('2025-09'))).toEqual({ ok: false, code: 'invalide' });
    expect(essayer('location-julie', { libelle: 'Chambre 2' })).toEqual({
      ok: false,
      code: 'bien_occupe',
    });
    expect(
      modifierEnMemoire(etat, 'location-julie', { libelle: 'Chambre 2' }, AUJOURDHUI).donnees,
    ).toBe(etat);
  });

  it('libellé : remplacé, retiré par null ; une chambre libérée avant ne chevauche pas', () => {
    const etat: EtatGestion = {
      ...ETAT_SEPTEMBRE,
      locations: [
        { ...LOCATION_JULIE, libelle: 'Chambre 1', fin: '2026-06-30' },
        { ...LOCATION_JULIE, id: 'chambre-2', libelle: 'Chambre 2', debut: '2026-07-01' },
      ],
    };
    const chambre2 = modifierEnMemoire(
      etat,
      'location-julie',
      { libelle: 'Chambre 2' },
      AUJOURDHUI,
    );
    expect(chambre2.resultat).toMatchObject({ ok: true, valeur: { libelle: 'Chambre 2' } });
    const sans = modifierEnMemoire(etat, 'location-julie', { libelle: null }, AUJOURDHUI).resultat;
    if (!sans.ok) throw new Error('modification attendue');
    expect(sans.valeur).not.toHaveProperty('libelle');
  });

  it('borne contre les abus : un changement de trop est refusé (limite), le même mois reste remplaçable', () => {
    const changements = Array.from({ length: CHANGEMENTS_MAX }, (_, i) => ({
      aPartirDe: ajouterMois('2010-01', i),
      loyerHorsCharges: 65_000,
      charges: 5_000,
      apl: 0,
    }));
    const etat: EtatGestion = {
      ...ETAT_SEPTEMBRE,
      paiements: [],
      locations: [{ ...LOCATION_JULIE, debut: '2010-01-01', changements }, LOCATION_ANTOINE],
    };
    expect(
      modifierEnMemoire(etat, 'location-julie', montants('2026-10'), AUJOURDHUI).resultat,
    ).toEqual({ ok: false, code: 'limite' });
    expect(
      modifierEnMemoire(etat, 'location-julie', montants('2015-06'), AUJOURDHUI).resultat.ok,
    ).toBe(true);
  });
});

describe('supprimer un bien en mémoire', () => {
  it('retire le bien, ses locations, paiements, documents et locataires sans autre location', () => {
    const document = {
      type: 'quittance' as const,
      numero: 'Q-202609-LOCATION',
      periode: '2026-09',
      emisLe: HORODATAGE,
    };
    const etat: EtatGestion = {
      ...ETAT_SEPTEMBRE,
      documents: [
        { ...document, id: 'd1', locationId: 'location-julie' },
        { ...document, id: 'd2', locationId: 'location-antoine' },
      ],
    };
    const apres = retirerBien(etat, 'bien-lices');
    expect(apres.biens.map((b) => b.id)).toEqual(['bien-baille']);
    expect(apres.locations).toEqual([LOCATION_ANTOINE]);
    expect(apres.locataires.map((l) => l.id)).toEqual(['locataire-antoine']);
    expect(apres.paiements).toEqual([]);
    expect(apres.documents.map((d) => d.id)).toEqual(['d2']);
  });

  it('client mémoire : modifier, supprimer ; le contenu d’un document supprimé ne se relit plus', async () => {
    const client = clientGestionMemoire({ etat: { ...ETAT_SEPTEMBRE, bailleur: BAILLEUR } });
    const julie = await client.emettreDocument({
      type: 'quittance',
      locationId: 'location-julie',
      periode: '2026-09',
    });
    const paye = await client.payer({
      locationId: 'location-antoine',
      periode: '2026-09',
      montant: 43_000,
      date: '2026-09-14',
    });
    expect(paye.ok).toBe(true);
    const antoine = await client.emettreDocument({
      type: 'quittance',
      locationId: 'location-antoine',
      periode: '2026-09',
    });
    if (!julie.ok || !antoine.ok) throw new Error('quittances attendues');

    expect((await client.modifierLocation('location-julie', { jourLoyer: 10 })).ok).toBe(true);
    expect(client.donnees().locations[0]?.jourLoyer).toBe(10);
    expect(await client.supprimerBien('bien-lices')).toEqual({ ok: true, valeur: undefined });
    expect(await client.supprimerBien('bien-lices')).toEqual({ ok: false, code: 'introuvable' });
    expect(await client.document(julie.valeur.id)).toEqual({ ok: false, code: 'introuvable' });
    expect((await client.document(antoine.valeur.id)).ok).toBe(true);
    expect(client.appels).toContain('modifierLocation');
  });
});
