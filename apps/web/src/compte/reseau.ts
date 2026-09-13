import { z } from 'zod';

import type {
  ClientCompte,
  CodeErreurCompte,
  Fournisseurs,
  FournisseurSocial,
  Resultat,
  Utilisateur,
} from './types';

export type Recuperateur = (url: string, init?: RequestInit) => Promise<Response>;
export type Naviguer = (url: string) => void;

const UtilisateurSchema = z.object({
  id: z.string().min(1),
  name: z.string().nullish(),
  email: z.string().min(1),
  image: z.string().nullish(),
});
type UtilisateurServeur = z.infer<typeof UtilisateurSchema>;

const SessionSchema = z.object({ user: UtilisateurSchema }).nullable();
const ConnexionSchema = z.object({ user: UtilisateurSchema });
const FournisseursSchema = z.object({
  email: z.boolean(),
  google: z.boolean(),
  apple: z.boolean(),
});
const RedirectionSchema = z.object({ url: z.url() });
const ComptesSchema = z.array(z.object({ providerId: z.string() }));
/** Toute réponse JSON objet : les routes sans contenu utile (déconnexion, renommage…). */
const ObjetSchema = z.looseObject({});
const ErreurSchema = z.object({ code: z.string() });

/** Codes du serveur (Better Auth et worker des comptes) vers les codes de l'interface. */
const CODES_SERVEUR: Readonly<Record<string, CodeErreurCompte>> = {
  INVALID_EMAIL: 'email_invalide',
  INVALID_OTP: 'code_invalide',
  OTP_EXPIRED: 'code_expire',
  TOO_MANY_ATTEMPTS: 'trop_essais',
  SESSION_EXPIRED: 'session_ancienne',
  COURRIEL_INDISPONIBLE: 'indisponible',
  CONFIGURATION_INCOMPLETE: 'indisponible',
  PROVIDER_NOT_FOUND: 'indisponible',
};

const AUCUN_FOURNISSEUR: Fournisseurs = { email: false, google: false, apple: false };
const SOCIAUX: readonly string[] = ['google', 'apple'] satisfies FournisseurSocial[];

function versUtilisateur(u: UtilisateurServeur): Utilisateur {
  return { id: u.id, nom: u.name ?? '', email: u.email, image: u.image ?? null };
}

function lireJson(reponse: Response): Promise<unknown> {
  return reponse.json().catch(() => undefined);
}

async function codeDe(reponse: Response): Promise<CodeErreurCompte> {
  if (reponse.status === 429) return 'trop_de_demandes';
  const corps = ErreurSchema.safeParse(await lireJson(reponse));
  const connu = corps.success ? CODES_SERVEUR[corps.data.code] : undefined;
  if (connu !== undefined) return connu;
  return reponse.status >= 500 ? 'indisponible' : 'inconnue';
}

function estSocial(id: string): id is FournisseurSocial {
  return SOCIAUX.includes(id);
}

/** Le client réel : les routes Better Auth du worker des comptes, sur la même origine que le site. */
export function clientReseau(
  recuperer: Recuperateur = (url, init) => fetch(url, init),
  naviguer: Naviguer = (url) => {
    window.location.assign(url);
  },
): ClientCompte {
  async function appeler(chemin: string, corps?: unknown): Promise<Response | null> {
    const init: RequestInit =
      corps === undefined
        ? {}
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(corps),
          };
    try {
      return await recuperer(chemin, init);
    } catch {
      return null;
    }
  }

  async function executer<T, U>(
    chemin: string,
    corps: unknown,
    schema: z.ZodType<T>,
    vers: (lu: T) => U,
  ): Promise<Resultat<U>> {
    const reponse = await appeler(chemin, corps);
    if (reponse === null) return { ok: false, code: 'reseau' };
    if (!reponse.ok) return { ok: false, code: await codeDe(reponse) };
    const lu = schema.safeParse(await lireJson(reponse));
    return lu.success ? { ok: true, valeur: vers(lu.data) } : { ok: false, code: 'inconnue' };
  }

  const rien = (): undefined => undefined;

  return {
    async session() {
      const r = await executer('/api/auth/get-session', undefined, SessionSchema, (s) =>
        s === null ? null : versUtilisateur(s.user),
      );
      return r.ok ? r.valeur : null;
    },
    async fournisseurs() {
      const r = await executer(
        '/api/comptes/fournisseurs',
        undefined,
        FournisseursSchema,
        (f) => f,
      );
      return r.ok ? r.valeur : AUCUN_FOURNISSEUR;
    },
    demanderCode: (email) =>
      executer(
        '/api/auth/email-otp/send-verification-otp',
        { email, type: 'sign-in' },
        ObjetSchema,
        rien,
      ),
    verifierCode: (email, code) =>
      executer('/api/auth/sign-in/email-otp', { email, otp: code }, ConnexionSchema, (c) =>
        versUtilisateur(c.user),
      ),
    async continuerAvec(fournisseur, retour) {
      const r = await executer(
        '/api/auth/sign-in/social',
        {
          provider: fournisseur,
          callbackURL: retour,
          errorCallbackURL: `/connexion?fournisseur=${fournisseur}`,
        },
        RedirectionSchema,
        (lu) => lu.url,
      );
      if (!r.ok) return r;
      naviguer(r.valeur);
      return { ok: true, valeur: undefined };
    },
    async deconnecter() {
      await executer('/api/auth/sign-out', {}, ObjetSchema, rien);
    },
    renommer: (nom) => executer('/api/auth/update-user', { name: nom }, ObjetSchema, rien),
    async methodes() {
      const r = await executer('/api/auth/list-accounts', undefined, ComptesSchema, (comptes) =>
        comptes.map((c) => c.providerId).filter(estSocial),
      );
      return r.ok ? r.valeur : [];
    },
    supprimer: () => executer('/api/auth/delete-user', {}, ObjetSchema, rien),
  };
}
