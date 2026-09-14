import { jourLocal } from '@loupe/gestion';
import { useMemo, useState, type JSX, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { Chapo, Page, TitrePage } from '@/composants/mise-en-page';
import { Bouton, Carte, Pastille, TitreCarte } from '@/composants/ui';
import {
  brouillonDepuisProjet,
  creationPret,
  type ChampPret,
  type SaisiePret,
} from '@/gestion/depuis-projet';
import { dateEnLettres, leJourDuMois, montant } from '@/gestion/format';
import { useGestion } from '@/gestion/GestionContext';
import { useProjets } from '@/stockage/ProjetsContext';
import { ERREURS_GESTION } from '@/textes/gerer';
import {
  ERREURS_PRET,
  locationEnLettres,
  sousTitrePret,
  TEXTES_PRET as T,
} from '@/textes/gerer-pret';
import { LIBELLES_TYPE_BIEN } from '@/textes/gerer-saisie';

import { ChampGerer } from './ChampGerer';
import { SansCompte } from './SansCompte';

const identifiant = (champ: ChampPret): string => `pret-${champ}`;

function LigneReprise({
  libelle,
  valeur,
  analyse,
}: {
  libelle: string;
  valeur: ReactNode;
  analyse: boolean;
}): JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-bordure-douce py-2 last:border-b-0">
      <span className="text-[15px] text-encre-3">{libelle}</span>
      <span className="flex items-center gap-2">
        <span className={`font-bold tabular-nums ${analyse ? 'text-encre' : 'text-encre-2'}`}>
          {valeur}
        </span>
        <Pastille ton={analyse ? 'accent' : 'neutre'} compacte>
          {analyse ? T.analyse : T.parDefaut}
        </Pastille>
      </span>
    </div>
  );
}

/** Porte « J'ai acheté ce bien » : tout est repris de l'analyse, il ne reste qu'à nommer le locataire. */
export function PretAGerer(): JSX.Element {
  const { id } = useParams();
  const { trouver, changerStatut } = useProjets();
  const { statut, creer } = useGestion();
  const naviguer = useNavigate();
  const enregistre = trouver(id);
  const brouillon = useMemo(
    () =>
      enregistre === undefined ? null : brouillonDepuisProjet(enregistre, jourLocal(new Date())),
    [enregistre],
  );
  const [saisie, setSaisie] = useState<SaisiePret>({
    adresse: enregistre?.adresse?.libelle ?? '',
    locataire: '',
    email: '',
  });
  const [erreurs, setErreurs] = useState<readonly ChampPret[]>([]);
  const [echec, setEchec] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  if (statut === 'anonyme') return <SansCompte />;
  if (enregistre === undefined || brouillon === null) {
    return (
      <Page espacement="serre">
        <TitrePage>{T.introuvable}</TitrePage>
        <Chapo>
          <Link to="/projets">{T.retourProjets}</Link>
        </Chapo>
      </Page>
    );
  }

  const changer =
    (champ: keyof SaisiePret) =>
    (valeur: string): void => {
      setSaisie((s) => ({ ...s, [champ]: valeur }));
    };
  const erreur = (champ: ChampPret): string | undefined =>
    erreurs.includes(champ) ? ERREURS_PRET[champ] : undefined;

  const lancer = async (loue: boolean): Promise<void> => {
    const lu = creationPret(brouillon, saisie, loue);
    if (!lu.ok) {
      setErreurs(lu.erreurs);
      document.getElementById(identifiant(lu.erreurs[0] ?? 'adresse'))?.focus();
      return;
    }
    setErreurs([]);
    setOccupe(true);
    const r = await creer(lu.creation);
    setOccupe(false);
    if (!r.ok) {
      setEchec(ERREURS_GESTION[r.code]);
      return;
    }
    changerStatut(enregistre.id, 'achete');
    void naviguer('/gerer');
  };

  const { bien, location } = brouillon;
  const dpe = enregistre.projet.bien.dpe;

  return (
    <Page espacement="large" className="max-w-[900px]">
      <div className="flex flex-col gap-1.5">
        <TitrePage>{T.titre}</TitrePage>
        <Chapo>{sousTitrePret(enregistre.nom)}</Chapo>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Carte>
          <TitreCarte>{T.leBien}</TitreCarte>
          <ChampGerer
            id={identifiant('adresse')}
            libelle={T.adresse}
            valeur={saisie.adresse}
            onChange={changer('adresse')}
            erreur={erreur('adresse')}
            autoComplete="street-address"
          />
          <div>
            <LigneReprise libelle={T.type} valeur={LIBELLES_TYPE_BIEN[bien.type]} analyse />
            <LigneReprise libelle={T.surface} valeur={`${String(bien.surface)} m²`} analyse />
            {dpe !== undefined && <LigneReprise libelle={T.dpe} valeur={dpe} analyse />}
          </div>
        </Carte>

        <Carte>
          <TitreCarte>{T.laLocation}</TitreCarte>
          <div>
            <LigneReprise
              libelle={T.loyer}
              valeur={
                brouillon.loyerConnu
                  ? locationEnLettres(bien.meuble, location.loyerHorsCharges, location.charges)
                  : T.loyerInconnu
              }
              analyse={brouillon.loyerConnu}
            />
            <LigneReprise
              libelle={T.loyerAttendu}
              valeur={leJourDuMois(location.jourLoyer)}
              analyse={false}
            />
            <LigneReprise libelle={T.depot} valeur={montant(location.depot)} analyse={false} />
            <LigneReprise
              libelle={T.entree}
              valeur={dateEnLettres(location.debut)}
              analyse={false}
            />
          </div>
          {/* Toujours rendu sans loyer : « C'est parti » peut y porter le focus avec l'erreur. */}
          {!brouillon.loyerConnu && (
            <p
              id={identifiant('loyer')}
              tabIndex={-1}
              className={`m-0 rounded-encart p-3 text-sm ${
                erreur('loyer') === undefined
                  ? 'bg-accent-fond text-encre-2'
                  : 'bg-probleme-fond text-probleme-texte'
              }`}
            >
              {erreur('loyer') ?? T.loyerManquant}{' '}
              <Link to={`/projets/${enregistre.id}/hypotheses`}>{T.ajouterLoyer}</Link>
            </p>
          )}
        </Carte>
      </div>

      <Carte className="border-accent-bordure">
        <TitreCarte>{T.tonLocataire}</TitreCarte>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChampGerer
            id={identifiant('locataire')}
            libelle={T.locataire}
            valeur={saisie.locataire}
            onChange={changer('locataire')}
            erreur={erreur('locataire')}
            aide={T.aideLocataire}
            autoComplete="off"
          />
          <ChampGerer
            id={identifiant('email')}
            libelle={T.email}
            valeur={saisie.email}
            onChange={changer('email')}
            erreur={erreur('email')}
            type="email"
            inputMode="email"
            autoComplete="off"
          />
        </div>
      </Carte>

      {echec !== null && (
        <p
          role="alert"
          className="m-0 rounded-encart bg-probleme-fond p-3 text-sm text-probleme-texte"
        >
          {echec}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="text-sm text-encre-3">{T.ensuite}</span>
        <Bouton disabled={occupe} onClick={() => void lancer(false)}>
          {T.pasEncoreLoue}
        </Bouton>
        <Bouton variante="primaire" disabled={occupe} onClick={() => void lancer(true)}>
          {T.cestParti}
        </Bouton>
      </div>
    </Page>
  );
}
