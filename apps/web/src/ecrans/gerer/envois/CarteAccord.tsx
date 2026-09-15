import { accordValide, type Locataire, type StatutAccordEffectif } from '@loupe/gestion';
import { useEffect, useState, type JSX } from 'react';

import { Bouton, Carte, Pastille, TitreCarte } from '@/composants/ui';
import { useEnvois } from '@/gestion/envois/EnvoisContext';
import { accordDe, marquerAccordVu, stockageLocal } from '@/gestion/envois/logique';
import {
  ERREURS_ENVOIS,
  leJourDe,
  PASTILLES_ACCORD,
  PHRASES_ACCORD,
  TEXTES_ENVOIS as T,
  TONS_ACCORD,
} from '@/textes/gerer-envois';

const DEMANDABLES: readonly StatutAccordEffectif[] = ['non_demande', 'en_attente', 'refuse'];

interface Retour {
  readonly succes: boolean;
  readonly texte: string;
}

/**
 * « Quittances par e-mail » sur la fiche d'un locataire (G2-1) : où en est son accord, et en un clic
 * « Mon locataire m'a déjà donné son accord » ou « Renvoyer la demande ».
 */
export function CarteAccord({ locataire }: { readonly locataire: Locataire }): JSX.Element | null {
  const envois = useEnvois();
  const [occupe, setOccupe] = useState(false);
  const [retour, setRetour] = useState<Retour | null>(null);
  const accord = accordDe(envois.donnees, locataire.id);
  const enAttente = accord?.statut === 'en_attente';

  // « À faire » signale un accord en attente une seule fois : ouvrir la fiche suffit.
  useEffect(() => {
    if (enAttente) marquerAccordVu(stockageLocal(), locataire.id);
  }, [enAttente, locataire.id]);

  if (envois.statut === 'indisponible') {
    return (
      <Carte>
        <TitreCarte>{T.titreAccord}</TitreCarte>
        <p className="m-0 text-[15px] text-encre-2">{T.bientot}</p>
      </Carte>
    );
  }
  if (envois.donnees === null || accord === undefined) return null;
  const { mode, invitations } = envois.donnees;
  const { statut } = accord;
  const date = accord.le ?? (enAttente ? accord.invitationLe : undefined);

  const agir = async (
    action: () => ReturnType<typeof envois.declarerAccord>,
    succes: string,
  ): Promise<void> => {
    setOccupe(true);
    const r = await action();
    setOccupe(false);
    setRetour(
      r.ok ? { succes: true, texte: succes } : { succes: false, texte: ERREURS_ENVOIS[r.code] },
    );
  };

  return (
    <Carte>
      <TitreCarte>{T.titreAccord}</TitreCarte>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Pastille ton={TONS_ACCORD[statut]} compacte>
            {PASTILLES_ACCORD[statut]}
          </Pastille>
          {date !== undefined && <small className="text-sm text-encre-3">{leJourDe(date)}</small>}
        </div>
        <p className="m-0 text-[15px] text-encre-2">{PHRASES_ACCORD[statut]}</p>
        {statut !== 'sans_email' && !accordValide(statut) && (
          <p className="m-0 text-sm text-encre-3">{T.loi}</p>
        )}
        {mode === 'journal' && <p className="m-0 text-sm text-surveiller-texte">{T.modeJournal}</p>}
        {!invitations && DEMANDABLES.includes(statut) && (
          <p className="m-0 text-sm text-encre-3">{T.inactifs}</p>
        )}
      </div>
      {statut !== 'sans_email' && !accordValide(statut) && (
        <div className="flex flex-wrap gap-2">
          <Bouton
            variante="primaire"
            disabled={occupe}
            onClick={() => void agir(() => envois.declarerAccord(locataire.id), T.accordNote)}
          >
            {T.declarer}
          </Bouton>
          {invitations && (
            <Bouton
              disabled={occupe}
              onClick={() => void agir(() => envois.inviter(locataire.id), T.demandeRenvoyee)}
            >
              {T.renvoyerDemande}
            </Bouton>
          )}
        </div>
      )}
      {retour !== null && (
        <p
          role={retour.succes ? 'status' : 'alert'}
          className={`m-0 rounded-encart p-3 text-sm ${
            retour.succes ? 'bg-bon-fond text-bon-texte' : 'bg-probleme-fond text-probleme-texte'
          }`}
        >
          {retour.texte}
        </p>
      )}
    </Carte>
  );
}
