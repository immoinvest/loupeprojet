import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { ClientCompte, Fournisseurs, FournisseurSocial, Resultat, Utilisateur } from './types';

export type EtatCompte = 'chargement' | 'anonyme' | 'connecte';

export interface ContexteCompte {
  readonly etat: EtatCompte;
  readonly utilisateur: Utilisateur | null;
  /** `null` tant que le serveur n'a pas répondu. */
  readonly fournisseurs: Fournisseurs | null;
  readonly client: ClientCompte;
  readonly demanderCode: (email: string) => Promise<Resultat>;
  readonly verifierCode: (email: string, code: string) => Promise<Resultat<Utilisateur>>;
  readonly continuerAvec: (fournisseur: FournisseurSocial, retour: string) => Promise<Resultat>;
  readonly deconnecter: () => Promise<void>;
  readonly renommer: (nom: string) => Promise<Resultat>;
  readonly supprimer: () => Promise<Resultat>;
}

const Contexte = createContext<ContexteCompte | null>(null);

interface Session {
  readonly charge: boolean;
  readonly utilisateur: Utilisateur | null;
}

/** La session et les méthodes de connexion sont lues une fois au lancement ; les actions les tiennent à jour. */
export function CompteProvider({
  client,
  children,
}: {
  client: ClientCompte;
  children: ReactNode;
}): ReactNode {
  const [session, setSession] = useState<Session>({ charge: false, utilisateur: null });
  const [fournisseurs, setFournisseurs] = useState<Fournisseurs | null>(null);

  useEffect(() => {
    void client.session().then((utilisateur) => {
      setSession({ charge: true, utilisateur });
    });
    void client.fournisseurs().then(setFournisseurs);
  }, [client]);

  const valeur = useMemo<ContexteCompte>(() => {
    const utilisateur = session.utilisateur;
    const connecter = (u: Utilisateur | null): void => {
      setSession({ charge: true, utilisateur: u });
    };
    return {
      etat: !session.charge ? 'chargement' : utilisateur === null ? 'anonyme' : 'connecte',
      utilisateur,
      fournisseurs,
      client,
      demanderCode: (email) => client.demanderCode(email),
      verifierCode: async (email, code) => {
        const r = await client.verifierCode(email, code);
        if (r.ok) connecter(r.valeur);
        return r;
      },
      continuerAvec: (fournisseur, retour) => client.continuerAvec(fournisseur, retour),
      deconnecter: async () => {
        await client.deconnecter();
        connecter(null);
      },
      renommer: async (nom) => {
        const r = await client.renommer(nom);
        if (r.ok && utilisateur !== null) connecter({ ...utilisateur, nom });
        return r;
      },
      supprimer: async () => {
        const r = await client.supprimer();
        if (r.ok) connecter(null);
        return r;
      },
    };
  }, [client, session, fournisseurs]);

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useCompte(): ContexteCompte {
  const contexte = useContext(Contexte);
  if (contexte === null) {
    throw new Error('useCompte doit être utilisé sous CompteProvider');
  }
  return contexte;
}
