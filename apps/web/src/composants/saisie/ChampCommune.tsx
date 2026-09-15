import { useId, useState, type JSX } from 'react';

import { useModeDocument } from '@/composants/document';
import { useClientWorker } from '@/coque/ClientWorker';
import {
  lireSaisieCommune,
  optionUnique,
  optionsCommunes,
  rechercheDepuisTexte,
  texteCommune,
  type OptionCommune,
  type SaisieCommune,
} from '@/enrichissement/communes';

import { Combobox } from './Combobox';
import { idsDescription } from './liste';

export const PHRASES_COMMUNE = {
  aucune: 'Aucune commune trouvée',
  indisponible:
    'Recherche des communes indisponible : tapez le code postal puis la ville, par exemple « 69003 Lyon ».',
} as const;

export interface PropsChampCommune {
  /** Id de la saisie : le libellé du champ la nomme par `htmlFor`. */
  readonly id: string;
  readonly nom?: string | undefined;
  readonly codePostal: string;
  readonly ville: string;
  /** À chaque frappe (lecture du texte) et à chaque choix dans la liste. */
  readonly onChange: (saisie: SaisieCommune) => void;
  readonly decritPar?: string | undefined;
  readonly invalide?: boolean;
}

const cle = (o: OptionCommune): string => `${o.codeInsee}-${o.codePostal}`;

/**
 * Un seul champ pour le code postal et la ville : cinq chiffres choisissent la commune (ou la proposent
 * s'il y en a plusieurs), un nom propose les communes qui commencent ainsi. Sans réponse du Worker, le
 * texte « 69003 Lyon » suffit : code postal et ville y sont lus.
 */
export function ChampCommune({
  id,
  nom,
  codePostal,
  ville,
  onChange,
  decritPar,
  invalide = false,
}: PropsChampCommune): JSX.Element {
  const client = useClientWorker();
  const document = useModeDocument();
  const idIndisponible = useId();
  const [texte, setTexte] = useState(() => texteCommune(codePostal, ville));
  const [indisponible, setIndisponible] = useState(false);

  if (document) {
    return <span className="text-[15px] font-semibold">{texteCommune(codePostal, ville)}</span>;
  }

  const chercher = async (
    saisi: string,
    signal: AbortSignal,
  ): Promise<readonly OptionCommune[]> => {
    const recherche = rechercheDepuisTexte(saisi);
    if (recherche === null) return [];
    const reponse = await client.communes(recherche.recherche, signal);
    if (!reponse.ok) {
      setIndisponible(true);
      throw new Error(reponse.code);
    }
    setIndisponible(false);
    return optionsCommunes(reponse.valeur, recherche);
  };

  return (
    <div className="flex flex-col gap-1">
      <Combobox<OptionCommune>
        id={id}
        nom={nom}
        texte={texte}
        onTexte={(saisi) => {
          setTexte(saisi);
          onChange(lireSaisieCommune(saisi));
        }}
        chercher={chercher}
        doitChercher={(saisi) => rechercheDepuisTexte(saisi) !== null}
        cleOption={cle}
        libelleOption={(o) => o.nom}
        detailOption={(o) => o.codePostal}
        onChoix={(o) => {
          setTexte(texteCommune(o.codePostal, o.nom));
          onChange({ codePostal: o.codePostal, ville: o.nom });
        }}
        choixAutomatique={(options, saisi) => {
          const recherche = rechercheDepuisTexte(saisi);
          return recherche === null ? null : optionUnique(options, recherche);
        }}
        messageAucun={PHRASES_COMMUNE.aucune}
        decritPar={idsDescription(decritPar, indisponible ? idIndisponible : undefined)}
        invalide={invalide}
        placeholder="Code postal ou ville"
        autoComplete="postal-code"
      />
      {indisponible && (
        <span id={idIndisponible} className="text-xs text-encre-3">
          {PHRASES_COMMUNE.indisponible}
        </span>
      )}
    </div>
  );
}
