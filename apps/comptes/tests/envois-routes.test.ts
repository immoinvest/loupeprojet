import type {
  CreationLocation,
  CreationReponse,
  DocumentComplet,
  Envoi,
  EtatEnvois,
  EtatGestion,
  OccupationCreee,
  Paiement,
} from '@loupe/gestion';
import { describe, expect, it } from 'vitest';

import { appliquerMigrations, MIGRATIONS } from '../scripts/migration';
import { ErreurCourriel, type Envoyeur, type Message } from '../src/courriel';
import { envoyeurJournal } from '../src/courriel';
import { signatureJetons } from '../src/gestion/envois/jetons';
import { renvoyerDocument } from '../src/gestion/envois/quittances';
import { modeEnvoi } from '../src/gestion/envois/taches';
import { journalMemoire } from '../src/journal';
import {
  bancD1,
  compter,
  connecter,
  envoyeurMemoire,
  SECRET_JETONS_TEST,
  type BancD1,
  type OptionsBancD1,
} from './aide';

const CAMILLE = 'camille@example.org';
const BOB = 'bob@example.org';
/** Le 2 novembre 2026 pour les paiements et documents : octobre est passé. */
const HORLOGE = { maintenant: (): string => '2026-11-02T09:00:00.000Z' };
const BAILLEUR = { nom: 'Pierre Georgel', adresse: '3 rue Paradis, 13006 Marseille' };
const SUJET_INVITATION = 'Vos quittances de loyer par e-mail';
const SUJET_QUITTANCE = 'Votre quittance de loyer – octobre 2026';

const CREATION: CreationLocation = {
  bien: { nom: 'T2 Lices', adresse: '12 rue des Lices', type: 'appartement', meuble: true },
  locataire: { prenom: 'Julie', nom: 'Martin', email: 'julie@exemple.fr' },
  location: {
    type: 'meublee',
    debut: '2026-10-01',
    jourLoyer: 5,
    loyerHorsCharges: 65_000,
    charges: 5_000,
    depot: 130_000,
  },
};

async function lire<T>(reponse: Response): Promise<T> {
  return (await reponse.json()) as T;
}

async function pret(options: OptionsBancD1 = {}): Promise<BancD1> {
  const b = bancD1({ optionsDepot: HORLOGE, ...options });
  await connecter(b, CAMILLE);
  return b;
}

async function creer(b: BancD1, creation: CreationLocation = CREATION): Promise<CreationReponse> {
  const r = await b.requete('/api/gestion/locations', { corps: creation });
  expect(r.status).toBe(201);
  await b.taches();
  return lire<CreationReponse>(r);
}

function messages(courriel: { readonly messages: Message[] }, sujet: string): Message[] {
  return courriel.messages.filter((m) => m.sujet === sujet);
}

function jetonDe(message: Message | undefined): string {
  return /\/accord#(\S+)/.exec(message?.texte ?? '')?.[1] ?? '';
}

async function etat(b: BancD1): Promise<EtatEnvois> {
  const r = await b.requete('/api/gestion/envois');
  expect(r.status).toBe(200);
  return lire<EtatEnvois>(r);
}

function accordPublic(b: BancD1, route: 'lire' | 'repondre', corps: object): Promise<Response> {
  return b.requete(`/api/accord/${route}`, { corps });
}

async function payer(b: BancD1, locationId: string, montant: number): Promise<Paiement> {
  const r = await b.requete('/api/gestion/paiements', {
    corps: { locationId, periode: '2026-10', montant, date: '2026-10-05' },
  });
  expect(r.status).toBe(201);
  return lire<Paiement>(r);
}

function declarer(b: BancD1, locataireId: string): Promise<Response> {
  return b.requete(`/api/gestion/envois/locataires/${locataireId}/accord`, { corps: {} });
}

const AVANT_0009 = MIGRATIONS.findIndex((m) => m.fichier.startsWith('0009'));

describe('migration sans risque (0009 absente)', () => {
  it('les routes existantes répondent comme avant ; celles des envois rendent 503', async () => {
    const b = await pret({ migrations: AVANT_0009 });
    const { location, locataire, bien } = await creer(b);
    const locationId = location?.id ?? '';
    const locataireId = locataire?.id ?? '';
    await payer(b, locationId, 70_000);
    await b.taches();
    expect(
      (await b.requete('/api/gestion/bailleur', { method: 'PUT', corps: BAILLEUR })).status,
    ).toBe(200);
    const q = await b.requete('/api/gestion/documents', {
      corps: { type: 'quittance', locationId, periode: '2026-10' },
    });
    expect(q.status).toBe(201);
    const documentId = (await lire<DocumentComplet>(q)).id;
    expect((await b.requete('/api/gestion/etat')).status).toBe(200);
    expect(
      (
        await b.requete(`/api/gestion/locataires/${locataireId}`, {
          method: 'PATCH',
          corps: { prenom: 'Julie', nom: 'Martin', email: 'julie.m@exemple.fr' },
        })
      ).status,
    ).toBe(200);
    await b.taches();
    expect(messages(b.courriel, SUJET_INVITATION)).toEqual([]);

    const indisponibles = [
      await b.requete('/api/gestion/envois'),
      await declarer(b, locataireId),
      await b.requete(`/api/gestion/envois/locataires/${locataireId}/contact`, {
        method: 'PUT',
        corps: { telephone: '0612345678' },
      }),
      await b.requete(`/api/gestion/envois/biens/${bien.id}/bailleur`, {
        method: 'PUT',
        corps: { bailleur: null },
      }),
      await b.requete(`/api/gestion/envois/documents/${documentId}/renvoyer`, { corps: {} }),
    ];
    for (const r of indisponibles) {
      expect(r.status).toBe(503);
      expect(await r.json()).toEqual({ code: 'ENVOIS_INDISPONIBLE' });
    }
    const signe = await signatureJetons(SECRET_JETONS_TEST).signer(
      'identifiant-de-jeton-inconnu-0001',
      Date.now() + 60_000,
    );
    expect((await accordPublic(b, 'lire', { jeton: signe })).status).toBe(503);
    expect(b.journal.evenements.some((e) => e.evenement === 'envois.indisponible')).toBe(true);

    appliquerMigrations(b.sqlite);
    expect((await b.requete('/api/gestion/envois')).status).toBe(200);
  });
});

describe('accord du locataire (G2-1)', () => {
  it('invitation sans clic, page publique qui ne consomme rien à la lecture, accord à usage unique', async () => {
    const b = await pret();
    const { locataire } = await creer(b);
    const id = locataire?.id ?? '';
    const [invitation] = messages(b.courriel, SUJET_INVITATION);
    expect(invitation?.a).toBe('julie@exemple.fr');
    expect(invitation?.texte).toContain('Bonjour Julie,');
    expect(invitation?.texte).toContain('http://localhost:5173/accord#');
    const jeton = jetonDe(invitation);

    const avant = await etat(b);
    expect(avant).toMatchObject({ mode: 'reel', invitations: true });
    expect(avant.accords).toEqual([
      { locataireId: id, statut: 'en_attente', invitationLe: expect.any(String) as string },
    ]);

    for (let i = 0; i < 2; i += 1) {
      const lu = await accordPublic(b, 'lire', { jeton });
      expect(lu.status).toBe(200);
      expect(await lu.json()).toEqual({
        prenom: 'Julie',
        bailleur: null,
        logement: 'T2 Lices, 12 rue des Lices',
      });
    }
    expect((await b.requete('/api/accord/lire', { corps: { jeton }, origine: null })).status).toBe(
      403,
    );
    expect((await accordPublic(b, 'repondre', { jeton, reponse: 'accorde' })).status).toBe(200);
    expect((await accordPublic(b, 'repondre', { jeton, reponse: 'accorde' })).status).toBe(410);
    expect((await accordPublic(b, 'lire', { jeton })).status).toBe(410);
    expect((await accordPublic(b, 'lire', { jeton: `${jeton}x` })).status).toBe(410);
    expect((await accordPublic(b, 'lire', { rien: true })).status).toBe(410);
    expect((await accordPublic(b, 'repondre', { jeton, reponse: 'oui' })).status).toBe(410);

    expect((await etat(b)).accords[0]).toMatchObject({
      statut: 'accorde',
      le: expect.any(String) as string,
    });
    // Même adresse : aucune nouvelle invitation.
    await b.requete(`/api/gestion/locataires/${id}`, {
      method: 'PATCH',
      corps: { prenom: 'Julie', nom: 'Martin-Dupont', email: 'JULIE@exemple.fr' },
    });
    await b.taches();
    expect(messages(b.courriel, SUJET_INVITATION)).toHaveLength(1);
    expect(compter(b.sqlite, 'gestion_jeton')).toBe(1);
  });

  it('refus, adresse changée, invitation limitée à une par 24 h, accord déclaré par le bailleur', async () => {
    const b = await pret();
    const { locataire } = await creer(b);
    const id = locataire?.id ?? '';
    const premier = jetonDe(messages(b.courriel, SUJET_INVITATION)[0]);

    await b.requete(`/api/gestion/locataires/${id}`, {
      method: 'PATCH',
      corps: { prenom: 'Julie', nom: 'Martin', email: 'julie.m@exemple.fr' },
    });
    await b.taches();
    const invitations = messages(b.courriel, SUJET_INVITATION);
    expect(invitations.map((m) => m.a)).toEqual(['julie@exemple.fr', 'julie.m@exemple.fr']);
    // Le lien envoyé à l'ancienne adresse ne vaut plus.
    expect((await accordPublic(b, 'lire', { jeton: premier })).status).toBe(410);

    const second = jetonDe(invitations[1]);
    expect((await accordPublic(b, 'repondre', { jeton: second, reponse: 'refuse' })).status).toBe(
      200,
    );
    expect((await etat(b)).accords[0]?.statut).toBe('refuse');

    const encore = await b.requete(`/api/gestion/envois/locataires/${id}/invitation`, {
      corps: {},
    });
    expect(encore.status).toBe(429);
    expect(await encore.json()).toEqual({ code: 'INVITATION_RECENTE' });

    const declare = await declarer(b, id);
    expect(declare.status).toBe(200);
    expect(await declare.json()).toMatchObject({ locataireId: id, statut: 'declare_par_bailleur' });
    const deja = await b.requete(`/api/gestion/envois/locataires/${id}/invitation`, { corps: {} });
    expect(await deja.json()).toMatchObject({ statut: 'declare_par_bailleur' });
    expect(messages(b.courriel, SUJET_INVITATION)).toHaveLength(2);

    await b.requete(`/api/gestion/locataires/${id}`, {
      method: 'PATCH',
      corps: { prenom: 'Julie', nom: 'Martin' },
    });
    expect((await etat(b)).accords[0]?.statut).toBe('sans_email');
    expect((await declarer(b, id)).status).toBe(409);
  });

  it('un lien expiré ne vaut plus ; sans clé de signature, aucune invitation', async () => {
    const b = await pret();
    await creer(b);
    const jeton = jetonDe(messages(b.courriel, SUJET_INVITATION)[0]);
    const plusTard = bancD1({
      sqlite: b.sqlite,
      surcharges: { maintenant: () => Date.now() + 31 * 86_400_000 },
    });
    expect((await accordPublic(plusTard, 'lire', { jeton })).status).toBe(410);

    const sansCle = await pret({ surcharges: { jetons: null } });
    const { locataire } = await creer(sansCle);
    expect(messages(sansCle.courriel, SUJET_INVITATION)).toEqual([]);
    expect(await etat(sansCle)).toMatchObject({ invitations: false });
    const r = await sansCle.requete(
      `/api/gestion/envois/locataires/${locataire?.id ?? ''}/invitation`,
      { corps: {} },
    );
    expect(await r.json()).toEqual({ code: 'ENVOIS_INACTIFS' });
    expect((await accordPublic(sansCle, 'lire', { jeton })).status).toBe(410);
  });

  it('louer un bien existant invite le locataire et ses colocataires', async () => {
    const b = await pret();
    const { bien } = await creer(b, { ...CREATION, locataire: null, location: null });
    const r = await b.requete(`/api/gestion/biens/${bien.id}/locations`, {
      corps: {
        locataire: { prenom: 'Léa', nom: 'Bernard', email: 'lea@exemple.fr' },
        colocataires: [
          { prenom: 'Marc', nom: 'Petit', email: 'marc@exemple.fr' },
          { prenom: 'Sans', nom: 'Adresse' },
        ],
        location: CREATION.location,
      },
    });
    expect(r.status).toBe(201);
    await b.taches();
    const { colocataires } = await lire<OccupationCreee>(r);
    expect(colocataires).toHaveLength(2);
    expect(messages(b.courriel, SUJET_INVITATION).map((m) => m.a)).toEqual([
      'lea@exemple.fr',
      'marc@exemple.fr',
    ]);
  });
});

describe('quittance envoyée (G2-2)', () => {
  it('au paiement qui solde le mois : PDF joint, réponse au bailleur, trace masquée ; renvoi limité', async () => {
    const b = await pret();
    const { location, locataire } = await creer(b);
    const locationId = location?.id ?? '';
    await declarer(b, locataire?.id ?? '');
    await b.requete('/api/gestion/bailleur', { method: 'PUT', corps: BAILLEUR });

    await payer(b, locationId, 30_000);
    await b.taches();
    expect(messages(b.courriel, SUJET_QUITTANCE)).toEqual([]);

    await payer(b, locationId, 40_000);
    await b.taches();
    const [quittance] = messages(b.courriel, SUJET_QUITTANCE);
    expect(quittance?.a).toBe('julie@exemple.fr');
    expect(quittance?.repondreA).toBe(CAMILLE);
    const [piece] = quittance?.pieces ?? [];
    expect(piece?.type).toBe('application/pdf');
    expect(piece?.nom).toMatch(/^quittance-2026-10-Q-202610-.+\.pdf$/);
    expect(atob(piece?.base64 ?? '').startsWith('%PDF-1.4')).toBe(true);

    const gestion = await lire<EtatGestion>(await b.requete('/api/gestion/etat'));
    const [document] = gestion.documents;
    expect(document?.type).toBe('quittance');
    const [trace] = (await etat(b)).envois;
    expect(trace).toMatchObject({
      documentId: document?.id,
      destinataire: 'julie@…',
      statut: 'envoye',
      tentatives: 1,
      envoyeLe: expect.any(String) as string,
    });

    const recent = await b.requete(`/api/gestion/envois/documents/${document?.id ?? ''}/renvoyer`, {
      corps: {},
    });
    expect(recent.status).toBe(429);

    const plusTard = bancD1({
      sqlite: b.sqlite,
      optionsDepot: HORLOGE,
      surcharges: { maintenant: () => Date.now() + 2 * 60_000 },
    });
    await connecter(plusTard, CAMILLE);
    const renvoi = await plusTard.requete(
      `/api/gestion/envois/documents/${document?.id ?? ''}/renvoyer`,
      { corps: {} },
    );
    expect(renvoi.status).toBe(200);
    expect(await lire<Envoi[]>(renvoi)).toEqual([
      expect.objectContaining({ statut: 'envoye', tentatives: 2 }),
    ]);
    const [renvoyee] = messages(plusTard.courriel, SUJET_QUITTANCE);
    expect(renvoyee?.pieces?.[0]?.base64).toBe(piece?.base64);
  });

  it('sans accord, rien ne part et « Annuler » reste possible ; annulé pendant le délai, rien ne part', async () => {
    const sansAccord = await pret();
    const { location } = await creer(sansAccord);
    await sansAccord.requete('/api/gestion/bailleur', { method: 'PUT', corps: BAILLEUR });
    const paye = await payer(sansAccord, location?.id ?? '', 70_000);
    await sansAccord.taches();
    expect(messages(sansAccord.courriel, SUJET_QUITTANCE)).toEqual([]);
    expect(compter(sansAccord.sqlite, 'gestion_document')).toBe(0);
    expect(
      (await sansAccord.requete(`/api/gestion/paiements/${paye.id}`, { method: 'DELETE' })).status,
    ).toBe(204);

    let relacher = (): void => undefined;
    const attente = new Promise<void>((resolve) => {
      relacher = resolve;
    });
    const b = await pret({ surcharges: { attendre: () => attente } });
    const cree = await creer(b);
    await declarer(b, cree.locataire?.id ?? '');
    await b.requete('/api/gestion/bailleur', { method: 'PUT', corps: BAILLEUR });
    const paiement = await payer(b, cree.location?.id ?? '', 70_000);
    expect(
      (await b.requete(`/api/gestion/paiements/${paiement.id}`, { method: 'DELETE' })).status,
    ).toBe(204);
    relacher();
    await b.taches();
    expect(messages(b.courriel, SUJET_QUITTANCE)).toEqual([]);
    expect(b.journal.evenements).toContainEqual({
      niveau: 'info',
      evenement: 'envoi.quittance_non_emise',
      donnees: { raison: 'LOYER_NON_REGLE' },
    });
  });

  it('un refus du fournisseur est retenté une fois puis tracé en échec, sans adresse au journal', async () => {
    const memoire = envoyeurMemoire();
    let essais = 0;
    const courriel: Envoyeur = {
      envoyer: (message) => {
        if (message.sujet !== SUJET_QUITTANCE) return memoire.envoyer(message);
        essais += 1;
        return Promise.reject(new ErreurCourriel('Resend a répondu 422', 422));
      },
    };
    const b = bancD1({ optionsDepot: HORLOGE, surcharges: { courriel } });
    await b.requete('/api/auth/email-otp/send-verification-otp', {
      corps: { email: CAMILLE, type: 'sign-in' },
    });
    await b.requete('/api/auth/sign-in/email-otp', {
      corps: { email: CAMILLE, otp: memoire.dernierCode() },
    });
    const { location, locataire } = await creer(b);
    await declarer(b, locataire?.id ?? '');
    await b.requete('/api/gestion/bailleur', { method: 'PUT', corps: BAILLEUR });
    await payer(b, location?.id ?? '', 70_000);
    await b.taches();

    expect(essais).toBe(2);
    expect((await etat(b)).envois).toEqual([
      expect.objectContaining({ statut: 'echec', tentatives: 2, destinataire: 'julie@…' }),
    ]);
    expect(b.journal.evenements).toContainEqual({
      niveau: 'erreur',
      evenement: 'envoi.echec',
      donnees: { type: 'quittance', statut: 422 },
    });
    expect(JSON.stringify(b.journal.evenements)).not.toContain('julie@');
  });

  it('modes d’envoi ; renvoyer sans envoyeur est refusé', async () => {
    expect(modeEnvoi({ courriel: null })).toBe('inactif');
    expect(modeEnvoi({ courriel: envoyeurJournal(journalMemoire()) })).toBe('journal');
    const b = await pret();
    await expect(
      renvoyerDocument({ deps: { ...b.deps, courriel: null }, userId: 'x', origine: '' }, 'd'),
    ).rejects.toMatchObject({ code: 'ENVOIS_INACTIFS' });
  });
});

describe('téléphone et bailleur d’un bien', () => {
  it('le téléphone s’enregistre et se retire ; un format libre est refusé', async () => {
    const b = await pret();
    const { locataire } = await creer(b);
    const chemin = `/api/gestion/envois/locataires/${locataire?.id ?? ''}/contact`;
    const ecrit = await b.requete(chemin, {
      method: 'PUT',
      corps: { telephone: '06 12 34 56 78' },
    });
    expect(ecrit.status).toBe(200);
    expect((await etat(b)).contacts).toEqual([
      { locataireId: locataire?.id, telephone: '06 12 34 56 78' },
    ]);
    expect(
      (await b.requete(chemin, { method: 'PUT', corps: { telephone: 'appelez' } })).status,
    ).toBe(400);
    await b.requete(chemin, { method: 'PUT', corps: { telephone: null } });
    expect((await etat(b)).contacts).toEqual([]);
  });

  it('la quittance d’un bien porte son bailleur (SCI), même sans identité du compte ; un document émis ne change pas', async () => {
    const b = await pret();
    const { location, bien } = await creer(b);
    const locationId = location?.id ?? '';
    const sci = { type: 'sci', nom: 'SCI Lices', adresse: '1 cours Julien, Marseille' };
    const chemin = `/api/gestion/envois/biens/${bien.id}/bailleur`;
    expect((await b.requete(chemin, { method: 'PUT', corps: { bailleur: sci } })).status).toBe(200);
    expect((await etat(b)).bailleursBiens).toEqual([{ bienId: bien.id, ...sci }]);

    await payer(b, locationId, 70_000);
    const demande = { type: 'quittance', locationId, periode: '2026-10' };
    const q = await b.requete('/api/gestion/documents', { corps: demande });
    expect(q.status).toBe(201);
    expect((await lire<DocumentComplet>(q)).contenu.bailleur).toEqual({
      nom: 'SCI Lices',
      adresse: '1 cours Julien, Marseille',
    });

    await b.requete(chemin, { method: 'PUT', corps: { bailleur: null } });
    expect((await etat(b)).bailleursBiens).toEqual([]);
    const encore = await b.requete('/api/gestion/documents', { corps: demande });
    expect((await lire<DocumentComplet>(encore)).contenu.bailleur.nom).toBe('SCI Lices');
  });
});

describe('isolement des comptes et suppression', () => {
  it('un autre compte reçoit 404 partout ; sans session, 401', async () => {
    const b = await pret();
    const { location, locataire, bien } = await creer(b);
    await declarer(b, locataire?.id ?? '');
    await b.requete('/api/gestion/bailleur', { method: 'PUT', corps: BAILLEUR });
    await payer(b, location?.id ?? '', 70_000);
    await b.taches();
    const documentId = (await lire<EtatGestion>(await b.requete('/api/gestion/etat'))).documents[0]
      ?.id;

    const bob = bancD1({ sqlite: b.sqlite, optionsDepot: HORLOGE });
    await connecter(bob, BOB);
    expect(await etat(bob)).toMatchObject({ accords: [], envois: [], contacts: [] });
    const refus = [
      await declarer(bob, locataire?.id ?? ''),
      await bob.requete(`/api/gestion/envois/locataires/${locataire?.id ?? ''}/invitation`, {
        corps: {},
      }),
      await bob.requete(`/api/gestion/envois/locataires/${locataire?.id ?? ''}/contact`, {
        method: 'PUT',
        corps: { telephone: '0612345678' },
      }),
      await bob.requete(`/api/gestion/envois/biens/${bien.id}/bailleur`, {
        method: 'PUT',
        corps: { bailleur: null },
      }),
      await bob.requete(`/api/gestion/envois/documents/${documentId ?? ''}/renvoyer`, {
        method: 'POST',
        corps: {},
        headers: {},
      }),
    ];
    expect(refus.map((r) => r.status)).toEqual([404, 404, 404, 404, 404]);

    const anonyme = bancD1({ sqlite: b.sqlite });
    expect((await anonyme.requete('/api/gestion/envois')).status).toBe(401);
  });

  it('supprimer le compte efface accords, jetons, traces, téléphones et identités par bien', async () => {
    const b = await pret();
    const { location, locataire, bien } = await creer(b);
    const locataireId = locataire?.id ?? '';
    await declarer(b, locataireId);
    await b.requete('/api/gestion/bailleur', { method: 'PUT', corps: BAILLEUR });
    await b.requete(`/api/gestion/envois/locataires/${locataireId}/contact`, {
      method: 'PUT',
      corps: { telephone: '0612345678' },
    });
    await b.requete(`/api/gestion/envois/biens/${bien.id}/bailleur`, {
      method: 'PUT',
      corps: { bailleur: { type: 'personne', nom: 'Pierre', adresse: 'Marseille' } },
    });
    await payer(b, location?.id ?? '', 70_000);
    await b.taches();
    const tables = [
      'gestion_accord',
      'gestion_jeton',
      'gestion_envoi',
      'gestion_locataire_contact',
      'gestion_bien_bailleur',
    ];
    for (const table of tables) expect(compter(b.sqlite, table)).toBe(1);

    expect((await b.requete('/api/auth/delete-user', { corps: {} })).status).toBe(200);
    for (const table of tables) expect(compter(b.sqlite, table)).toBe(0);
  });
});
