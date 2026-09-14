import { LogOut } from 'lucide-react';
import { useEffect, useRef, useState, type JSX } from 'react';
import { Navigate } from 'react-router';

import { useCompte } from '@/compte/CompteContext';
import type { CodeErreurCompte, FournisseurSocial, Resultat } from '@/compte/types';
import { Page, TitrePage } from '@/composants/mise-en-page';
import { Bouton, Carte, Ligne, Pastille, TitreCarte } from '@/composants/ui';
import { ERREURS_COMPTE, initiales, nomAffiche, NOMS_FOURNISSEURS } from '@/textes/compte';
import { TEXTES_MON_COMPTE as T } from '@/textes/mon-compte';

import { MesDonneesGestion } from './compte/MesDonneesGestion';
import { MonMenu } from './compte/MonMenu';
import { CLASSE_SAISIE } from './connexion/styles';

interface Message {
  readonly ton: 'bon' | 'probleme';
  readonly texte: string;
}

const ALLER_A_LA_CONNEXION = '/connexion?retour=/compte';

/** La page « Mon compte » : profil, méthodes de connexion, déconnexion, suppression du compte. */
export function Compte(): JSX.Element {
  const compte = useCompte();
  const [nom, setNom] = useState<string | null>(null);
  const [methodes, setMethodes] = useState<readonly FournisseurSocial[]>([]);
  const [message, setMessage] = useState<Message | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const [sessionAncienne, setSessionAncienne] = useState(false);
  const [occupe, setOccupe] = useState(false);
  // Où aller quand la session disparaît : la connexion par défaut, Mes projets après une sortie voulue.
  const destination = useRef(ALLER_A_LA_CONNEXION);

  const connecte = compte.etat === 'connecte';
  const { client } = compte;
  useEffect(() => {
    if (connecte) void client.methodes().then(setMethodes);
  }, [connecte, client]);

  if (compte.etat === 'chargement') {
    return <p className="m-0 px-4 py-8 text-encre-3 sm:p-10">{T.chargement}</p>;
  }
  if (compte.utilisateur === null) return <Navigate to={destination.current} replace />;
  const utilisateur = compte.utilisateur;
  const valeurNom = nom ?? utilisateur.nom;

  const signaler = (
    r: Resultat,
    succes: string | null,
  ): r is { ok: false; code: CodeErreurCompte } => {
    setOccupe(false);
    if (r.ok) {
      setMessage(succes === null ? null : { ton: 'bon', texte: succes });
      return false;
    }
    setMessage({ ton: 'probleme', texte: ERREURS_COMPTE[r.code] });
    return true;
  };

  const enregistrer = async (): Promise<void> => {
    setOccupe(true);
    const r = await compte.renommer(valeurNom.trim());
    if (!signaler(r, T.nomEnregistre)) setNom(null);
  };

  const sortir = async (vers: string): Promise<void> => {
    destination.current = vers;
    setOccupe(true);
    await compte.deconnecter();
  };

  const supprimer = async (): Promise<void> => {
    destination.current = '/projets';
    setOccupe(true);
    const r = await compte.supprimer();
    if (signaler(r, null)) {
      destination.current = ALLER_A_LA_CONNEXION;
      setConfirmation(false);
      setSessionAncienne(r.code === 'session_ancienne');
    }
  };

  return (
    <Page espacement="large" className="max-w-[760px]">
      {/* En haut à droite, comme sur la plupart des pages de compte : on sort sans chercher. */}
      <div className="flex flex-wrap items-center gap-4">
        <div
          aria-hidden="true"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-doux font-display text-xl font-bold text-accent"
        >
          {initiales(utilisateur)}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <TitrePage>{T.titre}</TitrePage>
          <span className="truncate text-[15px] text-encre-3">{nomAffiche(utilisateur)}</span>
        </div>
        <Bouton
          disabled={occupe}
          onClick={() => {
            void sortir('/projets');
          }}
        >
          <LogOut size={18} aria-hidden="true" />
          {T.deconnecter}
        </Bouton>
      </div>

      {message !== null && (
        <p
          role={message.ton === 'bon' ? 'status' : 'alert'}
          className={`m-0 rounded-encart p-3 text-sm ${
            message.ton === 'bon'
              ? 'bg-bon-fond text-bon-texte'
              : 'bg-probleme-fond text-probleme-texte'
          }`}
        >
          {message.texte}
        </p>
      )}

      <Carte>
        <TitreCarte>{T.profil}</TitreCarte>
        <Ligne libelle={T.email} valeur={utilisateur.email} />
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void enregistrer();
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <label className="flex min-w-48 flex-1 flex-col gap-1.5">
            <span className="text-sm font-semibold text-encre-2">{T.nom}</span>
            <input
              name="nom"
              autoComplete="name"
              maxLength={80}
              value={valeurNom}
              onChange={(e) => {
                setNom(e.target.value);
              }}
              className={CLASSE_SAISIE}
            />
          </label>
          <Bouton
            type="submit"
            variante="primaire"
            disabled={occupe || valeurNom.trim() === utilisateur.nom}
          >
            {T.enregistrer}
          </Bouton>
        </form>
      </Carte>

      <MonMenu />

      <MesDonneesGestion />

      <Carte>
        <TitreCarte>{T.connexion}</TitreCarte>
        <div className="flex flex-wrap gap-2">
          <Pastille ton="accent" compacte>
            {T.methodeEmail}
          </Pastille>
          {methodes.map((m) => (
            <Pastille key={m} ton="neutre" compacte>
              {NOMS_FOURNISSEURS[m]}
            </Pastille>
          ))}
        </div>
      </Carte>

      <Carte>
        <TitreCarte>{T.supprimer}</TitreCarte>
        <p className="m-0 text-sm text-encre-2">{T.explicationSuppression}</p>
        <div className="flex flex-wrap gap-2">
          {confirmation ? (
            <>
              <button
                type="button"
                disabled={occupe}
                onClick={() => {
                  void supprimer();
                }}
                className="inline-flex min-h-[44px] items-center rounded-full bg-probleme px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {T.confirmerSuppression}
              </button>
              <Bouton
                onClick={() => {
                  setConfirmation(false);
                }}
              >
                {T.annuler}
              </Bouton>
            </>
          ) : (
            <Bouton
              onClick={() => {
                setConfirmation(true);
              }}
            >
              {T.supprimer}
            </Bouton>
          )}
          {sessionAncienne && (
            <Bouton
              variante="primaire"
              onClick={() => {
                void sortir(ALLER_A_LA_CONNEXION);
              }}
            >
              {T.seReconnecter}
            </Bouton>
          )}
        </div>
      </Carte>
    </Page>
  );
}
