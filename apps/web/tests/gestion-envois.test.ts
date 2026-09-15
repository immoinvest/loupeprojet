import type { DocumentGestion, Envoi, EtatEnvois } from '@loupe/gestion';
import { afterEach, describe, expect, it } from 'vitest';

import {
  accordDe,
  actionsEnvois,
  bailleurDuBien,
  jetonDuFragment,
  lireAccordsVus,
  marquerAccordVu,
  quittancePartira,
  SANS_ACTIONS_ENVOIS,
  stockageLocal,
  telephoneDe,
  telephoneDepuisSaisie,
  traceDuLoyer,
} from '@/gestion/envois/logique';
import {
  clientAccordMemoire,
  clientEnvoisIndisponible,
  clientEnvoisMemoire,
  ETAT_ENVOIS_VIDE,
} from '@/gestion/envois/memoire';
import { clientAccordReseau, clientEnvoisReseau } from '@/gestion/envois/reseau';

import { JETON } from './envois-exemples';
import { HORODATAGE, STOCKAGE_EN_PANNE } from './gestion-exemples';

const ENVOI: Envoi = {
  id: 'envoi-1',
  documentId: 'document-julie',
  locataireId: 'locataire-julie',
  destinataire: 'julie.martin@…',
  statut: 'envoye',
  tentatives: 1,
  dernierEssaiLe: '2026-09-05T08:00:00.000Z',
  envoyeLe: '2026-09-05T08:00:00.000Z',
};

const ETAT: EtatEnvois = {
  mode: 'reel',
  invitations: true,
  accords: [
    { locataireId: 'locataire-julie', statut: 'accorde', le: HORODATAGE },
    { locataireId: 'locataire-lea', statut: 'en_attente', invitationLe: HORODATAGE },
    { locataireId: 'locataire-antoine', statut: 'sans_email' },
  ],
  envois: [ENVOI, { ...ENVOI, id: 'envoi-2', locataireId: 'locataire-lea', statut: 'echec' }],
  contacts: [{ locataireId: 'locataire-julie', telephone: '06 12 34 56 78' }],
  bailleursBiens: [{ bienId: 'bien-lices', type: 'sci', nom: 'SCI Lices', adresse: 'Marseille' }],
};

const DOCUMENT: DocumentGestion = {
  id: 'document-julie',
  type: 'quittance',
  numero: 'Q-202609-LOCATION',
  locationId: 'location-julie',
  periode: '2026-09',
  emisLe: HORODATAGE,
};

afterEach(() => {
  window.localStorage.clear();
});

describe('lectures de l’état des envois', () => {
  it('accord, téléphone, bailleur d’un bien', () => {
    expect(accordDe(ETAT, 'locataire-julie')?.statut).toBe('accorde');
    expect(accordDe(null, 'locataire-julie')).toBeUndefined();
    expect(telephoneDe(ETAT, 'locataire-julie')).toBe('06 12 34 56 78');
    expect(telephoneDe(null, 'x')).toBeUndefined();
    expect(bailleurDuBien(ETAT, 'bien-lices')).toEqual({
      type: 'sci',
      nom: 'SCI Lices',
      adresse: 'Marseille',
    });
    expect(bailleurDuBien(ETAT, 'bien-baille')).toBeUndefined();
  });

  it('la trace d’un loyer : la quittance du mois et ses envois', () => {
    expect(traceDuLoyer(ETAT, [DOCUMENT], 'location-julie', '2026-09')).toEqual({
      document: DOCUMENT,
      envois: [ETAT.envois[0], ETAT.envois[1]],
    });
    expect(traceDuLoyer(ETAT, [DOCUMENT], 'location-julie', '2026-08')).toBeNull();
    expect(traceDuLoyer(null, [DOCUMENT], 'location-julie', '2026-09')).toBeNull();
    expect(
      traceDuLoyer(ETAT, [{ ...DOCUMENT, type: 'recu' }], 'location-julie', '2026-09'),
    ).toBeNull();
    expect(
      traceDuLoyer({ ...ETAT, envois: [] }, [DOCUMENT], 'location-julie', '2026-09'),
    ).toBeNull();
  });

  it('la quittance partira si un locataire du bail a un accord valide et que les envois sont actifs', () => {
    const bail = { locataireId: 'locataire-antoine', colocataireIds: ['locataire-julie'] };
    expect(quittancePartira(ETAT, bail)).toBe(true);
    expect(quittancePartira(ETAT, { locataireId: 'locataire-lea', colocataireIds: [] })).toBe(
      false,
    );
    expect(quittancePartira(ETAT, { locataireId: 'inconnu', colocataireIds: [] })).toBe(false);
    expect(quittancePartira({ ...ETAT, mode: 'inactif' }, bail)).toBe(false);
    expect(quittancePartira(null, bail)).toBe(false);
  });

  it('« À faire » : accords en attente pas encore vus, adresses à vérifier', () => {
    expect(actionsEnvois(ETAT, [])).toEqual({
      enAttente: ['locataire-lea'],
      aVerifier: ['locataire-lea'],
    });
    expect(actionsEnvois(ETAT, ['locataire-lea']).enAttente).toEqual([]);
    expect(actionsEnvois(null, [])).toBe(SANS_ACTIONS_ENVOIS);
  });
});

describe('accords vus (une seule fois)', () => {
  it('garde les identifiants vus sans doublon, résiste à un stockage abîmé ou en panne', () => {
    const stockage = stockageLocal();
    expect(stockage).toBe(window.localStorage);
    expect(lireAccordsVus(stockage)).toEqual([]);
    marquerAccordVu(stockage, 'a');
    marquerAccordVu(stockage, 'a');
    marquerAccordVu(stockage, 'b');
    expect(lireAccordsVus(stockage)).toEqual(['a', 'b']);
    window.localStorage.setItem('deklic.gerer.accords-vus.v1', '{abîmé');
    expect(lireAccordsVus(stockage)).toEqual([]);
    window.localStorage.setItem('deklic.gerer.accords-vus.v1', '{"a":1}');
    expect(lireAccordsVus(stockage)).toEqual([]);
    window.localStorage.setItem('deklic.gerer.accords-vus.v1', '["a",2]');
    expect(lireAccordsVus(stockage)).toEqual(['a']);
    expect(lireAccordsVus(undefined)).toEqual([]);
    expect(lireAccordsVus(STOCKAGE_EN_PANNE)).toEqual([]);
    expect(() => {
      marquerAccordVu(STOCKAGE_EN_PANNE, 'c');
    }).not.toThrow();
  });
});

describe('saisies', () => {
  it('téléphone : vide, plausible, invalide', () => {
    expect(telephoneDepuisSaisie('  ')).toEqual({ ok: true, telephone: null });
    expect(telephoneDepuisSaisie(' 06 12 34 56 78 ')).toEqual({
      ok: true,
      telephone: '06 12 34 56 78',
    });
    expect(telephoneDepuisSaisie('appelle-moi')).toEqual({ ok: false });
  });

  it('jeton du fragment', () => {
    expect(jetonDuFragment(`#${JETON}`)).toBe(JETON);
    expect(jetonDuFragment('')).toBeNull();
    expect(jetonDuFragment('#abc')).toBeNull();
  });
});

interface Appel {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

function recuperateur(reponse: () => Response): {
  appels: Appel[];
  recuperer: (url: string, init?: RequestInit) => Promise<Response>;
} {
  const appels: Appel[] = [];
  return {
    appels,
    recuperer: (url, init) => {
      appels.push({ url, init });
      return Promise.resolve(reponse());
    },
  };
}

const json = (corps: unknown, status = 200): Response =>
  new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } });

describe('client réseau des envois', () => {
  it('chemins, méthodes et corps ; réponses revalidées', async () => {
    const r = recuperateur(() => json(ETAT));
    const client = clientEnvoisReseau(r.recuperer);
    expect(await client.etat()).toEqual({ ok: true, valeur: ETAT });
    await client.declarerAccord('a/b');
    await client.inviter('x');
    await client.enregistrerContact('x', null);
    await client.enregistrerBailleurBien('bien', null);
    await client.renvoyer('d');
    expect(
      r.appels.map(
        (a) =>
          `${String(a.init?.method)} ${a.url} ${typeof a.init?.body === 'string' ? a.init.body : 'undefined'}`,
      ),
    ).toEqual([
      'GET /api/gestion/envois undefined',
      'POST /api/gestion/envois/locataires/a%2Fb/accord {}',
      'POST /api/gestion/envois/locataires/x/invitation {}',
      'PUT /api/gestion/envois/locataires/x/contact {"telephone":null}',
      'PUT /api/gestion/envois/biens/bien/bailleur {"bailleur":null}',
      'POST /api/gestion/envois/documents/d/renvoyer {}',
    ]);
  });

  it('codes du serveur, panne, corps illisible', async () => {
    const etat = (
      reponse: () => Response,
    ): ReturnType<ReturnType<typeof clientEnvoisReseau>['etat']> =>
      clientEnvoisReseau(recuperateur(reponse).recuperer).etat();
    expect(await etat(() => json({ code: 'ENVOIS_INDISPONIBLE' }, 503))).toEqual({
      ok: false,
      code: 'indisponible',
    });
    expect(await etat(() => json({ code: 'ENVOI_RECENT' }, 429))).toEqual({
      ok: false,
      code: 'envoi_recent',
    });
    expect(await etat(() => new Response('oups', { status: 502 }))).toEqual({
      ok: false,
      code: 'indisponible',
    });
    expect(await etat(() => json({ code: 'AUTRE' }, 400))).toEqual({ ok: false, code: 'inconnue' });
    expect(await etat(() => json({ faux: true }))).toEqual({ ok: false, code: 'inconnue' });
    const panne = clientEnvoisReseau(() => Promise.reject(new Error('hors ligne')));
    expect(await panne.etat()).toEqual({ ok: false, code: 'reseau' });
  });

  it('page publique : le jeton part dans le corps ; lien invalide', async () => {
    const r = recuperateur(() => json({ statut: 'accorde' }));
    const client = clientAccordReseau(r.recuperer);
    expect(await client.repondre(JETON, 'accorde')).toEqual({
      ok: true,
      valeur: { statut: 'accorde' },
    });
    expect(r.appels[0]?.url).toBe('/api/accord/repondre');
    expect(r.appels[0]?.init?.body).toBe(JSON.stringify({ jeton: JETON, reponse: 'accorde' }));
    const invalide = clientAccordReseau(
      recuperateur(() => json({ code: 'LIEN_INVALIDE' }, 410)).recuperer,
    );
    expect(await invalide.lire(JETON)).toEqual({ ok: false, code: 'lien_invalide' });
  });
});

describe('clients mémoire', () => {
  it('accord déclaré et invitation, aux mêmes règles que l’API', async () => {
    const client = clientEnvoisMemoire({
      etat: {
        ...ETAT_ENVOIS_VIDE,
        accords: [
          { locataireId: 'julie', statut: 'non_demande' },
          { locataireId: 'lea', statut: 'en_attente', invitationLe: HORODATAGE },
          { locataireId: 'marc', statut: 'sans_email' },
        ],
      },
    });
    expect((await client.inviter('julie')).ok).toBe(true);
    expect(await client.inviter('lea')).toEqual({ ok: false, code: 'invitation_recente' });
    expect(await client.inviter('marc')).toEqual({ ok: false, code: 'sans_email' });
    expect(await client.inviter('inconnu')).toEqual({ ok: false, code: 'introuvable' });
    expect(await client.declarerAccord('marc')).toEqual({ ok: false, code: 'sans_email' });
    expect(await client.declarerAccord('inconnu')).toEqual({ ok: false, code: 'introuvable' });
    const declare = await client.declarerAccord('lea');
    expect(declare).toMatchObject({ ok: true, valeur: { statut: 'declare_par_bailleur' } });
    expect(await client.inviter('lea')).toMatchObject({
      ok: true,
      valeur: { statut: 'declare_par_bailleur' },
    });
    const inactif = clientEnvoisMemoire({
      etat: {
        ...ETAT_ENVOIS_VIDE,
        invitations: false,
        accords: [{ locataireId: 'a', statut: 'non_demande' }],
      },
    });
    expect(await inactif.inviter('a')).toEqual({ ok: false, code: 'inactifs' });
  });

  it('téléphone, bailleur d’un bien, renvoi, erreurs forcées', async () => {
    const client = clientEnvoisMemoire({ etat: ETAT, erreurs: { etat: 'reseau' } });
    expect(await client.etat()).toEqual({ ok: false, code: 'reseau' });
    expect(await client.enregistrerContact('locataire-julie', 'faux')).toEqual({
      ok: false,
      code: 'invalide',
    });
    await client.enregistrerContact('locataire-julie', null);
    await client.enregistrerContact('locataire-lea', '0612345678');
    expect(client.donnees().contacts).toEqual([
      { locataireId: 'locataire-lea', telephone: '0612345678' },
    ]);
    expect(
      await client.enregistrerBailleurBien('bien-lices', { type: 'sci', nom: '', adresse: 'x' }),
    ).toEqual({ ok: false, code: 'invalide' });
    await client.enregistrerBailleurBien('bien-lices', null);
    await client.enregistrerBailleurBien('bien-baille', {
      type: 'personne',
      nom: 'P',
      adresse: 'A',
    });
    expect(client.donnees().bailleursBiens).toEqual([
      { bienId: 'bien-baille', type: 'personne', nom: 'P', adresse: 'A' },
    ]);
    expect(await client.renvoyer('inconnu')).toEqual({ ok: false, code: 'sans_accord' });
    const renvoi = await client.renvoyer('document-julie');
    expect(renvoi.ok && renvoi.valeur.map((e) => [e.statut, e.tentatives])).toEqual([
      ['envoye', 2],
      ['envoye', 2],
    ]);
    expect(client.appels).toContain('renvoyer');

    const indisponible = clientEnvoisIndisponible();
    for (const reponse of await Promise.all([
      indisponible.etat(),
      indisponible.declarerAccord('x'),
      indisponible.inviter('x'),
      indisponible.enregistrerContact('x', null),
      indisponible.enregistrerBailleurBien('x', null),
      indisponible.renvoyer('x'),
    ])) {
      expect(reponse).toEqual({ ok: false, code: 'indisponible' });
    }
  });

  it('page publique en mémoire : un jeton sert une fois', async () => {
    const accord = clientAccordMemoire({ jetonsValides: [JETON] });
    expect(await accord.lire(JETON)).toEqual({
      ok: true,
      valeur: { prenom: 'Julie', bailleur: null, logement: null },
    });
    expect((await accord.repondre(JETON, 'refuse')).ok).toBe(true);
    expect(await accord.repondre(JETON, 'refuse')).toEqual({ ok: false, code: 'lien_invalide' });
    expect(accord.reponses).toEqual([{ jeton: JETON, reponse: 'refuse' }]);
    const enPanne = clientAccordMemoire({ jetonsValides: [JETON], erreur: 'indisponible' });
    expect(await enPanne.lire(JETON)).toEqual({ ok: false, code: 'indisponible' });
    expect(await enPanne.repondre(JETON, 'accorde')).toEqual({ ok: false, code: 'indisponible' });
  });
});
