import type { Depense, EtatGestion, LocationGeree } from '@loupe/gestion';
import { describe, expect, it, vi } from 'vitest';

import {
  clientFinBailIndisponible,
  clientFinBailMemoire,
  ETAT_FIN_BAIL_MEMOIRE,
  type ClientFinBailMemoire,
} from '@/gestion/fin-bail/memoire';
import { clientFinBailReseau } from '@/gestion/fin-bail/reseau';
import { clientGestionMemoire } from '@/gestion/memoire';

import { BAILLEUR, ETAT_SEPTEMBRE, JULIE, LOCATION_JULIE } from './gestion-exemples';

const MAINTENANT = '2026-09-14T09:00:00.000Z';
const AVEC_BAILLEUR: EtatGestion = { ...ETAT_SEPTEMBRE, bailleur: BAILLEUR };
const CONGE = { recuLe: '2026-09-05', fin: '2026-10-05', reduit: false };
const TERMINEE: LocationGeree = { ...LOCATION_JULIE, fin: '2026-08-20' };

const COPRO: Depense = {
  id: 'depense-copro',
  bienId: 'bien-lices',
  categorie: 'copropriete',
  montant: 4_500,
  date: '2025-01-10',
  recuperable: true,
  recurrence: { frequence: 'mensuelle' },
  creeLe: MAINTENANT,
  modifieLe: MAINTENANT,
};

function client(
  etat: EtatGestion = AVEC_BAILLEUR,
  depenses: readonly Depense[] = [],
): ClientFinBailMemoire {
  return clientFinBailMemoire({
    gestion: clientGestionMemoire({ etat, maintenant: MAINTENANT }),
    depenses,
    maintenant: MAINTENANT,
  });
}

describe('clientFinBailMemoire : congé et charges', () => {
  it('enregistre le congé et la sortie, le déplace, puis l’annule', async () => {
    const c = client();
    expect(await c.etat()).toEqual({ ok: true, valeur: ETAT_FIN_BAIL_MEMOIRE });
    expect(await c.enregistrerConge(LOCATION_JULIE.id, { ...CONGE, fin: 'hier' })).toEqual({
      ok: false,
      code: 'invalide',
    });
    expect(await c.enregistrerConge('inconnue', CONGE)).toEqual({ ok: false, code: 'introuvable' });

    const r = await c.enregistrerConge(LOCATION_JULIE.id, CONGE);
    if (!r.ok) throw new Error(r.code);
    expect(r.valeur.conge).toEqual({
      locationId: LOCATION_JULIE.id,
      ...CONGE,
      modifieLe: MAINTENANT,
    });
    expect(r.valeur.location.fin).toBe('2026-10-05');
    expect(c.donnees().conges).toHaveLength(1);

    const plusTard = { ...CONGE, fin: '2026-11-30', reduit: true };
    expect((await c.enregistrerConge(LOCATION_JULIE.id, plusTard)).ok).toBe(true);
    expect(c.donnees().conges).toHaveLength(1);

    const retire = await c.retirerConge(LOCATION_JULIE.id);
    if (!retire.ok) throw new Error(retire.code);
    expect(retire.valeur.location.fin).toBeUndefined();
    expect(c.donnees().conges).toEqual([]);
    expect(await c.retirerConge(LOCATION_JULIE.id)).toEqual({ ok: false, code: 'introuvable' });
    expect(await c.retirerConge('inconnue')).toEqual({ ok: false, code: 'introuvable' });
  });

  it('refuse un congé reçu avant l’entrée ou après des loyers reçus', async () => {
    const c = client();
    expect(await c.enregistrerConge(LOCATION_JULIE.id, { ...CONGE, recuLe: '2025-01-01' })).toEqual(
      { ok: false, code: 'conge_invalide' },
    );
    // Le loyer de septembre est déjà reçu : une sortie fin août est refusée.
    expect(
      await c.enregistrerConge(LOCATION_JULIE.id, {
        recuLe: '2026-08-01',
        fin: '2026-08-31',
        reduit: false,
      }),
    ).toEqual({ ok: false, code: 'paiements_apres_sortie' });
  });

  it('mode des charges : provision ou forfait', async () => {
    const c = client();
    expect(await c.enregistrerModeCharges(LOCATION_JULIE.id, 'reel' as never)).toEqual({
      ok: false,
      code: 'invalide',
    });
    expect(await c.enregistrerModeCharges('inconnue', 'forfait')).toEqual({
      ok: false,
      code: 'introuvable',
    });
    expect(await c.enregistrerModeCharges(LOCATION_JULIE.id, 'forfait')).toEqual({
      ok: true,
      valeur: { locationId: LOCATION_JULIE.id, mode: 'forfait', modifieLe: MAINTENANT },
    });
    expect((await c.enregistrerModeCharges(LOCATION_JULIE.id, 'provision')).ok).toBe(true);
    expect(c.donnees().charges).toHaveLength(1);
  });
});

describe('clientFinBailMemoire : dépôt et charges', () => {
  const terminee: EtatGestion = { ...AVEC_BAILLEUR, locations: [TERMINEE], paiements: [] };
  const CLES = { clesLe: '2026-08-20', conforme: true, retenues: [] };

  it('restitue, rend, annule ; refus : corps invalide, location en cours, déjà enregistrée', async () => {
    const c = client(terminee);
    expect(
      await c.restituer(TERMINEE.id, { ...CLES, retenues: [{ motif: '', montant: 1 }] }),
    ).toEqual({
      ok: false,
      code: 'invalide',
    });
    expect(await c.restituer('inconnue', CLES)).toEqual({ ok: false, code: 'introuvable' });
    const enCours = client();
    expect(await enCours.restituer(LOCATION_JULIE.id, CLES)).toEqual({
      ok: false,
      code: 'location_en_cours',
    });
    const sansBailleur = client({ ...ETAT_SEPTEMBRE, locations: [TERMINEE], paiements: [] });
    expect(await sansBailleur.restituer(TERMINEE.id, CLES)).toEqual({
      ok: false,
      code: 'bailleur_manquant',
    });

    const r = await c.restituer(TERMINEE.id, CLES);
    if (!r.ok) throw new Error(r.code);
    expect(r.valeur.restitution).toMatchObject({
      aRendre: 130_000,
      dateLimite: '2026-09-20',
      rendueLe: null,
    });
    expect(r.valeur.decompte.contenu).toMatchObject({
      type: 'restitution',
      locataires: [{ prenom: 'Julie', nom: 'Martin' }],
      logement: { nom: 'T2 Lices' },
    });
    expect(await c.decompte(r.valeur.decompte.id)).toEqual({ ok: true, valeur: r.valeur.decompte });
    expect(await c.restituer(TERMINEE.id, CLES)).toEqual({ ok: false, code: 'deja_enregistre' });

    expect(await c.rendreDepot(TERMINEE.id, 'demain')).toEqual({ ok: false, code: 'invalide' });
    expect(await c.rendreDepot('inconnue', '2026-09-01')).toEqual({
      ok: false,
      code: 'introuvable',
    });
    expect(await c.rendreDepot(TERMINEE.id, '2026-09-30')).toEqual({
      ok: false,
      code: 'date_invalide',
    });
    expect(await c.rendreDepot(TERMINEE.id, '2026-08-01')).toEqual({
      ok: false,
      code: 'date_invalide',
    });
    const rendu = await c.rendreDepot(TERMINEE.id, '2026-09-01');
    expect(rendu).toMatchObject({ ok: true, valeur: { rendueLe: '2026-09-01' } });
    expect(await c.annulerRestitution(TERMINEE.id)).toEqual({ ok: false, code: 'depot_rendu' });
    expect(await c.annulerRestitution('inconnue')).toEqual({ ok: false, code: 'introuvable' });
  });

  it('annuler efface la restitution et son décompte', async () => {
    const c = client(terminee);
    const r = await c.restituer(TERMINEE.id, {
      clesLe: '2026-08-20',
      conforme: false,
      retenues: [{ motif: 'Peinture', montant: 12_000 }],
    });
    if (!r.ok) throw new Error(r.code);
    expect(r.valeur.restitution.aRendre).toBe(118_000);
    expect(await c.annulerRestitution(TERMINEE.id)).toEqual({ ok: true, valeur: undefined });
    expect(c.donnees().restitutions).toEqual([]);
    expect(c.donnees().decomptes).toEqual([]);
    expect(await c.decompte(r.valeur.decompte.id)).toEqual({ ok: false, code: 'introuvable' });
  });

  it('plusieurs locations : chacune garde sa restitution et sa régularisation ; la chambre est nommée', async () => {
    const chambre: LocationGeree = {
      ...TERMINEE,
      id: 'location-chambre',
      libelle: 'Chambre 2',
    };
    const c = client({ ...AVEC_BAILLEUR, locations: [TERMINEE, chambre], paiements: [] }, [COPRO]);
    const premiere = await c.restituer(TERMINEE.id, CLES);
    const seconde = await c.restituer(chambre.id, CLES);
    if (!seconde.ok) throw new Error(seconde.code);
    expect(seconde.valeur.decompte.contenu.logement).toMatchObject({ libelle: 'Chambre 2' });
    expect((await c.rendreDepot(chambre.id, '2026-09-01')).ok).toBe(true);
    expect(c.donnees().restitutions.map((r) => r.rendueLe)).toEqual([null, '2026-09-01']);
    expect(premiere.ok).toBe(true);

    const uneAnnee = await c.regulariser(TERMINEE.id, 2025);
    const autreAnnee = await c.regulariser(chambre.id, 2025);
    if (!autreAnnee.ok || !uneAnnee.ok) throw new Error('régularisation refusée');
    expect(
      (await c.reglerRegularisation(autreAnnee.valeur.regularisation.id, '2026-09-14')).ok,
    ).toBe(true);
    expect(c.donnees().regularisations.map((r) => r.regleeLe)).toEqual([null, '2026-09-14']);
  });

  it('régularise 2025, refuse l’année en cours, le forfait, l’absence de dépense et la seconde fois', async () => {
    const c = client(AVEC_BAILLEUR, [COPRO]);
    expect(await c.regulariser('inconnue', 2025)).toEqual({ ok: false, code: 'introuvable' });
    expect(await c.regulariser(LOCATION_JULIE.id, 2026)).toEqual({
      ok: false,
      code: 'regularisation_impossible',
    });
    const sansDepense = client();
    expect(await sansDepense.regulariser(LOCATION_JULIE.id, 2025)).toEqual({
      ok: false,
      code: 'regularisation_impossible',
    });

    const r = await c.regulariser(LOCATION_JULIE.id, 2025);
    if (!r.ok) throw new Error(r.code);
    expect(r.valeur.regularisation).toMatchObject({ annee: 2025, solde: -1_389, regleeLe: null });
    expect(r.valeur.decompte.contenu).toMatchObject({ type: 'regularisation', provisions: 15_000 });
    expect(await c.regulariser(LOCATION_JULIE.id, 2025)).toEqual({
      ok: false,
      code: 'deja_enregistre',
    });

    // Charges au forfait : plus rien à régulariser.
    const forfait = client(AVEC_BAILLEUR, [COPRO]);
    expect((await forfait.enregistrerModeCharges(LOCATION_JULIE.id, 'forfait')).ok).toBe(true);
    expect(await forfait.regulariser(LOCATION_JULIE.id, 2025)).toEqual({
      ok: false,
      code: 'regularisation_impossible',
    });

    const { id } = r.valeur.regularisation;
    expect(await c.reglerRegularisation('inconnue', '2026-09-14')).toEqual({
      ok: false,
      code: 'introuvable',
    });
    expect(await c.reglerRegularisation(id, '2026-09-30')).toEqual({
      ok: false,
      code: 'date_invalide',
    });
    expect(await c.reglerRegularisation(id, '2026-09-14')).toMatchObject({
      ok: true,
      valeur: { regleeLe: '2026-09-14' },
    });
  });

  it('sans bailleur, la régularisation s’arrête avant le décompte', async () => {
    const c = clientFinBailMemoire({
      gestion: clientGestionMemoire({ etat: ETAT_SEPTEMBRE, maintenant: MAINTENANT }),
      depenses: [COPRO],
      maintenant: MAINTENANT,
    });
    expect(await c.regulariser(LOCATION_JULIE.id, 2025)).toEqual({
      ok: false,
      code: 'bailleur_manquant',
    });
  });
});

describe('clientFinBailMemoire : colocataires, erreurs et client indisponible', () => {
  it('un départ et une arrivée : la location suit, les mouvements sont notés', async () => {
    const bail = { ...LOCATION_JULIE, colocataireIds: ['locataire-antoine'] };
    const c = client({ ...AVEC_BAILLEUR, locations: [bail] });
    expect(await c.changerColocataire(bail.id, {})).toEqual({ ok: false, code: 'invalide' });
    expect(
      await c.changerColocataire('inconnue', {
        arrivee: { locataire: { prenom: 'Hugo', nom: 'Petit' }, date: '2026-09-15' },
      }),
    ).toEqual({ ok: false, code: 'introuvable' });
    expect(
      await c.changerColocataire(bail.id, {
        depart: { locataireId: 'inconnu', date: '2026-09-15' },
      }),
    ).toEqual({ ok: false, code: 'colocataire_refuse' });

    const r = await c.changerColocataire(bail.id, {
      depart: { locataireId: JULIE.id, date: '2026-09-15' },
      arrivee: { locataire: { prenom: 'Hugo', nom: 'Petit' }, date: '2026-09-16' },
    });
    if (!r.ok) throw new Error(r.code);
    expect(r.valeur.locataire).toMatchObject({ prenom: 'Hugo', nom: 'Petit' });
    expect(r.valeur.location.colocataireIds).toHaveLength(2);
    expect(r.valeur.mouvements.map((m) => m.sens)).toEqual(['depart', 'arrivee']);
    expect(c.donnees().mouvements).toHaveLength(2);
  });

  it('sans client de gestion : location introuvable ; une erreur forcée ; tout indisponible', async () => {
    const seul = clientFinBailMemoire({ maintenant: MAINTENANT });
    expect(await seul.enregistrerConge(LOCATION_JULIE.id, CONGE)).toEqual({
      ok: false,
      code: 'introuvable',
    });
    const force = clientFinBailMemoire({ erreurs: { etat: 'reseau' } });
    expect(await force.etat()).toEqual({ ok: false, code: 'reseau' });
    expect(force.appels).toEqual(['etat']);

    // Gestion en panne : aucune location connue, donc rien à écrire.
    const gestionEnPanne = clientFinBailMemoire({
      gestion: clientGestionMemoire({ erreurs: { etat: 'reseau' } }),
    });
    expect(await gestionEnPanne.enregistrerConge(LOCATION_JULIE.id, CONGE)).toEqual({
      ok: false,
      code: 'introuvable',
    });

    const indisponible = { ok: false, code: 'indisponible' };
    expect(await clientFinBailIndisponible.etat()).toEqual(indisponible);
    expect(await clientFinBailIndisponible.enregistrerConge('l1', CONGE)).toEqual(indisponible);
    expect(await clientFinBailIndisponible.retirerConge('l1')).toEqual(indisponible);
    expect(await clientFinBailIndisponible.enregistrerModeCharges('l1', 'forfait')).toEqual(
      indisponible,
    );
    expect(
      await clientFinBailIndisponible.restituer('l1', {
        clesLe: 'x',
        conforme: true,
        retenues: [],
      }),
    ).toEqual(indisponible);
    expect(await clientFinBailIndisponible.rendreDepot('l1', 'x')).toEqual(indisponible);
    expect(await clientFinBailIndisponible.annulerRestitution('l1')).toEqual(indisponible);
    expect(await clientFinBailIndisponible.regulariser('l1', 2025)).toEqual(indisponible);
    expect(await clientFinBailIndisponible.reglerRegularisation('r1', 'x')).toEqual(indisponible);
    expect(await clientFinBailIndisponible.changerColocataire('l1', {})).toEqual(indisponible);
    expect(await clientFinBailIndisponible.decompte('d1')).toEqual(indisponible);
  });
});

describe('clientFinBailReseau', () => {
  const reponse = (corps: unknown, status = 200): Response =>
    new Response(JSON.stringify(corps), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  it('appelle les bonnes adresses et revalide les réponses', async () => {
    const appels: { url: string; methode: string; corps: unknown }[] = [];
    const c = clientFinBailReseau((url, init) => {
      appels.push({
        url,
        methode: init?.method ?? 'GET',
        corps: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
      });
      if (url.endsWith('/restitution') && init?.method === 'DELETE') {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(reponse(ETAT_FIN_BAIL_MEMOIRE));
    });
    expect(await c.etat()).toEqual({ ok: true, valeur: ETAT_FIN_BAIL_MEMOIRE });
    expect(await c.annulerRestitution('l 1')).toEqual({ ok: true, valeur: undefined });
    // Une réponse qui ne correspond pas au schéma attendu est refusée.
    expect(await c.rendreDepot('l1', '2026-09-01')).toEqual({ ok: false, code: 'inconnue' });
    expect(appels.map((a) => `${a.methode} ${a.url}`)).toEqual([
      'GET /api/gestion/fin-bail',
      'DELETE /api/gestion/fin-bail/locations/l%201/restitution',
      'POST /api/gestion/fin-bail/locations/l1/restitution/rendue',
    ]);
    expect(appels[2]?.corps).toEqual({ rendueLe: '2026-09-01' });
  });

  it('traduit les codes du serveur, les pannes et les réponses illisibles', async () => {
    const code = async (corps: unknown, status: number): Promise<string> => {
      const c = clientFinBailReseau(() => Promise.resolve(reponse(corps, status)));
      const r = await c.etat();
      return r.ok ? 'ok' : r.code;
    };
    expect(await code({ code: 'FIN_BAIL_INDISPONIBLE' }, 503)).toBe('indisponible');
    expect(await code({ code: 'COLOCATAIRE_REFUSE' }, 409)).toBe('colocataire_refuse');
    expect(await code({ code: 'INCONNU' }, 418)).toBe('inconnue');
    expect(await code({ code: 'INCONNU' }, 500)).toBe('indisponible');
    expect(await code('pas du json', 400)).toBe('inconnue');

    const enPanne = clientFinBailReseau(() => Promise.reject(new Error('hors ligne')));
    expect(await enPanne.etat()).toEqual({ ok: false, code: 'reseau' });

    // Un 204 là où une réponse est attendue : le schéma refuse, la réponse est « inconnue ».
    const vide = clientFinBailReseau(() => Promise.resolve(new Response(null, { status: 204 })));
    expect(await vide.rendreDepot('l1', '2026-09-01')).toEqual({ ok: false, code: 'inconnue' });
  });

  it('sans récupérateur fourni, il passe par fetch', async () => {
    const appels: string[] = [];
    vi.stubGlobal('fetch', (url: string) => {
      appels.push(url);
      return Promise.resolve(reponse(ETAT_FIN_BAIL_MEMOIRE));
    });
    expect(await clientFinBailReseau().etat()).toEqual({ ok: true, valeur: ETAT_FIN_BAIL_MEMOIRE });
    expect(appels).toEqual(['/api/gestion/fin-bail']);
    vi.unstubAllGlobals();
  });

  it('chaque action a sa route', async () => {
    const urls: string[] = [];
    const c = clientFinBailReseau((url, init) => {
      urls.push(`${init?.method ?? 'GET'} ${url}`);
      return Promise.resolve(reponse({ code: 'INTROUVABLE' }, 404));
    });
    await c.enregistrerConge('l1', CONGE);
    await c.retirerConge('l1');
    await c.enregistrerModeCharges('l1', 'forfait');
    await c.restituer('l1', { clesLe: '2026-08-20', conforme: true, retenues: [] });
    await c.regulariser('l1', 2025);
    await c.reglerRegularisation('r1', '2026-09-14');
    await c.changerColocataire('l1', { depart: { locataireId: 'x', date: '2026-09-14' } });
    await c.decompte('d1');
    expect(urls).toEqual([
      'PUT /api/gestion/fin-bail/locations/l1/conge',
      'DELETE /api/gestion/fin-bail/locations/l1/conge',
      'PUT /api/gestion/fin-bail/locations/l1/charges',
      'POST /api/gestion/fin-bail/locations/l1/restitution',
      'POST /api/gestion/fin-bail/locations/l1/regularisations',
      'POST /api/gestion/fin-bail/regularisations/r1/reglee',
      'POST /api/gestion/fin-bail/locations/l1/colocataires',
      'GET /api/gestion/fin-bail/decomptes/d1',
    ]);
  });
});
