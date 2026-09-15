import type { JSX } from 'react';

import { ChampMontant } from '@/composants/saisie/ChampMontant';
import { Compteur } from '@/composants/saisie/Compteur';
import type { PasCompteur } from '@/composants/saisie/pas';
import { Tuiles } from '@/composants/saisie/Tuiles';
import type { CodeTerme } from '@/textes/glossaire';

import { Champ } from './Champ';
import { OUI_NON, type ContexteFormulaire, type OuiNon } from './contexte';
import type { Cle } from './valeurs';

interface Base {
  readonly c: ContexteFormulaire;
  readonly cle: Cle;
  readonly libelle: string;
  readonly terme?: CodeTerme | undefined;
  readonly aToi?: boolean;
  readonly indication?: string | undefined;
}

/** Un montant (prix, loyer, charges) : saisie mise en forme, pavé numérique. */
export function Montant({
  c,
  cle,
  libelle,
  terme,
  aToi = false,
  indication,
  unite,
  decimales = 0,
}: Base & { readonly unite: string; readonly decimales?: number }): JSX.Element {
  return (
    <Champ
      libelle={libelle}
      provenance={c.provenance[cle]}
      erreur={c.erreurs[cle]}
      terme={terme}
      aToi={aToi}
      indication={indication}
    >
      {({ id, decritPar, invalide }) => (
        <ChampMontant
          id={id}
          nom={cle}
          valeur={c.valeurs[cle]}
          onChange={(v) => {
            c.changer(cle, v);
          }}
          unite={unite}
          decimales={decimales}
          decritPar={decritPar}
          invalide={invalide}
        />
      )}
    </Champ>
  );
}

/** Oui / Non, aucune tuile = inconnu. */
export function OuiNonChamp({ c, cle, libelle, terme }: Base): JSX.Element {
  return (
    <Champ groupe libelle={libelle} provenance={c.provenance[cle]} terme={terme}>
      {({ idLibelle, decritPar }) => (
        <Tuiles<OuiNon>
          nom={cle}
          idLibelle={idLibelle}
          decritPar={decritPar}
          options={OUI_NON}
          valeur={c.valeurs[cle] as OuiNon | ''}
          effacable
          onChange={(v) => {
            c.changer(cle, v);
          }}
        />
      )}
    </Champ>
  );
}

/** Un nombre qu'on compte (pièces, étage, lots) : − / valeur / +. */
export function CompteurChamp({
  c,
  cle,
  libelle,
  terme,
  aToi = false,
  min,
  max,
  pas,
  moins,
  plus,
  suffixe,
  onChange = (v) => {
    c.changer(cle, v);
  },
}: Base & {
  readonly min: number;
  readonly max: number;
  readonly pas?: PasCompteur;
  readonly moins: string;
  readonly plus: string;
  readonly suffixe?: (n: number) => string | undefined;
  readonly onChange?: (valeur: string) => void;
}): JSX.Element {
  return (
    <Champ
      libelle={libelle}
      provenance={c.provenance[cle]}
      erreur={c.erreurs[cle]}
      terme={terme}
      aToi={aToi}
    >
      {({ id, decritPar, invalide }) => (
        <Compteur
          id={id}
          nom={cle}
          valeur={c.valeurs[cle]}
          onChange={onChange}
          min={min}
          max={max}
          {...(pas === undefined ? {} : { pas })}
          nomMoins={moins}
          nomPlus={plus}
          suffixe={suffixe}
          decritPar={decritPar}
          invalide={invalide}
        />
      )}
    </Champ>
  );
}
