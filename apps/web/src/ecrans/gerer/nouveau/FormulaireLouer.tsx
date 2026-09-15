import {
  COLOCATAIRES_MAX,
  TYPES_LOCATION,
  type EtatGestion,
  type OccupationCreee,
  type TypeLocation,
} from '@loupe/gestion';
import { ChevronDown } from 'lucide-react';
import { useRef, useState, type JSX } from 'react';

import { MenuChoix, type GroupeChoix, type OptionChoix } from '@/composants/MenuChoix';
import { Bouton, LienBouton } from '@/composants/ui';
import { derniereLocation } from '@/gestion/fiche';
import { useGestion } from '@/gestion/GestionContext';
import {
  occupationDepuisSaisie,
  saisieLouer,
  type ChampLouer,
  type SaisieLouer,
} from '@/gestion/saisie-louer';
import {
  apresChangementDeBien,
  type BienAChoisir,
  type ChoixDesBiens,
} from '@/gestion/saisie-nouveau-locataire';
import { ERREURS_GESTION } from '@/textes/gerer';
import { statutDuBien } from '@/textes/gerer-fiche';
import { colocataireNumero, ERREURS_LOUER, TEXTES_LOUER as T } from '@/textes/gerer-louer';
import { DEPOT_PAR_DEFAUT, LIBELLES_LOCATION, TEXTES_AJOUTER as A } from '@/textes/gerer-saisie';

import { ChampGerer } from '../ChampGerer';

type ChampTexte = Exclude<keyof SaisieLouer, 'type' | 'colocataires'>;

interface LigneColocataire {
  readonly cle: number;
  readonly nom: string;
}

export interface FormulaireLouerProps {
  readonly donnees: EtatGestion;
  readonly choix: ChoixDesBiens;
  /** Le bien choisi à l'ouverture (ADR-G21). */
  readonly bienInitial: string;
  readonly aujourdhui: string;
  /** La page où « Annuler » ramène. */
  readonly annuler: string;
  /** La location est créée : ce que l'API a rendu, et le bien loué. */
  readonly onLoue: (creee: OccupationCreee, bienId: string) => void;
}

const identifiant = (champ: ChampLouer): string => `louer-${champ}`;

function option(bien: BienAChoisir): OptionChoix<string> {
  // Dans « Déjà loués », l'état dit pourquoi le bien peut encore se louer (chambre, entrée à venir).
  const precision = bien.etat.statut === 'vacant' ? undefined : statutDuBien(bien.etat);
  return { valeur: bien.id, libelle: bien.nom, precision };
}

function groupesDe(choix: ChoixDesBiens): readonly GroupeChoix<string>[] {
  return [
    { nom: T.groupeVacants, options: choix.vacants.map(option) },
    { nom: T.groupeLoues, options: choix.loues.map(option) },
  ].filter((groupe) => groupe.options.length > 0);
}

/**
 * « Nouveau locataire » : le bien (liste), le locataire, ses colocataires, la chambre et la location.
 * Ouvert par un lien de la page d'origine (clic 1), envoyé par « Enregistrer » (clic 2).
 */
export function FormulaireLouer({
  donnees,
  choix,
  bienInitial,
  aujourdhui,
  annuler,
  onLoue,
}: FormulaireLouerProps): JSX.Element {
  const { louer } = useGestion();
  const [bienId, setBienId] = useState(bienInitial);
  const [saisie, setSaisie] = useState<SaisieLouer>(() =>
    saisieLouer(derniereLocation(donnees, bienInitial), aujourdhui),
  );
  const [colocataires, setColocataires] = useState<readonly LigneColocataire[]>([]);
  const prochaineCle = useRef(0);
  const [erreurs, setErreurs] = useState<readonly ChampLouer[]>([]);
  const [echec, setEchec] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  const erreur = (champ: ChampLouer): string | undefined =>
    erreurs.includes(champ) ? ERREURS_LOUER[champ] : undefined;
  const champ = (
    nom: ChampTexte & ChampLouer,
    libelle: string,
  ): {
    id: string;
    libelle: string;
    valeur: string;
    onChange: (v: string) => void;
    erreur: string | undefined;
  } => ({
    id: identifiant(nom),
    libelle,
    valeur: saisie[nom],
    onChange: (valeur) => {
      setSaisie((s) => ({ ...s, [nom]: valeur }));
    },
    erreur: erreur(nom),
  });

  const soumettre = async (): Promise<void> => {
    const lu = occupationDepuisSaisie({ ...saisie, colocataires: colocataires.map((c) => c.nom) });
    if (!lu.ok) {
      setErreurs(lu.erreurs);
      document.getElementById(identifiant(lu.erreurs[0] ?? 'locataire'))?.focus();
      return;
    }
    setErreurs([]);
    setEchec(null);
    setOccupe(true);
    const r = await louer(bienId, lu.occupation);
    setOccupe(false);
    if (r.ok) onLoue(r.valeur, bienId);
    else setEchec(ERREURS_GESTION[r.code]);
  };

  return (
    <form
      noValidate
      aria-label={T.formulaire}
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void soumettre();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <span aria-hidden="true" className="text-sm font-semibold text-encre-2">
          {T.bien}
        </span>
        <MenuChoix
          libelle={T.bien}
          valeur={bienId}
          groupes={groupesDe(choix)}
          onChoix={(id) => {
            setBienId(id);
            setSaisie((s) => apresChangementDeBien(s, derniereLocation(donnees, id), aujourdhui));
          }}
          classeBouton="flex min-h-[48px] w-full min-w-0 items-center justify-between gap-3 rounded-encart border border-bordure bg-surface px-4 text-left text-[16px] font-semibold text-encre survol-fond"
          apresValeur={
            <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-encre-3" />
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ChampGerer {...champ('locataire', T.locataire)} autoComplete="off" />
        <ChampGerer
          {...champ('email', T.email)}
          type="email"
          inputMode="email"
          autoComplete="off"
        />
      </div>

      {colocataires.map((ligne, i) => (
        <div key={ligne.cle} className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <ChampGerer
              id={i === 0 ? identifiant('colocataires') : `louer-colocataire-${String(ligne.cle)}`}
              libelle={colocataireNumero(i + 1)}
              valeur={ligne.nom}
              onChange={(nom) => {
                setColocataires((liste) =>
                  liste.map((c) => (c.cle === ligne.cle ? { ...c, nom } : c)),
                );
              }}
              erreur={i === 0 ? erreur('colocataires') : undefined}
              autoComplete="off"
            />
          </div>
          <Bouton
            onClick={() => {
              setColocataires((liste) => liste.filter((c) => c.cle !== ligne.cle));
            }}
          >
            {T.retirer}
          </Bouton>
        </div>
      ))}
      {colocataires.length < COLOCATAIRES_MAX && (
        <div>
          <Bouton
            onClick={() => {
              prochaineCle.current += 1;
              const cle = prochaineCle.current;
              setColocataires((liste) => [...liste, { cle, nom: '' }]);
            }}
          >
            {T.ajouterColocataire}
          </Bouton>
        </div>
      )}

      <ChampGerer {...champ('libelle', T.libelle)} aide={T.aideLibelle} autoComplete="off" />

      <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
        <legend className="mb-1.5 text-sm font-semibold text-encre-2">{A.location}</legend>
        <div className="inline-flex self-start rounded-full bg-bordure-douce p-1">
          {TYPES_LOCATION.map((type: TypeLocation) => (
            <label
              key={type}
              className={`flex min-h-11 cursor-pointer items-center rounded-full px-5 text-sm font-bold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent ${
                saisie.type === type
                  ? 'bg-surface text-encre shadow-carte'
                  : 'text-encre-3 survol-discret'
              }`}
            >
              <input
                type="radio"
                name="louer-type"
                value={type}
                checked={saisie.type === type}
                onChange={() => {
                  setSaisie((s) => ({ ...s, type }));
                }}
                className="sr-only"
              />
              {LIBELLES_LOCATION[type]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <ChampGerer {...champ('loyer', A.loyer)} inputMode="decimal" unite={A.uniteLoyer} />
        <ChampGerer {...champ('charges', A.charges)} inputMode="decimal" unite={A.uniteCharges} />
        <ChampGerer {...champ('entree', A.entree)} type="date" />
        <ChampGerer
          {...champ('jourLoyer', A.jourLoyer)}
          inputMode="numeric"
          placeholder={A.jourParDefaut}
        />
        <ChampGerer
          {...champ('depot', A.depot)}
          inputMode="decimal"
          unite={A.uniteEuros}
          placeholder={DEPOT_PAR_DEFAUT[saisie.type]}
        />
        <ChampGerer
          {...champ('apl', A.apl)}
          inputMode="decimal"
          unite={A.uniteCharges}
          aide={A.aideApl}
        />
      </div>

      {echec !== null && (
        <p
          role="alert"
          className="m-0 rounded-encart bg-probleme-fond p-3 text-sm text-probleme-texte"
        >
          {echec}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <LienBouton to={annuler}>{T.annuler}</LienBouton>
        <Bouton variante="primaire" type="submit" disabled={occupe}>
          {T.enregistrer}
        </Bouton>
      </div>
    </form>
  );
}
