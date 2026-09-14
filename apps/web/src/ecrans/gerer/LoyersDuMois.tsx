import {
  jourLocal,
  periodeDe,
  resumeDuMois,
  type EtatGestion,
  type LigneLoyer,
} from '@loupe/gestion';
import { useEffect, useState, type JSX } from 'react';
import { Link } from 'react-router';

import { Page, TitrePage } from '@/composants/mise-en-page';
import { Bouton, Carte, Pastille, TitreCarte } from '@/composants/ui';
import { leJour, moisEnLettres, montant } from '@/gestion/format';
import { useGestion } from '@/gestion/GestionContext';
import { ERREURS_GESTION } from '@/textes/gerer';
import {
  avecMajuscule,
  biensVacants,
  loyerRecu,
  marquerRecu,
  phraseDuMois,
  STATUTS_LOYER,
  TEXTES_GERER as T,
  TONS_LOYER,
} from '@/textes/gerer-ecrans';

/** Durée pendant laquelle « Annuler » reste proposé après un « Reçu ». */
const DUREE_ANNULATION_MS = 10_000;

interface Annulation {
  readonly paiementId: string;
  readonly prenom: string;
}

function prenomDe(ligne: LigneLoyer): string {
  return ligne.locataire?.prenom ?? T.tonLocataire;
}

function LigneDuMois({
  ligne,
  occupe,
  onRecu,
}: {
  ligne: LigneLoyer;
  occupe: boolean;
  onRecu: () => void;
}): JSX.Element {
  const locataire = ligne.locataire;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-bordure-douce py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_110px_90px_auto]">
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-bold">{ligne.bien?.nom}</span>
        <span className="truncate text-sm text-encre-3">
          {locataire === undefined ? '' : `${locataire.prenom} ${locataire.nom}`}
        </span>
      </span>
      <span className="text-right font-bold tabular-nums">{montant(ligne.du.total)}</span>
      <span className="hidden text-sm text-encre-3 sm:block">{leJour(ligne.du.echeance)}</span>
      <span className="col-span-2 flex items-center justify-end gap-2 sm:col-span-1">
        <Pastille ton={TONS_LOYER[ligne.statut]} compacte>
          {STATUTS_LOYER[ligne.statut]}
        </Pastille>
        {ligne.statut !== 'recu' && (
          <Bouton
            variante="primaire"
            title={marquerRecu(prenomDe(ligne))}
            disabled={occupe}
            onClick={onRecu}
          >
            {T.recu}
          </Bouton>
        )}
      </span>
    </li>
  );
}

/** L'accueil de Gérer quand il y a des biens : qui a payé ce mois-ci, « Reçu » en un clic. */
export function LoyersDuMois({ donnees }: { donnees: EtatGestion }): JSX.Element {
  const { payer, annulerPaiement } = useGestion();
  const [occupe, setOccupe] = useState(false);
  const [annulation, setAnnulation] = useState<Annulation | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const aujourdhui = jourLocal(new Date());
  const periode = periodeDe(aujourdhui);
  const resume = resumeDuMois(donnees, periode, aujourdhui);
  const loues = new Set(resume.lignes.map((l) => l.location.bienId));
  const vacants = donnees.biens.filter((b) => !loues.has(b.id)).map((b) => b.nom);
  const part = resume.montantDu === 0 ? 0 : (resume.montantRecu / resume.montantDu) * 100;

  useEffect(() => {
    if (annulation === null) return undefined;
    const minuteur = window.setTimeout(() => {
      setAnnulation(null);
    }, DUREE_ANNULATION_MS);
    return () => {
      window.clearTimeout(minuteur);
    };
  }, [annulation]);

  const marquer = async (ligne: LigneLoyer): Promise<void> => {
    setOccupe(true);
    const r = await payer({
      locationId: ligne.location.id,
      periode,
      montant: ligne.du.total - ligne.recu,
      date: aujourdhui,
    });
    setOccupe(false);
    setErreur(r.ok ? null : ERREURS_GESTION[r.code]);
    setAnnulation(r.ok ? { paiementId: r.valeur.id, prenom: prenomDe(ligne) } : null);
  };

  const annuler = async (a: Annulation): Promise<void> => {
    setOccupe(true);
    const r = await annulerPaiement(a.paiementId);
    setOccupe(false);
    setAnnulation(null);
    setErreur(r.ok ? null : ERREURS_GESTION[r.code]);
  };

  return (
    <Page espacement="large">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold tracking-wider text-encre-3 uppercase">
            {avecMajuscule(moisEnLettres(periode))}
          </span>
          <TitrePage taille="accroche">
            {phraseDuMois(resume.nombreRecus, resume.lignes.length)}
          </TitrePage>
        </div>
        <Link
          to="/gerer/ajouter"
          className="inline-flex min-h-[44px] items-center rounded-full border border-bordure bg-surface px-4 text-sm font-semibold text-encre-2 no-underline hover:bg-accent-fond"
        >
          {T.ajouterBien}
        </Link>
      </div>

      {resume.lignes.length > 0 && (
        <div className="flex flex-col gap-2">
          <div
            role="img"
            aria-label={`${montant(resume.montantRecu)} reçus sur ${montant(resume.montantDu)}`}
            className="h-3.5 overflow-hidden rounded-full bg-bordure-douce"
          >
            <div className="h-full rounded-full bg-bon" style={{ width: `${String(part)}%` }} />
          </div>
          <div className="flex justify-between text-sm text-encre-3 tabular-nums">
            <span>
              <b className="text-encre">{montant(resume.montantRecu)}</b> reçus
            </span>
            <span>sur {montant(resume.montantDu)}</span>
          </div>
        </div>
      )}

      {annulation !== null && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-encart bg-encre px-4 py-2 text-[15px] font-semibold text-white"
        >
          {loyerRecu(annulation.prenom)}
          <button
            type="button"
            disabled={occupe}
            onClick={() => void annuler(annulation)}
            className="min-h-[44px] rounded-full bg-white/15 px-4 text-sm font-semibold text-white hover:bg-white/25"
          >
            {T.annuler}
          </button>
        </div>
      )}
      {erreur !== null && (
        <p
          role="alert"
          className="m-0 rounded-encart bg-probleme-fond p-3 text-sm text-probleme-texte"
        >
          {erreur}
        </p>
      )}

      {resume.lignes.length > 0 && (
        <Carte>
          <TitreCarte>{T.listeTitre}</TitreCarte>
          <ul className="m-0 flex list-none flex-col p-0">
            {resume.lignes.map((ligne) => (
              <LigneDuMois
                key={ligne.location.id}
                ligne={ligne}
                occupe={occupe}
                onRecu={() => void marquer(ligne)}
              />
            ))}
          </ul>
        </Carte>
      )}
      {vacants.length > 0 && <p className="m-0 text-sm text-encre-3">{biensVacants(vacants)}</p>}
    </Page>
  );
}
