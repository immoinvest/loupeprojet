import { VERSION_REGLES_COURANTE, obtenirRegles, type ModeLocation } from '@loupe/moteur';
import { useEffect, useRef, useState, type JSX } from 'react';

import type { AnnonceResolue, Provenance, SaisieProjet } from '@/annonces';
import { Bouton, Carte } from '@/composants/ui';
import { avecChambresEstimees } from '@/verifier/deductions';
import {
  groupeDeItem,
  grouperChamps,
  itemsVisibles,
  provenanceEnvoyee,
  resumeEstimes,
  resumeLus,
  resumePreciser,
  sansValeursMasquees,
  type NomGroupe,
} from '@/verifier/groupes';
import { itemDeCle, type Item } from '@/verifier/items';
import { periodesConstruction } from '@/verifier/periodes';

import { Commande } from './formulaire/Commande';
import { GRILLE, type ContexteFormulaire } from './formulaire/contexte';
import type { CleLoyerEstime } from './formulaire/EstimerLoyer';
import { GroupeReplie } from './formulaire/Groupe';
import {
  apercuApport,
  nombre,
  valider,
  versSaisie,
  type Cle,
  type Erreurs,
  type ProvenanceValeurs,
  type ValeursInitiales,
  type Valeurs,
} from './formulaire/valeurs';

export { valeursDepuisChamps } from './formulaire/valeurs';

/** Ce que le formulaire dit du projet sans passer par le moteur. */
export interface OptionsFormulaire {
  /** La personne a déjà visité le bien : l'onglet Visite n'a pas lieu d'être. */
  readonly visiteFaite: boolean;
}

const PERIODES = periodesConstruction(obtenirRegles(VERSION_REGLES_COURANTE));
const REPLIABLES = ['lus', 'estimes', 'preciser'] as const;

/** Le nom de la saisie qui reçoit le focus pour une clé en erreur (code postal et ville : la commune). */
const nomSaisie = (cle: Cle): string => (cle === 'codePostal' || cle === 'ville' ? 'commune' : cle);

/**
 * L'étape « Vérifier » : le strict minimum d'abord. Ce qui manque parmi l'essentiel est en haut ; ce que
 * l'annonce a donné, ce qui est estimé et le facultatif sont repliés en une ligne chacun.
 */
export function FormulaireProjet({
  initial,
  annonce,
  onCreer,
}: {
  initial: ValeursInitiales;
  annonce: AnnonceResolue | null;
  onCreer: (saisie: SaisieProjet, options: OptionsFormulaire) => void;
}): JSX.Element {
  const [depart] = useState(() => avecChambresEstimees(initial.valeurs, initial.provenance));
  const [valeurs, setValeurs] = useState<Valeurs>(depart.valeurs);
  const [provenance, setProvenance] = useState<ProvenanceValeurs>(depart.provenance);
  // Figé à l'ouverture : un champ ne change pas de groupe pendant qu'on le remplit.
  const [groupes] = useState(() => grouperChamps(depart.valeurs, depart.provenance));
  const [ouverts, setOuverts] = useState<ReadonlySet<NomGroupe>>(new Set());
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [visiteFaite, setVisiteFaite] = useState(false);
  const [aFocaliser, setAFocaliser] = useState<Cle | null>(null);
  const formulaire = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (aFocaliser === null) return;
    formulaire.current?.querySelector<HTMLElement>(`[name="${nomSaisie(aFocaliser)}"]`)?.focus();
    setAFocaliser(null);
  }, [aFocaliser]);

  const changer = (cle: Cle, v: string): void => {
    setValeurs((prev) => ({ ...prev, [cle]: v }));
    setProvenance((prev) => ({ ...prev, [cle]: 'utilisateur' }));
  };
  const poser: ContexteFormulaire['poser'] = (maj, sources) => {
    setValeurs((prev) => ({ ...prev, ...maj }));
    setProvenance((prev) => {
      const suivante: Partial<Record<Cle, Provenance | undefined>> = { ...prev, ...sources };
      return Object.fromEntries(
        Object.entries(suivante).filter(([, source]) => source !== undefined),
      );
    });
  };
  const changerPieces = (v: string): void => {
    const suivant = avecChambresEstimees(
      { ...valeurs, pieces: v },
      { ...provenance, pieces: 'utilisateur' },
    );
    setValeurs(suivant.valeurs);
    setProvenance(suivant.provenance);
  };
  const changerMode = (m: ModeLocation): void => {
    changer('mode', m);
    // En colocation, les chambres du bien sont une bonne première valeur des chambres louées.
    if (m === 'colocation' && valeurs.chambresLouees === '' && valeurs.chambres !== '') {
      setValeurs((prev) => ({ ...prev, chambresLouees: prev.chambres }));
    }
  };
  const loyerEstime = (cle: CleLoyerEstime, v: string): void => {
    poser({ [cle]: v }, { [cle]: 'estime' });
  };

  const apport = apercuApport(valeurs, provenance);
  const c: ContexteFormulaire = {
    valeurs,
    provenance,
    erreurs,
    apport,
    periodes: PERIODES,
    changer,
    poser,
    changerPieces,
    changerMode,
    loyerEstime,
  };

  const basculer = (nom: NomGroupe): void => {
    setOuverts((prev) => {
      const suivants = new Set(prev);
      if (suivants.has(nom)) suivants.delete(nom);
      else suivants.add(nom);
      return suivants;
    });
  };

  const creer = (): void => {
    const envoyees = sansValeursMasquees(valeurs);
    const trouvees = valider(envoyees);
    setErreurs(trouvees);
    const enErreur = Object.keys(trouvees) as Cle[];
    const [premiere] = enErreur;
    if (premiere === undefined) {
      const sources = provenanceEnvoyee(valeurs, envoyees, provenance);
      onCreer(versSaisie(envoyees, sources, annonce), { visiteFaite });
      return;
    }
    // Un champ en erreur dans un groupe replié : le groupe s'ouvre et le champ prend le focus.
    setOuverts(
      (prev) => new Set([...prev, ...enErreur.map((cle) => groupeDeItem(groupes, itemDeCle(cle)))]),
    );
    setAFocaliser(premiere);
  };

  const coutTotal = apport.coutTotal;
  const partApport =
    coutTotal === null || coutTotal <= 0 ? null : (nombre(apport.texte) ?? 0) / coutTotal;
  const resume = (nom: (typeof REPLIABLES)[number], items: readonly Item[]): string => {
    if (nom === 'lus') return resumeLus(items);
    return nom === 'estimes' ? resumeEstimes(items, valeurs, partApport) : resumePreciser(items);
  };

  return (
    <form
      ref={formulaire}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        creer();
      }}
      className="flex flex-col gap-4"
    >
      <Carte>
        <h2 className="m-0 font-display text-[22px] font-semibold">L'essentiel</h2>
        <div className={GRILLE}>
          {itemsVisibles(groupes.essentiel, valeurs).map((item) => (
            <Commande key={item} item={item} c={c} />
          ))}
        </div>
      </Carte>

      {REPLIABLES.map((nom) => {
        const items = itemsVisibles(groupes[nom], valeurs);
        if (items.length === 0) return null;
        return (
          <GroupeReplie
            key={nom}
            nom={nom}
            resume={resume(nom, items)}
            items={items}
            ouvert={ouverts.has(nom)}
            onBasculer={() => {
              basculer(nom);
            }}
            c={c}
          />
        );
      })}

      <label className="flex min-h-[44px] w-fit cursor-pointer items-center gap-3 rounded-encart px-2 text-[15px] survol-fond">
        <input
          type="checkbox"
          role="switch"
          checked={visiteFaite}
          onChange={(e) => {
            setVisiteFaite(e.target.checked);
          }}
          className="relative h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-encre-4 transition-colors before:absolute before:top-0.5 before:left-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:transition-transform checked:bg-accent checked:before:translate-x-5"
        />
        <span>
          J'ai déjà visité ce bien{' '}
          <span className="text-sm text-encre-3">(la liste de visite ne sera pas proposée)</span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Bouton variante="primaire" type="submit">
          Créer le projet et voir le rapport
        </Bouton>
        <span className="text-sm text-encre-3">Tout reste modifiable ensuite.</span>
      </div>
    </form>
  );
}
