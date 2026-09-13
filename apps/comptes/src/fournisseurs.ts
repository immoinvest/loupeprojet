import { importPKCS8, SignJWT } from 'jose';

import { ErreurConfiguration } from './erreurs';

export interface ConfigGoogle {
  readonly clientId: string;
  readonly clientSecret: string;
}

export interface ConfigApple {
  readonly clientId: string;
  readonly teamId: string;
  readonly keyId: string;
  readonly privateKey: string;
}

/** Un fournisseur absent n'est pas proposé à l'utilisateur ; un fournisseur à moitié configuré est une erreur. */
export interface ConfigFournisseurs {
  readonly google?: ConfigGoogle | undefined;
  readonly apple?: ConfigApple | undefined;
}

/** Ce que l'interface reçoit : quels boutons afficher. */
export interface Fournisseurs {
  readonly email: boolean;
  readonly google: boolean;
  readonly apple: boolean;
}

export interface VariablesFournisseurs {
  readonly GOOGLE_CLIENT_ID?: string | undefined;
  readonly GOOGLE_CLIENT_SECRET?: string | undefined;
  readonly APPLE_CLIENT_ID?: string | undefined;
  readonly APPLE_TEAM_ID?: string | undefined;
  readonly APPLE_KEY_ID?: string | undefined;
  readonly APPLE_PRIVATE_KEY?: string | undefined;
}

type Variable = keyof VariablesFournisseurs;

const CLES_GOOGLE = {
  clientId: 'GOOGLE_CLIENT_ID',
  clientSecret: 'GOOGLE_CLIENT_SECRET',
} as const satisfies Record<keyof ConfigGoogle, Variable>;

const CLES_APPLE = {
  clientId: 'APPLE_CLIENT_ID',
  teamId: 'APPLE_TEAM_ID',
  keyId: 'APPLE_KEY_ID',
  privateKey: 'APPLE_PRIVATE_KEY',
} as const satisfies Record<keyof ConfigApple, Variable>;

/** Toutes les variables d'un fournisseur, ou aucune ; sinon on nomme celles qui manquent. */
function toutOuRien<K extends string>(
  nom: string,
  cles: Readonly<Record<K, Variable>>,
  v: VariablesFournisseurs,
): Readonly<Record<K, string>> | undefined {
  const manquantes: string[] = [];
  const lues: Partial<Record<K, string>> = {};
  for (const [champ, variable] of Object.entries(cles) as [K, Variable][]) {
    const valeur = v[variable];
    if (valeur === undefined) manquantes.push(variable);
    else lues[champ] = valeur;
  }
  if (manquantes.length === Object.keys(cles).length) return undefined;
  if (manquantes.length > 0) {
    throw new ErreurConfiguration(`${nom} : variables manquantes ${manquantes.join(', ')}`);
  }
  return lues as Readonly<Record<K, string>>;
}

/** Google : les deux variables ou aucune ; Apple : les quatre ou aucune. */
export function lireConfigFournisseurs(v: VariablesFournisseurs): ConfigFournisseurs {
  return {
    google: toutOuRien('Google', CLES_GOOGLE, v),
    apple: toutOuRien('Apple', CLES_APPLE, v),
  };
}

/** Les méthodes de connexion à proposer : l'e-mail dépend d'un envoyeur disponible. */
export function disponibles(config: ConfigFournisseurs, email: boolean): Fournisseurs {
  return { email, google: config.google !== undefined, apple: config.apple !== undefined };
}

export const ORIGINE_APPLE = 'https://appleid.apple.com';
/** Apple refuse un secret client valable plus de six mois. */
export const DUREE_SECRET_APPLE_JOURS = 180;
const SECONDES_PAR_JOUR = 86_400;

/**
 * Le secret client d'Apple : un JWT ES256 signé avec la clé privée (.p8) du compte développeur.
 * La clé peut arriver sur une ligne, avec des `\n` littéraux (variable d'environnement).
 */
export async function secretClientApple(
  config: ConfigApple,
  maintenant: () => number,
): Promise<string> {
  const cle = await importPKCS8(config.privateKey.replace(/\\n/g, '\n'), 'ES256');
  const emisLe = Math.floor(maintenant() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: config.keyId })
    .setIssuer(config.teamId)
    .setSubject(config.clientId)
    .setAudience(ORIGINE_APPLE)
    .setIssuedAt(emisLe)
    .setExpirationTime(emisLe + DUREE_SECRET_APPLE_JOURS * SECONDES_PAR_JOUR)
    .sign(cle);
}
