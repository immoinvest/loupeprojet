import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { emailOTP } from 'better-auth/plugins/email-otp';

import { DUREE_CODE_MINUTES, messageCode } from './courriel';
import type { Dependances } from './dependances';
import { messageDe } from './erreurs';

export const CHEMIN_AUTH = '/api/auth';
export const PREFIXE_COOKIE = 'deklic';
const LONGUEUR_CODE = 6;
const ESSAIS_CODE = 3;
/** Requêtes par minute et par adresse IP sur l'ensemble des routes d'authentification. */
const LIMITE_PAR_MINUTE = 60;
/** Saisies de code par minute et par adresse IP (le code lui-même est invalidé après 3 erreurs). */
const SAISIES_PAR_MINUTE = 10;
/** Nombre d'origines (production, previews, localhost) dont on garde l'instance en mémoire. */
const INSTANCES_MAX = 8;
const ADRESSE_COURRIEL = /[^\s@<>"'()]+@[^\s@<>"'()]+/g;

export type Auth = ReturnType<typeof betterAuth>;

export interface DemandeEnvoi {
  readonly email: string;
  readonly otp: string;
  readonly type: string;
}

/** Les journaux ne contiennent jamais d'adresse e-mail, même dans un message de bibliothèque. */
export function masquerCourriels(texte: string): string {
  return texte.replace(ADRESSE_COURRIEL, '[courriel]');
}

/**
 * Envoi du code, appelé par Better Auth. Seul le code de connexion part (la garde HTTP refuse déjà
 * les autres). Better Auth répond « envoyé » quoi qu'il arrive : un échec est journalisé sans l'adresse.
 */
export function envoyerCode(deps: Dependances): (demande: DemandeEnvoi) => Promise<void> {
  return async ({ email, otp, type }) => {
    if (type !== 'sign-in' || deps.courriel === null) {
      deps.journal.info('courriel.ignore', { type });
      return;
    }
    try {
      await deps.courriel.envoyer({ a: email, ...messageCode(otp) });
    } catch (erreur) {
      deps.journal.erreur('courriel.echec', { raison: masquerCourriels(messageDe(erreur)) });
    }
  };
}

/** Les options Better Auth pour une origine donnée (baseURL = l'origine de la requête, vérifiée par la garde). */
export function optionsAuth(deps: Dependances, origine: string): BetterAuthOptions {
  return {
    appName: 'Deklic',
    baseURL: origine,
    basePath: CHEMIN_AUTH,
    secret: deps.secret,
    database: deps.base,
    trustedOrigins: [...deps.origines],
    plugins: [
      emailOTP({
        otpLength: LONGUEUR_CODE,
        expiresIn: DUREE_CODE_MINUTES * 60,
        allowedAttempts: ESSAIS_CODE,
        sendVerificationOTP: envoyerCode(deps),
      }),
    ],
    user: { deleteUser: { enabled: true } },
    rateLimit: {
      enabled: true,
      window: 60,
      max: LIMITE_PAR_MINUTE,
      // Le plugin limite ses routes à 3 par minute : bien pour l'envoi de codes, trop court pour
      // les saisies (un code invalidé après 3 erreurs doit pouvoir être remplacé tout de suite).
      customRules: { '/sign-in/email-otp': { window: 60, max: SAISIES_PAR_MINUTE } },
    },
    advanced: {
      cookiePrefix: PREFIXE_COOKIE,
      useSecureCookies: origine.startsWith('https://'),
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
      // Explicite : Better Auth désactive ce contrôle quand il détecte un environnement de test.
      disableOriginCheck: false,
    },
    telemetry: { enabled: false },
    logger: {
      level: 'warn',
      log: (niveau, message) => {
        const donnees = { message: masquerCourriels(message) };
        if (niveau === 'error') deps.journal.erreur('auth.erreur', donnees);
        else deps.journal.info(`auth.${niveau}`, donnees);
      },
    },
  };
}

/** Une instance Better Auth par origine, gardée dans l'isolat (les bindings sont stables d'une requête à l'autre). */
export function creerAuth(deps: Dependances): (origine: string) => Auth {
  const instances = new Map<string, Auth>();
  return (origine) => {
    const existante = instances.get(origine);
    if (existante !== undefined) return existante;
    if (instances.size >= INSTANCES_MAX) instances.clear();
    const auth = betterAuth(optionsAuth(deps, origine));
    instances.set(origine, auth);
    return auth;
  };
}
