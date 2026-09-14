import {
  jourLocal,
  TYPES_BIEN,
  TYPES_LOCATION,
  type TypeBien,
  type TypeLocation,
} from '@loupe/gestion';
import { useState, type JSX } from 'react';
import { useNavigate } from 'react-router';

import { Chapo, Page, TitrePage } from '@/composants/mise-en-page';
import { Carte } from '@/composants/ui';
import { useGestion } from '@/gestion/GestionContext';
import {
  creationDepuisSaisie,
  saisieInitiale,
  type ChampSaisie,
  type SaisieMain,
} from '@/gestion/saisie';
import { ERREURS_GESTION } from '@/textes/gerer';
import {
  DEPOT_PAR_DEFAUT,
  ERREURS_SAISIE,
  LIBELLES_LOCATION,
  LIBELLES_TYPE_BIEN,
  TEXTES_AJOUTER as T,
} from '@/textes/gerer-saisie';

import { ChampGerer, type ChampGererProps } from './ChampGerer';
import { SansCompte } from './SansCompte';

type ChampTexte = Exclude<keyof SaisieMain, 'type' | 'typeBien'>;

const identifiant = (champ: ChampSaisie): string => `saisie-${champ}`;

/** Porte « Ajouter à la main » : un écran, un bouton ; le reste prend des valeurs par défaut. */
export function AjouterMain(): JSX.Element {
  const { statut, creer } = useGestion();
  const naviguer = useNavigate();
  const [saisie, setSaisie] = useState<SaisieMain>(() => saisieInitiale(jourLocal(new Date())));
  const [erreurs, setErreurs] = useState<readonly ChampSaisie[]>([]);
  const [echec, setEchec] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  if (statut === 'anonyme') return <SansCompte />;

  const texte =
    (champ: ChampTexte) =>
    (valeur: string): void => {
      setSaisie((s) => ({ ...s, [champ]: valeur }));
    };
  const erreur = (champ: ChampSaisie): string | undefined =>
    erreurs.includes(champ) ? ERREURS_SAISIE[champ] : undefined;
  const champ = (
    nom: ChampTexte & ChampSaisie,
    libelle: string,
  ): Pick<ChampGererProps, 'id' | 'libelle' | 'valeur' | 'onChange' | 'erreur'> => ({
    id: identifiant(nom),
    libelle,
    valeur: saisie[nom],
    onChange: texte(nom),
    erreur: erreur(nom),
  });

  const soumettre = async (): Promise<void> => {
    const lu = creationDepuisSaisie(saisie);
    if (!lu.ok) {
      setErreurs(lu.erreurs);
      document.getElementById(identifiant(lu.erreurs[0] ?? 'adresse'))?.focus();
      return;
    }
    setErreurs([]);
    setOccupe(true);
    const r = await creer(lu.creation);
    setOccupe(false);
    if (r.ok) void naviguer('/gerer');
    else setEchec(ERREURS_GESTION[r.code]);
  };

  return (
    <Page espacement="large" className="max-w-[760px]">
      <div className="flex flex-col gap-1.5">
        <TitrePage>{T.titre}</TitrePage>
        <Chapo>{T.sous}</Chapo>
      </div>
      <Carte>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void soumettre();
          }}
          className="flex flex-col gap-5"
        >
          <ChampGerer {...champ('adresse', T.adresse)} autoComplete="street-address" />

          <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
            <legend className="mb-1.5 text-sm font-semibold text-encre-2">{T.location}</legend>
            <div className="inline-flex self-start rounded-full bg-bordure-douce p-1">
              {TYPES_LOCATION.map((type: TypeLocation) => (
                <label
                  key={type}
                  className={`flex min-h-11 cursor-pointer items-center rounded-full px-5 text-sm font-bold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent ${
                    saisie.type === type ? 'bg-surface text-encre shadow-carte' : 'text-encre-3'
                  }`}
                >
                  <input
                    type="radio"
                    name="type"
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
            <ChampGerer {...champ('loyer', T.loyer)} inputMode="decimal" unite={T.uniteLoyer} />
            <ChampGerer
              {...champ('charges', T.charges)}
              inputMode="decimal"
              unite={T.uniteCharges}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <ChampGerer
              {...champ('locataire', T.locataire)}
              autoComplete="off"
              aide={T.aideVacant}
            />
            <ChampGerer
              {...champ('email', T.email)}
              type="email"
              inputMode="email"
              autoComplete="off"
            />
          </div>
          <div className="sm:max-w-[260px]">
            <ChampGerer {...champ('entree', T.entree)} type="date" />
          </div>

          <details className="rounded-encart border border-bordure-douce p-3">
            <summary className="flex min-h-11 cursor-pointer items-center font-bold text-accent">
              {T.plusDeDetails}
            </summary>
            <div className="grid gap-4 pt-3 sm:grid-cols-2">
              <ChampGerer
                {...champ('jourLoyer', T.jourLoyer)}
                inputMode="numeric"
                placeholder={T.jourParDefaut}
              />
              <ChampGerer
                {...champ('depot', T.depot)}
                inputMode="decimal"
                unite={T.uniteEuros}
                placeholder={DEPOT_PAR_DEFAUT[saisie.type]}
              />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="saisie-typeBien" className="text-sm font-semibold text-encre-2">
                  {T.typeBien}
                </label>
                <select
                  id="saisie-typeBien"
                  value={saisie.typeBien}
                  onChange={(e) => {
                    const typeBien =
                      TYPES_BIEN.find((t: TypeBien) => t === e.target.value) ?? 'appartement';
                    setSaisie((s) => ({ ...s, typeBien }));
                  }}
                  className="min-h-[48px] w-full rounded-encart border border-bordure bg-surface px-4 text-[16px] text-encre"
                >
                  {TYPES_BIEN.map((t) => (
                    <option key={t} value={t}>
                      {LIBELLES_TYPE_BIEN[t]}
                    </option>
                  ))}
                </select>
              </div>
              <ChampGerer
                {...champ('surface', T.surface)}
                inputMode="decimal"
                unite={T.uniteSurface}
              />
            </div>
          </details>

          {echec !== null && (
            <p
              role="alert"
              className="m-0 rounded-encart bg-probleme-fond p-3 text-sm text-probleme-texte"
            >
              {echec}
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={occupe}
              className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-accent px-8 text-[15px] font-semibold text-white hover:bg-accent-fonce disabled:cursor-not-allowed disabled:opacity-50"
            >
              {T.creer}
            </button>
          </div>
        </form>
      </Carte>
    </Page>
  );
}
