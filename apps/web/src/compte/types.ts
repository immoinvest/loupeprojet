/** La personne connectée, telle que l'interface l'affiche. */
export interface Utilisateur {
  readonly id: string;
  /** Vide tant que la personne ne s'est pas nommée (connexion par code e-mail). */
  readonly nom: string;
  readonly email: string;
  readonly image: string | null;
}

/** Les méthodes de connexion que le serveur propose (selon sa configuration). */
export interface Fournisseurs {
  readonly email: boolean;
  readonly google: boolean;
  readonly apple: boolean;
}

export type FournisseurSocial = 'google' | 'apple';

/** Erreurs traduites en codes stables ; les phrases sont dans `textes/compte.ts`. */
export type CodeErreurCompte =
  | 'email_invalide'
  | 'code_invalide'
  | 'code_expire'
  | 'trop_essais'
  | 'trop_de_demandes'
  | 'session_ancienne'
  | 'indisponible'
  | 'reseau'
  | 'inconnue';

export type Resultat<T = undefined> =
  | { readonly ok: true; readonly valeur: T }
  | { readonly ok: false; readonly code: CodeErreurCompte };

/** Ce dont les écrans ont besoin ; une version réseau (Better Auth) et une version mémoire (tests). */
export interface ClientCompte {
  session(): Promise<Utilisateur | null>;
  fournisseurs(): Promise<Fournisseurs>;
  demanderCode(email: string): Promise<Resultat>;
  verifierCode(email: string, code: string): Promise<Resultat<Utilisateur>>;
  /** Redirige le navigateur vers Google ou Apple ; `retour` est le chemin où revenir. */
  continuerAvec(fournisseur: FournisseurSocial, retour: string): Promise<Resultat>;
  deconnecter(): Promise<void>;
  renommer(nom: string): Promise<Resultat>;
  /** Les fournisseurs sociaux liés au compte (le code e-mail est toujours possible). */
  methodes(): Promise<readonly FournisseurSocial[]>;
  supprimer(): Promise<Resultat>;
}
