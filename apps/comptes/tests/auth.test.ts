import { afterEach, describe, expect, it, vi } from 'vitest';

import { creerAuth, envoyerCode, masquerCourriels, optionsAuth, PREFIXE_COOKIE } from '../src/auth';
import { banc, cookiesPoses, ipUnique, type Banc } from './aide';

const EMAIL = 'camille@example.org';

interface Utilisateur {
  readonly id: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly name: string;
}

/** Le corps JSON d'une réponse, typé par le test (Node type `json()` en `unknown`). */
async function lire<T>(r: Response): Promise<T> {
  return (await r.json()) as T;
}

async function demanderCode(b: Banc, email = EMAIL): Promise<Response> {
  return b.requete('/api/auth/email-otp/send-verification-otp', {
    corps: { email, type: 'sign-in' },
  });
}

async function seConnecter(b: Banc, email = EMAIL): Promise<Response> {
  await demanderCode(b, email);
  return b.requete('/api/auth/sign-in/email-otp', {
    corps: { email, otp: b.courriel.dernierCode() },
  });
}

async function session(b: Banc): Promise<{ user: Utilisateur } | null> {
  const r = await b.requete('/api/auth/get-session');
  expect(r.status).toBe(200);
  return lire<{ user: Utilisateur } | null>(r);
}

afterEach(() => {
  vi.useRealTimers();
});

describe('connexion par code e-mail', () => {
  it('envoie un code à 6 chiffres, crée le compte, pose un cookie de session et se déconnecte', async () => {
    const b = banc();
    const envoi = await demanderCode(b);
    expect(envoi.status).toBe(200);
    expect(await envoi.json()).toEqual({ success: true });
    expect(b.courriel.messages).toHaveLength(1);
    expect(b.courriel.messages[0]?.a).toBe(EMAIL);
    const code = b.courriel.dernierCode();
    expect(code).toMatch(/^\d{6}$/);
    expect(b.courriel.messages[0]?.texte).toContain(code);
    expect(b.courriel.messages[0]?.html).toContain(code);

    const connexion = await b.requete('/api/auth/sign-in/email-otp', {
      corps: { email: EMAIL, otp: code },
    });
    expect(connexion.status).toBe(200);
    const corps = await lire<{ token: string; user: Utilisateur }>(connexion);
    expect(corps.token).toEqual(expect.any(String));
    expect(corps.user).toMatchObject({ email: EMAIL, emailVerified: true });

    const cookieSession = cookiesPoses(connexion).find((c) =>
      c.startsWith(`${PREFIXE_COOKIE}.session_token=`),
    );
    expect(cookieSession).toBeDefined();
    expect(cookieSession).toMatch(/HttpOnly/i);
    expect(cookieSession).toMatch(/SameSite=Lax/i);
    expect(cookieSession).not.toMatch(/Secure/i);

    const ouverte = await session(b);
    expect(ouverte?.user).toMatchObject({ email: EMAIL, emailVerified: true });

    const sortie = await b.requete('/api/auth/sign-out', { corps: {} });
    expect(sortie.status).toBe(200);
    expect(await session(b)).toBeNull();

    // Le journal ne contient ni l'adresse ni le code.
    const journal = JSON.stringify(b.journal.evenements);
    expect(journal).not.toContain(EMAIL);
    expect(journal).not.toContain(code);
  });

  it('le même e-mail retrouve le même compte ; un e-mail invalide est refusé', async () => {
    const b = banc();
    const premiere = await lire<{ user: Utilisateur }>(await seConnecter(b));
    await b.requete('/api/auth/sign-out', { corps: {} });
    const seconde = await lire<{ user: Utilisateur }>(await seConnecter(b));
    expect(seconde.user.id).toBe(premiere.user.id);

    const invalide = await demanderCode(b, 'pas-un-email');
    expect(invalide.status).toBe(400);
    expect(b.courriel.messages).toHaveLength(2);
  });

  it('un code faux est refusé, trois erreurs invalident le code', async () => {
    const b = banc();
    await demanderCode(b);
    const bon = b.courriel.dernierCode();
    const faux = bon === '000000' ? '111111' : '000000';
    const codes: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const r = await b.requete('/api/auth/sign-in/email-otp', {
        corps: { email: EMAIL, otp: faux },
      });
      expect([400, 403]).toContain(r.status);
      codes.push((await lire<{ code: string }>(r)).code);
    }
    expect(codes[0]).toBe('INVALID_OTP');
    expect(codes).toContain('TOO_MANY_ATTEMPTS');
    // Le bon code ne marche plus : il faut en demander un autre.
    const tardif = await b.requete('/api/auth/sign-in/email-otp', {
      corps: { email: EMAIL, otp: bon },
    });
    expect(tardif.status).toBe(400);
    expect(await session(b)).toBeNull();
    expect((await seConnecter(b)).status).toBe(200);
  });

  it('un code de plus de dix minutes est expiré', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: Date.parse('2026-09-13T10:00:00Z') });
    const b = banc();
    await demanderCode(b);
    const code = b.courriel.dernierCode();
    vi.setSystemTime(Date.parse('2026-09-13T10:11:00Z'));
    const r = await b.requete('/api/auth/sign-in/email-otp', {
      corps: { email: EMAIL, otp: code },
    });
    expect(r.status).toBe(400);
    expect((await lire<{ code: string }>(r)).code).toBe('OTP_EXPIRED');
  });

  it('limite les demandes de code : la quatrième dans la minute est refusée (429)', async () => {
    const b = banc();
    for (let i = 0; i < 3; i += 1) expect((await demanderCode(b)).status).toBe(200);
    const refus = await demanderCode(b);
    expect(refus.status).toBe(429);
    expect(refus.headers.get('x-retry-after')).not.toBeNull();
    // Une autre adresse IP n'est pas concernée.
    const autre = await b.requete('/api/auth/email-otp/send-verification-otp', {
      corps: { email: EMAIL, type: 'sign-in' },
      headers: { 'cf-connecting-ip': ipUnique() },
    });
    expect(autre.status).toBe(200);
  });

  it('sans envoyeur (production sans Resend), la demande de code rend 503', async () => {
    const b = banc({ environnement: 'production', courriel: null });
    const r = await demanderCode(b);
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ code: 'COURRIEL_INDISPONIBLE' });
  });

  it('ne laisse demander que des codes de connexion', async () => {
    const b = banc();
    const autre = await b.requete('/api/auth/email-otp/send-verification-otp', {
      corps: { email: EMAIL, type: 'forget-password' },
    });
    expect(autre.status).toBe(400);
    expect(await autre.json()).toEqual({ code: 'TYPE_NON_PRIS_EN_CHARGE' });
    const illisible = await b.requete('/api/auth/email-otp/send-verification-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(illisible.status).toBe(400);
    expect(b.courriel.messages).toHaveLength(0);
  });

  it('un envoi qui échoue est journalisé sans l’adresse ; la réponse reste « envoyé »', async () => {
    const b = banc({
      courriel: { envoyer: () => Promise.reject(new Error(`Resend a refusé ${EMAIL}`)) },
    });
    const r = await demanderCode(b);
    expect(r.status).toBe(200);
    expect(b.journal.evenements).toContainEqual({
      niveau: 'erreur',
      evenement: 'courriel.echec',
      donnees: { raison: 'Resend a refusé [courriel]' },
    });
    expect(JSON.stringify(b.journal.evenements)).not.toContain(EMAIL);
  });

  it('une origine étrangère ne peut pas agir avec le cookie de session (CSRF)', async () => {
    const b = banc();
    expect((await seConnecter(b)).status).toBe(200);
    const r = await b.requete('/api/auth/update-user', {
      corps: { name: 'Pirate' },
      headers: { Origin: 'https://pirate.example' },
    });
    expect(r.status).toBe(403);
    const ouverte = await session(b);
    expect(ouverte?.user.name).toBe('');
  });

  it('en https, le cookie est Secure et préfixé __Secure-', async () => {
    const b = banc({}, 'https://loupeprojet.pages.dev');
    const r = await seConnecter(b);
    expect(r.status).toBe(200);
    const cookie = cookiesPoses(r).find((c) => c.includes('session_token='));
    expect(cookie).toMatch(new RegExp(`^__Secure-${PREFIXE_COOKIE}\\.session_token=`));
    expect(cookie).toMatch(/Secure/);
    const ouverte = await session(b);
    expect(ouverte?.user.email).toBe(EMAIL);
  });
});

describe('garde', () => {
  it('ferme les routes que l’application n’utilise pas', async () => {
    const b = banc();
    const fermees: [string, unknown][] = [
      ['/api/auth/sign-up/email', { email: EMAIL, password: 'un-mot-de-passe', name: 'C' }],
      ['/api/auth/sign-in/email', { email: EMAIL, password: 'un-mot-de-passe' }],
      ['/api/auth/email-otp/reset-password', { email: EMAIL, otp: '123456', password: 'x' }],
      ['/api/auth/change-email', { newEmail: 'autre@example.org' }],
    ];
    for (const [chemin, corps] of fermees) {
      const r = await b.requete(chemin, { corps });
      expect(r.status).toBe(404);
      expect(await r.json()).toEqual({ code: 'INTROUVABLE' });
    }
    expect((await b.requete('/api/auth/get-session', { method: 'POST', corps: {} })).status).toBe(
      404,
    );
  });

  it('ne laisse modifier que le nom affiché, 80 caractères au plus', async () => {
    const b = banc();
    for (const corps of [
      { name: 'x'.repeat(81) },
      { name: 'Camille', image: 'https://pirate.example/traceur.gif' },
      { image: 'https://pirate.example/traceur.gif' },
      { name: 42 },
    ]) {
      const r = await b.requete('/api/auth/update-user', { corps });
      expect(r.status).toBe(400);
      expect(await r.json()).toEqual({ code: 'CHAMPS_INVALIDES' });
    }
    // Un nom valide passe la garde : sans session, Better Auth répond 401.
    expect(
      (await b.requete('/api/auth/update-user', { corps: { name: 'x'.repeat(80) } })).status,
    ).toBe(401);
    expect(
      (
        await b.requete('/api/auth/update-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      ).status,
    ).toBe(400);
  });

  it('refuse un hôte inconnu et accepte les previews Pages', async () => {
    const pirate = banc({}, 'https://pirate.example');
    const refus = await pirate.requete('/api/auth/get-session');
    expect(refus.status).toBe(403);
    expect(await refus.json()).toEqual({ code: 'ORIGINE_INCONNUE' });

    const imitation = banc({}, 'https://loupeprojet.pages.dev.pirate.example');
    expect((await imitation.requete('/api/auth/get-session')).status).toBe(403);

    const preview = banc({}, 'https://feat-comptes.loupeprojet.pages.dev');
    expect(await session(preview)).toBeNull();
  });
});

describe('gestion du compte', () => {
  it('renomme l’utilisateur, liste ses méthodes et supprime le compte avec une session fraîche', async () => {
    const b = banc();
    expect((await seConnecter(b)).status).toBe(200);

    const renommage = await b.requete('/api/auth/update-user', { corps: { name: 'Camille' } });
    expect(renommage.status).toBe(200);
    const ouverte = await session(b);
    expect(ouverte?.user.name).toBe('Camille');

    const comptes = await b.requete('/api/auth/list-accounts');
    expect(comptes.status).toBe(200);
    expect(Array.isArray(await comptes.json())).toBe(true);

    const suppression = await b.requete('/api/auth/delete-user', { corps: {} });
    expect(suppression.status).toBe(200);
    expect(await session(b)).toBeNull();

    // Le compte n'existe plus : une nouvelle connexion en crée un autre.
    const nouvelle = await lire<{ user: Utilisateur }>(await seConnecter(b));
    expect(nouvelle.user.name).toBe('');
  });

  it('refuse la suppression quand la session date de plus d’un jour', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: Date.parse('2026-09-13T10:00:00Z') });
    const b = banc();
    expect((await seConnecter(b)).status).toBe(200);
    vi.setSystemTime(Date.parse('2026-09-15T10:00:00Z'));
    const r = await b.requete('/api/auth/delete-user', { corps: {} });
    expect(r.status).toBe(400);
    expect((await lire<{ code: string }>(r)).code).toBe('SESSION_EXPIRED');
  });

  it('sans session, les routes du compte répondent 401', async () => {
    const b = banc();
    expect((await b.requete('/api/auth/update-user', { corps: { name: 'X' } })).status).toBe(401);
    expect((await b.requete('/api/auth/delete-user', { corps: {} })).status).toBe(401);
    expect((await b.requete('/api/auth/list-accounts')).status).toBe(401);
  });
});

describe('options et instances', () => {
  it('envoyerCode n’envoie que les codes de connexion, et seulement avec un envoyeur', async () => {
    const b = banc();
    await envoyerCode(b.deps)({ email: EMAIL, otp: '123456', type: 'change-email' });
    await envoyerCode({ ...b.deps, courriel: null })({
      email: EMAIL,
      otp: '123456',
      type: 'sign-in',
    });
    expect(b.courriel.messages).toHaveLength(0);
    expect(b.journal.evenements).toEqual([
      { niveau: 'info', evenement: 'courriel.ignore', donnees: { type: 'change-email' } },
      { niveau: 'info', evenement: 'courriel.ignore', donnees: { type: 'sign-in' } },
    ]);
  });

  it('masque les adresses e-mail dans les messages de Better Auth', () => {
    expect(masquerCourriels('Aucun compte pour camille@example.org (inscription)')).toBe(
      'Aucun compte pour [courriel] (inscription)',
    );
    const b = banc();
    const options = optionsAuth(b.deps, 'http://localhost:5173');
    options.logger?.log?.('warn', `lien pour ${EMAIL}`);
    options.logger?.log?.('error', 'échec');
    expect(b.journal.evenements).toEqual([
      { niveau: 'info', evenement: 'auth.warn', donnees: { message: 'lien pour [courriel]' } },
      { niveau: 'erreur', evenement: 'auth.erreur', donnees: { message: 'échec' } },
    ]);
  });

  it('garde une instance par origine et repart de zéro au-delà de huit origines', () => {
    const b = banc();
    const fabrique = creerAuth(b.deps);
    const locale = fabrique('http://localhost:5173');
    expect(fabrique('http://localhost:5173')).toBe(locale);
    for (let i = 0; i < 8; i += 1) fabrique(`https://preview-${String(i)}.loupeprojet.pages.dev`);
    expect(fabrique('http://localhost:5173')).not.toBe(locale);
  });
});
