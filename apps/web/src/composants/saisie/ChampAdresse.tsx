import { useId, useState, type JSX } from 'react';

import { useClientWorker } from '@/coque/ClientWorker';
import {
  cleOptionAdresse,
  doitSuggerer,
  fautChercherAuCadastre,
  libelleCadastre,
  lieuDuCadastre,
  optionsAdresse,
  type AdresseDvf,
  type ContexteAdresse,
  type OptionAdresse,
} from '@/enrichissement';
import {
  detailCadastre,
  detailSuggestion,
  phraseContexte,
  PHRASES_ADRESSE,
} from '@/textes/adresse';

import { Combobox } from './Combobox';
import { idsDescription } from './liste';

export interface PropsChampAdresse {
  /** Id de la saisie : le libellé du champ la nomme par `htmlFor`. */
  readonly id: string;
  readonly texte: string;
  readonly onTexte: (texte: string) => void;
  /** Commune du projet et adresse déjà analysée : biais et commune des adresses du cadastre. */
  readonly contexte: ContexteAdresse;
  readonly onChoix: (option: OptionAdresse) => void;
}

type EtatSuggestions = 'normal' | 'aucune' | 'indisponible';

/**
 * L'adresse du bien avec suggestions : adresses de la BAN pendant la frappe (la commune du projet d'abord),
 * complétées par les adresses du cadastre quand la BAN ne peut pas les connaître (numéros fiscaux 9xxx,
 * résidences, cités). Sans Worker, la saisie libre reste possible.
 */
export function ChampAdresse({
  id,
  texte,
  onTexte,
  contexte,
  onChoix,
}: PropsChampAdresse): JSX.Element {
  const client = useClientWorker();
  const idContexte = useId();
  const idEtat = useId();
  const [etat, setEtat] = useState<EtatSuggestions>('normal');
  const aide = phraseContexte(contexte.departement);

  const chercher = async (
    saisi: string,
    signal: AbortSignal,
  ): Promise<readonly OptionAdresse[]> => {
    const recherche = saisi.trim();
    const position =
      contexte.adresse === undefined
        ? null
        : { lat: contexte.adresse.lat, lon: contexte.adresse.lon };
    const ban = await client.suggererAdresses(recherche, position, signal);
    if (!ban.ok) {
      if (!signal.aborted) setEtat('indisponible');
      throw new Error(ban.code);
    }
    const lieu = lieuDuCadastre(ban.valeur, contexte);
    let cadastre: readonly AdresseDvf[] = [];
    if (lieu !== null && fautChercherAuCadastre(recherche, ban.valeur)) {
      // Un Worker d'avant ne connaît pas cette route : les suggestions de la BAN suffisent.
      const reponse = await client.adressesDvf(lieu.codeInsee, recherche, signal);
      if (reponse.ok) cadastre = reponse.valeur;
    }
    const options = optionsAdresse(ban.valeur, cadastre, lieu, contexte.departement);
    if (!signal.aborted) setEtat(options.length === 0 ? 'aucune' : 'normal');
    return options;
  };

  const message =
    etat === 'aucune'
      ? PHRASES_ADRESSE.aucuneSuggestion
      : etat === 'indisponible'
        ? PHRASES_ADRESSE.suggestionsIndisponibles
        : null;

  return (
    <div className="flex flex-col gap-1">
      <Combobox<OptionAdresse>
        id={id}
        nom="adresse"
        texte={texte}
        onTexte={(saisi) => {
          if (!doitSuggerer(saisi)) setEtat('normal');
          onTexte(saisi);
        }}
        chercher={chercher}
        doitChercher={doitSuggerer}
        cleOption={cleOptionAdresse}
        libelleOption={(o) =>
          o.source === 'ban' ? o.suggestion.libelle : libelleCadastre(o.adresse, o.lieu)
        }
        detailOption={(o) =>
          o.source === 'ban'
            ? detailSuggestion(o.suggestion.precision)
            : detailCadastre(o.adresse.ventes)
        }
        onChoix={onChoix}
        // Annonce courte : la phrase complète est affichée sous le champ et le décrit.
        messageAucun="Aucune suggestion"
        decritPar={idsDescription(
          aide === null ? undefined : idContexte,
          message === null ? undefined : idEtat,
        )}
        placeholder="144 rue de l'Olivier 13005 Marseille"
        autoComplete="street-address"
      />
      {aide !== null && (
        <span id={idContexte} className="text-xs text-encre-3">
          {aide}
        </span>
      )}
      {message !== null && (
        <span id={idEtat} className="text-xs text-encre-3">
          {message}
        </span>
      )}
    </div>
  );
}
