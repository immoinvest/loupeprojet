import type { AccordLocataire, EtatEnvois } from '@loupe/gestion';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useCompte } from '@/compte/CompteContext';

import type { ClientAccord, ClientEnvois, CodeErreurEnvois, ResultatEnvois } from './types';

/** `inactif` : pas de compte ; `indisponible` : migration absente (« Bientôt disponible »). */
export type StatutEnvois = 'inactif' | 'chargement' | 'pret' | 'indisponible' | 'erreur';

export interface ContexteEnvois extends Omit<ClientEnvois, 'etat'> {
  readonly statut: StatutEnvois;
  readonly donnees: EtatEnvois | null;
  readonly erreur: CodeErreurEnvois | null;
  /** Le client de la page publique d'accord. */
  readonly accord: ClientAccord;
  readonly recharger: () => void;
  /** Relit l'état un peu plus tard : la quittance part 12 s après « Reçu », l'invitation juste après. */
  readonly rechargerDans: (ms: number) => void;
}

const Contexte = createContext<ContexteEnvois | null>(null);

const indisponible = (): Promise<{ readonly ok: false; readonly code: 'indisponible' }> =>
  Promise.resolve({ ok: false, code: 'indisponible' });

/** Sans fournisseur (écran monté seul dans un test) : tout est « indisponible », rien ne casse. */
const INERTE: ContexteEnvois = {
  statut: 'indisponible',
  donnees: null,
  erreur: 'indisponible',
  accord: { lire: indisponible, repondre: indisponible },
  recharger: () => undefined,
  rechargerDans: () => undefined,
  declarerAccord: indisponible,
  inviter: indisponible,
  enregistrerContact: indisponible,
  enregistrerBailleurBien: indisponible,
  renvoyer: indisponible,
};

type Chargement = 'chargement' | 'pret' | 'indisponible' | 'erreur';

/** L'état des envois est lu quand le compte est connecté ; les actions le tiennent à jour. */
export function EnvoisProvider({
  client,
  accord,
  children,
}: {
  client: ClientEnvois;
  accord: ClientAccord;
  children: ReactNode;
}): ReactNode {
  const { etat: etatCompte } = useCompte();
  const connecte = etatCompte === 'connecte';
  const [chargement, setChargement] = useState<Chargement>('chargement');
  const [donnees, setDonnees] = useState<EtatEnvois | null>(null);
  const [erreur, setErreur] = useState<CodeErreurEnvois | null>(null);
  const [version, setVersion] = useState(0);
  const minuteur = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(minuteur.current);
    },
    [],
  );

  useEffect(() => {
    if (!connecte) return undefined;
    let actif = true;
    void client.etat().then((r) => {
      if (!actif) return;
      if (r.ok) {
        setDonnees(r.valeur);
        setErreur(null);
        setChargement('pret');
        return;
      }
      setErreur(r.code);
      setChargement(r.code === 'indisponible' ? 'indisponible' : 'erreur');
    });
    return () => {
      actif = false;
    };
  }, [client, connecte, version]);

  const valeur = useMemo<ContexteEnvois>(() => {
    const statut: StatutEnvois = connecte ? chargement : 'inactif';
    const fusionner = (changer: (e: EtatEnvois) => EtatEnvois): void => {
      setDonnees((e) => (e === null ? e : changer(e)));
    };
    const avecAccord = (r: ResultatEnvois<AccordLocataire>): ResultatEnvois<AccordLocataire> => {
      if (r.ok) {
        const { valeur: nouveau } = r;
        fusionner((e) => ({
          ...e,
          accords: e.accords.map((a) => (a.locataireId === nouveau.locataireId ? nouveau : a)),
        }));
      }
      return r;
    };

    return {
      statut,
      donnees: statut === 'pret' ? donnees : null,
      erreur: statut === 'pret' || statut === 'inactif' ? null : erreur,
      accord,
      recharger: () => {
        setVersion((v) => v + 1);
      },
      rechargerDans: (ms) => {
        window.clearTimeout(minuteur.current);
        minuteur.current = window.setTimeout(() => {
          setVersion((v) => v + 1);
        }, ms);
      },
      declarerAccord: async (id) => avecAccord(await client.declarerAccord(id)),
      inviter: async (id) => avecAccord(await client.inviter(id)),
      enregistrerContact: async (id, telephone) => {
        const r = await client.enregistrerContact(id, telephone);
        if (r.ok) {
          const { telephone: enregistre } = r.valeur;
          fusionner((e) => ({
            ...e,
            contacts: [
              ...e.contacts.filter((c) => c.locataireId !== id),
              ...(enregistre === null ? [] : [{ locataireId: id, telephone: enregistre }]),
            ],
          }));
        }
        return r;
      },
      enregistrerBailleurBien: async (bienId, bailleur) => {
        const r = await client.enregistrerBailleurBien(bienId, bailleur);
        if (r.ok) {
          const { bailleur: enregistre } = r.valeur;
          fusionner((e) => ({
            ...e,
            bailleursBiens: [
              ...e.bailleursBiens.filter((b) => b.bienId !== bienId),
              ...(enregistre === null ? [] : [{ bienId, ...enregistre }]),
            ],
          }));
        }
        return r;
      },
      renvoyer: async (documentId) => {
        const r = await client.renvoyer(documentId);
        if (r.ok) {
          const { valeur: envois } = r;
          fusionner((e) => ({
            ...e,
            envois: [...e.envois.filter((x) => x.documentId !== documentId), ...envois],
          }));
        }
        return r;
      },
    };
  }, [accord, chargement, client, connecte, donnees, erreur]);

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useEnvois(): ContexteEnvois {
  return useContext(Contexte) ?? INERTE;
}
