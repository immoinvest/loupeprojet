import { IdentiteBailleurSchema, type IdentiteBailleur as Identite } from '@loupe/gestion';
import { useState, type JSX } from 'react';

import { Bouton, Carte, TitreCarte } from '@/composants/ui';
import {
  ERREURS_BAILLEUR,
  TEXTES_BAILLEUR as T,
  type ChampBailleur,
} from '@/textes/gerer-bailleur';

import { ChampGerer } from './ChampGerer';

export interface IdentiteBailleurProps {
  /** Ce qui est déjà connu (aucun champ la première fois). */
  readonly initiale?: Identite | null | undefined;
  readonly occupe: boolean;
  /** Une erreur de l'API à afficher sous le formulaire. */
  readonly erreur?: string | null | undefined;
  readonly onEnregistrer: (identite: Identite) => Promise<void>;
  readonly onAnnuler: () => void;
}

const identifiant = (champ: ChampBailleur): string => `bailleur-${champ}`;

/** Les champs refusés par le schéma, dans l'ordre de l'écran. */
function champsInvalides(nom: string, adresse: string): ChampBailleur[] {
  const lu = IdentiteBailleurSchema.safeParse({ nom, adresse });
  if (lu.success) return [];
  const chemins = new Set(lu.error.issues.map((i) => String(i.path[0])));
  return (['nom', 'adresse'] as const).filter((champ) => chemins.has(champ));
}

/** Nom et adresse du bailleur, demandés une seule fois, juste avant la première quittance. */
export function IdentiteBailleur({
  initiale,
  occupe,
  erreur,
  onEnregistrer,
  onAnnuler,
}: IdentiteBailleurProps): JSX.Element {
  const [nom, setNom] = useState(initiale?.nom ?? '');
  const [adresse, setAdresse] = useState(initiale?.adresse ?? '');
  const [erreurs, setErreurs] = useState<readonly ChampBailleur[]>([]);
  const message = (champ: ChampBailleur): string | undefined =>
    erreurs.includes(champ) ? ERREURS_BAILLEUR[champ] : undefined;

  const enregistrer = async (): Promise<void> => {
    const invalides = champsInvalides(nom, adresse);
    if (invalides.length > 0) {
      setErreurs(invalides);
      document.getElementById(identifiant(invalides[0] ?? 'nom'))?.focus();
      return;
    }
    setErreurs([]);
    await onEnregistrer(IdentiteBailleurSchema.parse({ nom, adresse }));
  };

  return (
    <Carte className="border-accent-bordure">
      <TitreCarte>{T.titre}</TitreCarte>
      <p className="m-0 text-[15px] text-encre-2">{T.phrase}</p>
      <form
        aria-label={T.titre}
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void enregistrer();
        }}
      >
        <ChampGerer
          id={identifiant('nom')}
          libelle={T.nom}
          valeur={nom}
          onChange={setNom}
          erreur={message('nom')}
          autoComplete="name"
        />
        <ChampGerer
          id={identifiant('adresse')}
          libelle={T.adresse}
          valeur={adresse}
          onChange={setAdresse}
          erreur={message('adresse')}
          autoComplete="street-address"
        />
        {erreur !== null && erreur !== undefined && (
          <p
            role="alert"
            className="m-0 rounded-encart bg-probleme-fond p-3 text-sm text-probleme-texte"
          >
            {erreur}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <Bouton disabled={occupe} onClick={onAnnuler}>
            {T.annuler}
          </Bouton>
          <Bouton variante="primaire" type="submit" disabled={occupe}>
            {T.enregistrer}
          </Bouton>
        </div>
      </form>
    </Carte>
  );
}
