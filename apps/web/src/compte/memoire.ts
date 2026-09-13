import type {
  ClientCompte,
  CodeErreurCompte,
  FournisseurSocial,
  Fournisseurs,
  Resultat,
  Utilisateur,
} from './types';

export type ActionCompte =
  'demanderCode' | 'verifierCode' | 'continuerAvec' | 'renommer' | 'supprimer';

export interface OptionsMemoire {
  readonly fournisseurs?: Fournisseurs;
  readonly utilisateur?: Utilisateur | null;
  /** Le code accepté par `verifierCode` ; tout autre code rend `code_invalide`. */
  readonly code?: string;
  readonly methodes?: readonly FournisseurSocial[];
  /** Force une erreur sur une action, pour vérifier son affichage. */
  readonly erreurs?: Partial<Record<ActionCompte, CodeErreurCompte>>;
}

export interface ClientMemoire extends ClientCompte {
  /** « google /projets » : chaque redirection demandée vers un fournisseur. */
  readonly redirections: string[];
  /** Les adresses auxquelles un code a été demandé. */
  readonly codesDemandes: string[];
}

export const CODE_MEMOIRE = '123456';
export const TOUS_FOURNISSEURS: Fournisseurs = { email: true, google: true, apple: true };

function reussite<T>(valeur: T): Promise<Resultat<T>> {
  return Promise.resolve({ ok: true, valeur });
}

function echec<T>(code: CodeErreurCompte): Promise<Resultat<T>> {
  return Promise.resolve({ ok: false, code });
}

/** Un client de compte sans réseau : pour les tests et l'aperçu des écrans. */
export function clientMemoire(options: OptionsMemoire = {}): ClientMemoire {
  let courant: Utilisateur | null = options.utilisateur ?? null;
  const code = options.code ?? CODE_MEMOIRE;
  const erreurs = options.erreurs ?? {};
  const redirections: string[] = [];
  const codesDemandes: string[] = [];

  return {
    redirections,
    codesDemandes,
    session: () => Promise.resolve(courant),
    fournisseurs: () => Promise.resolve(options.fournisseurs ?? TOUS_FOURNISSEURS),
    methodes: () => Promise.resolve(options.methodes ?? []),
    demanderCode: (email) => {
      if (erreurs.demanderCode !== undefined) return echec(erreurs.demanderCode);
      codesDemandes.push(email);
      return reussite(undefined);
    },
    verifierCode: (email, saisi) => {
      if (erreurs.verifierCode !== undefined) return echec(erreurs.verifierCode);
      if (saisi !== code) return echec('code_invalide');
      courant = { id: 'utilisateur-memoire', nom: '', email, image: null };
      return reussite(courant);
    },
    continuerAvec: (fournisseur, retour) => {
      if (erreurs.continuerAvec !== undefined) return echec(erreurs.continuerAvec);
      redirections.push(`${fournisseur} ${retour}`);
      return reussite(undefined);
    },
    deconnecter: () => {
      courant = null;
      return Promise.resolve();
    },
    renommer: (nom) => {
      if (erreurs.renommer !== undefined) return echec(erreurs.renommer);
      if (courant === null) return echec('inconnue');
      courant = { ...courant, nom };
      return reussite(undefined);
    },
    supprimer: () => {
      if (erreurs.supprimer !== undefined) return echec(erreurs.supprimer);
      if (courant === null) return echec('inconnue');
      courant = null;
      return reussite(undefined);
    },
  };
}
