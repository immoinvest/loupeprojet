import type { Locataire } from '@loupe/gestion';
import { useLayoutEffect, useState, type JSX } from 'react';

import { Bouton } from '@/composants/ui';
import { useEnvois } from '@/gestion/envois/EnvoisContext';
import { telephoneDe, telephoneDepuisSaisie } from '@/gestion/envois/logique';
import { useGestion } from '@/gestion/GestionContext';
import { locataireDepuisSaisie, saisieLocataire, type SaisieLocataire } from '@/gestion/locataires';
import type { ChampLocataire } from '@/gestion/saisie';
import { ERREURS_GESTION } from '@/textes/gerer';
import { ERREURS_ENVOIS, TEXTES_ENVOIS } from '@/textes/gerer-envois';
import { ERREURS_LOCATAIRE, TEXTES_LOCATAIRES as T } from '@/textes/gerer-locataires';

import { ChampGerer } from './ChampGerer';

/** « Modifier » (clic 1) ouvre ce formulaire prérempli ; « Enregistrer » (clic 2) corrige nom et e-mail. */
export function ModifierLocataire({
  locataire,
  focusEmail = false,
  onFermer,
}: {
  readonly locataire: Locataire;
  /** Ouvert pour compléter l'e-mail (fiche du locataire) : le curseur y est déjà. */
  readonly focusEmail?: boolean;
  readonly onFermer: () => void;
}): JSX.Element {
  const { modifierLocataire } = useGestion();
  const envois = useEnvois();
  // Le téléphone (table latérale de quittances-auto) : proposé seulement quand les envois répondent.
  const avecTelephone = envois.statut === 'pret';
  const telephoneInitial = telephoneDe(envois.donnees, locataire.id) ?? '';
  const [telephone, setTelephone] = useState(telephoneInitial);
  const [telephoneInvalide, setTelephoneInvalide] = useState(false);
  const [saisie, setSaisie] = useState<SaisieLocataire>(() => saisieLocataire(locataire));
  const [erreurs, setErreurs] = useState<readonly ChampLocataire[]>([]);
  const [echec, setEchec] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const id = (champ: ChampLocataire): string => `locataire-${locataire.id}-${champ}`;

  // Dans la même passe que l'affichage : le curseur est dans l'e-mail dès que le formulaire se voit,
  // même quand il apparaît après le chargement des données (`?modifier=1`).
  useLayoutEffect(() => {
    if (focusEmail) document.getElementById(`locataire-${locataire.id}-email`)?.focus();
  }, [focusEmail, locataire.id]);
  const erreur = (champ: ChampLocataire): string | undefined =>
    erreurs.includes(champ) ? ERREURS_LOCATAIRE[champ] : undefined;

  const enregistrer = async (): Promise<void> => {
    const lu = locataireDepuisSaisie(saisie);
    const tel = telephoneDepuisSaisie(avecTelephone ? telephone : '');
    setTelephoneInvalide(!tel.ok);
    if (!lu.ok) {
      setErreurs(lu.erreurs);
      document.getElementById(id(lu.erreurs[0] ?? 'locataire'))?.focus();
      return;
    }
    setErreurs([]);
    if (!tel.ok) {
      document.getElementById(`locataire-${locataire.id}-telephone`)?.focus();
      return;
    }
    setOccupe(true);
    const r = await modifierLocataire(locataire.id, lu.locataire);
    if (!r.ok) {
      setOccupe(false);
      setEchec(ERREURS_GESTION[r.code]);
      return;
    }
    // Un nouvel e-mail déclenche une demande d'accord : l'état des envois est relu juste après.
    envois.rechargerDans(1_500);
    if (avecTelephone && telephone.trim() !== telephoneInitial) {
      const contact = await envois.enregistrerContact(locataire.id, tel.telephone);
      if (!contact.ok) {
        setOccupe(false);
        setEchec(ERREURS_ENVOIS[contact.code]);
        return;
      }
    }
    setOccupe(false);
    onFermer();
  };

  return (
    <form
      noValidate
      aria-label={T.formulaire}
      className="flex flex-col gap-3 rounded-encart bg-accent-fond p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void enregistrer();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <ChampGerer
          id={id('locataire')}
          libelle={T.nom}
          valeur={saisie.locataire}
          onChange={(valeur) => {
            setSaisie((s) => ({ ...s, locataire: valeur }));
          }}
          erreur={erreur('locataire')}
          autoComplete="off"
        />
        <ChampGerer
          id={id('email')}
          libelle={T.email}
          type="email"
          inputMode="email"
          valeur={saisie.email}
          onChange={(valeur) => {
            setSaisie((s) => ({ ...s, email: valeur }));
          }}
          erreur={erreur('email')}
          autoComplete="off"
        />
        {avecTelephone && (
          <ChampGerer
            id={`locataire-${locataire.id}-telephone`}
            libelle={TEXTES_ENVOIS.telephone}
            type="tel"
            inputMode="tel"
            valeur={telephone}
            onChange={setTelephone}
            erreur={telephoneInvalide ? TEXTES_ENVOIS.telephoneInvalide : undefined}
            autoComplete="off"
          />
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Bouton disabled={occupe} onClick={onFermer}>
          {T.fermer}
        </Bouton>
        <Bouton variante="primaire" type="submit" disabled={occupe}>
          {T.enregistrer}
        </Bouton>
      </div>
      {echec !== null && (
        <p
          role="alert"
          className="m-0 rounded-encart bg-probleme-fond p-3 text-sm text-probleme-texte"
        >
          {echec}
        </p>
      )}
    </form>
  );
}
