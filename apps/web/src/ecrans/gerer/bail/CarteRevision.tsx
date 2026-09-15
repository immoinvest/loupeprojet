import type {
  EtatGestion,
  IdentiteBailleur as Identite,
  LocationGeree,
  RevisionAppliquee,
  RevisionSaisie,
} from '@loupe/gestion';
import { useState, type JSX } from 'react';
import { Link } from 'react-router';

import { Bouton, Carte, LienBouton, Pastille, TitreCarte } from '@/composants/ui';
import { useBail } from '@/gestion/bail/BailContext';
import { derniereLettre, propositionDe, revisionDeLaLocation } from '@/gestion/bail/vue';
import { useGestion } from '@/gestion/GestionContext';
import { ancreRevision, lienLettre } from '@/gestion/parcours';
import { ERREURS_GESTION } from '@/textes/gerer';
import {
  effetEnLettres,
  ERREURS_BAIL,
  indicesEnLettres,
  nouveauLoyerEnLettres,
  phraseRevision,
  PROVENANCES,
  revisionAppliquee,
  TEXTES_REVISION as T,
  URL_SOURCE_IRL,
} from '@/textes/gerer-bail';

import { IdentiteBailleur } from '../IdentiteBailleur';
import { ReglagesRevision } from './ReglagesRevision';

type Formulaire = 'reglages' | 'bailleur' | null;

/** « Révision du loyer » d'une location (G4-1) : la proposition, « Appliquer la révision », les réglages. */
export function CarteRevision({
  location,
  donnees,
  aujourdhui,
  retour,
}: {
  readonly location: LocationGeree;
  readonly donnees: EtatGestion;
  readonly aujourdhui: string;
  /** La fiche du bien : où revenir depuis la lettre. */
  readonly retour: string;
}): JSX.Element | null {
  const bail = useBail();
  const { enregistrerBailleur } = useGestion();
  const [formulaire, setFormulaire] = useState<Formulaire>(null);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [appliquee, setAppliquee] = useState<RevisionAppliquee | null>(null);
  const etat = bail.donnees;
  if (etat === null) return null;

  const proposition = propositionDe(location, donnees, etat, aujourdhui);
  const revision = revisionDeLaLocation(location, etat, aujourdhui);
  const lettre = derniereLettre(etat, location.id);

  const appliquer = async (): Promise<void> => {
    if (proposition.statut !== 'proposee') return;
    if (donnees.bailleur === null) {
      setFormulaire('bailleur');
      return;
    }
    setOccupe(true);
    const r = await bail.appliquerRevision(location.id, proposition.anniversaire);
    setOccupe(false);
    if (r.ok) {
      setAppliquee(r.valeur);
      setErreur(null);
    } else {
      setErreur(ERREURS_BAIL[r.code]);
    }
  };

  const bailleurPuisAppliquer = async (identite: Identite): Promise<void> => {
    setOccupe(true);
    const r = await enregistrerBailleur(identite);
    setOccupe(false);
    if (!r.ok) {
      setErreur(ERREURS_GESTION[r.code]);
      return;
    }
    setFormulaire(null);
    setErreur(null);
    if (proposition.statut !== 'proposee') return;
    setOccupe(true);
    const applique = await bail.appliquerRevision(location.id, proposition.anniversaire);
    setOccupe(false);
    if (applique.ok) setAppliquee(applique.valeur);
    else setErreur(ERREURS_BAIL[applique.code]);
  };

  const enregistrerReglages = async (saisie: RevisionSaisie): Promise<void> => {
    setOccupe(true);
    const r = await bail.enregistrerRevision(location.id, saisie);
    setOccupe(false);
    if (r.ok) {
      setFormulaire(null);
      setErreur(null);
    } else {
      setErreur(ERREURS_BAIL[r.code]);
    }
  };

  return (
    <Carte id={ancreRevision(location.id)}>
      <TitreCarte
        action={
          formulaire === null ? (
            <Bouton
              onClick={() => {
                setFormulaire('reglages');
              }}
            >
              {T.reglages}
            </Bouton>
          ) : undefined
        }
      >
        {location.libelle === undefined ? T.titre : `${T.titre} · ${location.libelle}`}
      </TitreCarte>

      {appliquee !== null && (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-encart bg-bon-fond p-3 text-bon-texte"
        >
          <p className="m-0 font-semibold">
            {revisionAppliquee(
              appliquee.lettre.contenu.nouveauLoyer,
              appliquee.lettre.contenu.aPartirDe,
            )}
          </p>
          <div>
            <LienBouton to={lienLettre(appliquee.lettre.id, retour)} variante="primaire">
              {T.voirLettre}
            </LienBouton>
          </div>
        </div>
      )}

      {proposition.statut === 'proposee' ? (
        <>
          <p className="m-0 text-[20px] font-bold tabular-nums">
            {nouveauLoyerEnLettres(proposition)}
          </p>
          <p className="m-0 text-encre-2">{effetEnLettres(proposition)}</p>
          <p className="m-0 text-sm text-encre-3">
            {indicesEnLettres(proposition)}{' '}
            <a
              href={URL_SOURCE_IRL}
              target="_blank"
              rel="noreferrer"
              className="font-semibold survol-texte pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
            >
              {T.source}
            </a>
          </p>
          {formulaire !== 'bailleur' && (
            <div>
              <Bouton variante="primaire" disabled={occupe} onClick={() => void appliquer()}>
                {T.appliquer}
              </Bouton>
            </div>
          )}
        </>
      ) : (
        <p className="m-0 text-encre-2">{phraseRevision(proposition)}</p>
      )}

      {revision.provenance === 'par_defaut' && (
        <p className="m-0 text-sm text-encre-3">
          <Pastille ton="neutre" compacte>
            {PROVENANCES.par_defaut}
          </Pastille>
        </p>
      )}

      {lettre !== undefined && appliquee === null && (
        <Link
          to={lienLettre(lettre.id, retour)}
          className="inline-flex min-h-11 items-center self-start text-sm font-semibold no-underline survol-texte"
        >
          {T.derniereLettre}
        </Link>
      )}

      {formulaire === 'bailleur' && (
        <>
          <p className="m-0 text-sm text-encre-2">{T.bailleurAvant}</p>
          <IdentiteBailleur
            initiale={donnees.bailleur}
            occupe={occupe}
            erreur={erreur}
            onEnregistrer={bailleurPuisAppliquer}
            onAnnuler={() => {
              setFormulaire(null);
              setErreur(null);
            }}
          />
        </>
      )}
      {formulaire === 'reglages' && (
        <ReglagesRevision
          id={`reglages-${location.id}`}
          revision={revision}
          occupe={occupe}
          erreur={erreur}
          onEnregistrer={enregistrerReglages}
          onFermer={() => {
            setFormulaire(null);
            setErreur(null);
          }}
        />
      )}
      {formulaire === null && erreur !== null && (
        <p
          role="alert"
          className="m-0 rounded-encart bg-probleme-fond p-3 text-sm text-probleme-texte"
        >
          {erreur}
        </p>
      )}
    </Carte>
  );
}
