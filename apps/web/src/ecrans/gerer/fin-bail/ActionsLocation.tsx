import {
  finSolidarite,
  jourLocal,
  periodeDe,
  periodeSuivante,
  type ChangementColocataire,
  type CongeSaisie,
  type EtatGestion,
  type LocationGeree,
} from '@loupe/gestion';
import { useState, type JSX } from 'react';

import { Bouton, Pastille } from '@/composants/ui';
import { useBail } from '@/gestion/bail/BailContext';
import { useFinBail } from '@/gestion/fin-bail/FinBailContext';
import { congeDe, contextePreavis, presentsDuMois, statutDe } from '@/gestion/fin-bail/vue';
import { TEXTES_GERER } from '@/textes/gerer-ecrans';
import {
  departDe,
  departLe,
  ERREURS_FIN_BAIL,
  quittancesSuivantes,
  solidariteEnLettres,
  STATUTS_LOCATION,
  TEXTES_COLOCATAIRE,
  TEXTES_PREAVIS,
} from '@/textes/gerer-fin-bail';

import { ChangerColocataire } from './ChangerColocataire';
import { Preavis } from './Preavis';

type Formulaire = 'preavis' | 'colocataire' | null;

/**
 * Sur la carte d'une location : le préavis (G4-2) et le changement de colocataire (G4-6). Sans la
 * migration 0011, la fin du bail n'est pas chargée et ce bloc disparaît (le reste de la carte reste).
 */
export function ActionsLocation({
  location,
  donnees,
  aujourdhui,
}: {
  readonly location: LocationGeree;
  readonly donnees: EtatGestion;
  readonly aujourdhui: string;
}): JSX.Element | null {
  const finBail = useFinBail();
  const bail = useBail();
  const [ouvert, setOuvert] = useState<Formulaire>(null);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const etat = finBail.donnees;
  if (etat === null) return null;

  const conge = congeDe(etat, location.id);
  const statut = statutDe(location, etat, aujourdhui);
  const bien = donnees.biens.find((b) => b.id === location.bienId);
  const contexte = contextePreavis(location, bien, bail.donnees, false, aujourdhui);
  const titulaire = donnees.locataires.find((l) => l.id === location.locataireId);
  const presents = presentsDuMois(location, donnees, etat, periodeDe(aujourdhui));
  const identifiant = `fin-bail-${location.id}`;

  const fermer = (): void => {
    setOuvert(null);
    setErreur(null);
  };
  const enregistrerConge = async (saisie: CongeSaisie): Promise<void> => {
    setOccupe(true);
    const r = await finBail.enregistrerConge(location.id, saisie);
    setOccupe(false);
    if (r.ok) {
      fermer();
      setMessage(departLe(saisie.fin));
    } else setErreur(ERREURS_FIN_BAIL[r.code]);
  };
  const annulerConge = async (): Promise<void> => {
    setOccupe(true);
    const r = await finBail.retirerConge(location.id);
    setOccupe(false);
    if (r.ok) setMessage(null);
    else setErreur(ERREURS_FIN_BAIL[r.code]);
  };
  const changerColocataire = async (changement: ChangementColocataire): Promise<void> => {
    setOccupe(true);
    const r = await finBail.changerColocataire(location.id, changement);
    setOccupe(false);
    if (!r.ok) {
      setErreur(ERREURS_FIN_BAIL[r.code]);
      return;
    }
    fermer();
    const { depart, arrivee } = changement;
    const suivant = quittancesSuivantes(periodeSuivante(periodeDe(jourLocal(new Date()))));
    if (depart === undefined) {
      setMessage(suivant);
      return;
    }
    const partant = donnees.locataires.find((l) => l.id === depart.locataireId);
    const fin = finSolidarite(depart.date, arrivee?.date ?? null);
    setMessage(
      `${solidariteEnLettres(partant?.prenom ?? TEXTES_GERER.tonLocataire, fin)} ${suivant}`,
    );
  };

  return (
    <div id={identifiant} className="flex flex-col gap-3">
      {statut === 'preavis' && location.fin !== undefined && (
        <p className="m-0 flex flex-wrap items-center gap-2 text-sm text-encre-2">
          <Pastille ton="surveiller">{STATUTS_LOCATION.preavis}</Pastille>
          {departLe(location.fin)}
        </p>
      )}
      {message !== null && (
        <p role="status" className="m-0 rounded-encart bg-bon-fond p-3 text-sm text-bon-texte">
          {message}
        </p>
      )}

      {ouvert === 'preavis' && (
        <Preavis
          id={`preavis-${location.id}`}
          contexte={contexte}
          aujourdhui={aujourdhui}
          {...(conge === undefined
            ? {}
            : { initiale: { recuLe: conge.recuLe, fin: conge.fin, reduit: conge.reduit } })}
          occupe={occupe}
          erreur={erreur}
          onEnregistrer={enregistrerConge}
          onFermer={fermer}
        />
      )}
      {ouvert === 'colocataire' && (
        <ChangerColocataire
          id={`colocataire-${location.id}`}
          presents={presents}
          aujourdhui={aujourdhui}
          occupe={occupe}
          erreur={erreur}
          onEnregistrer={changerColocataire}
          onFermer={fermer}
        />
      )}

      {ouvert === null && statut !== 'terminee' && (
        <div className="flex flex-wrap gap-2">
          <Bouton
            onClick={() => {
              setOuvert('preavis');
            }}
          >
            {conge === undefined
              ? departDe(titulaire?.prenom ?? TEXTES_GERER.tonLocataire)
              : TEXTES_PREAVIS.modifier}
          </Bouton>
          {conge !== undefined && (
            <Bouton disabled={occupe} onClick={() => void annulerConge()}>
              {TEXTES_PREAVIS.annuler}
            </Bouton>
          )}
          <Bouton
            onClick={() => {
              setOuvert('colocataire');
            }}
          >
            {TEXTES_COLOCATAIRE.ouvrir}
          </Bouton>
        </div>
      )}
      {ouvert === null && erreur !== null && (
        <p
          role="alert"
          className="m-0 rounded-encart bg-probleme-fond p-3 text-sm text-probleme-texte"
        >
          {erreur}
        </p>
      )}
    </div>
  );
}
