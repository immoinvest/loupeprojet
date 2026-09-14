import type { ModeLocation } from '@loupe/moteur';
import { useState, type JSX } from 'react';

import type { AnnonceResolue, SaisieProjet } from '@/annonces';
import { Bouton, Carte, Pastille } from '@/composants/ui';
import { TYPES_LOCATION } from '@/textes/regimes';

import { Champ } from './formulaire/Champ';
import { EstimerLoyer, type CleLoyerEstime } from './formulaire/EstimerLoyer';
import {
  nombre,
  valider,
  versSaisie,
  type Cle,
  type Erreurs,
  type ValeursInitiales,
  type Valeurs,
} from './formulaire/valeurs';
import { SelecteurMode } from './hypotheses/SelecteurMode';

export { valeursDepuisChamps } from './formulaire/valeurs';

const OUI_NON = [
  { v: '', l: '?' },
  { v: 'oui', l: 'oui' },
  { v: 'non', l: 'non' },
];
const DPE = [{ v: '', l: '?' }, ...['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((l) => ({ v: l, l }))];
const ETATS = [
  { v: '', l: '?' },
  { v: 'a_renover', l: 'À rénover' },
  { v: 'a_rafraichir', l: 'À rafraîchir' },
  { v: 'bon_etat', l: 'Bon état' },
  { v: 'renove', l: 'Rénové' },
];
const TYPES = [
  { v: 'appartement', l: 'Appartement' },
  { v: 'maison', l: 'Maison' },
];
const TMI = [
  { v: '0', l: '0 %' },
  { v: '0.11', l: '11 %' },
  { v: '0.3', l: '30 %' },
  { v: '0.41', l: '41 %' },
  { v: '0.45', l: '45 %' },
];

/** Ce que le formulaire dit du projet sans passer par le moteur. */
export interface OptionsFormulaire {
  /** La personne a déjà visité le bien : l'onglet Visite n'a pas lieu d'être. */
  readonly visiteFaite: boolean;
}

const GRILLE = 'grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3';

export function FormulaireProjet({
  initial,
  annonce,
  onCreer,
}: {
  initial: ValeursInitiales;
  annonce: AnnonceResolue | null;
  onCreer: (saisie: SaisieProjet, options: OptionsFormulaire) => void;
}): JSX.Element {
  const [valeurs, setValeurs] = useState<Valeurs>(initial.valeurs);
  const [provenance, setProvenance] = useState(initial.provenance);
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [visiteFaite, setVisiteFaite] = useState(false);

  // Les travaux sont facultatifs : le champ n'apparaît que si l'on en prévoit.
  const [travauxOuverts, setTravauxOuverts] = useState((nombre(initial.valeurs.travaux) ?? 0) > 0);

  const changer = (cle: Cle, v: string): void => {
    setValeurs((prev) => ({ ...prev, [cle]: v }));
    setProvenance((prev) => ({ ...prev, [cle]: 'utilisateur' }));
  };
  const c = { valeurs, provenance, onChange: changer };
  const loyerEstime = (cle: CleLoyerEstime, v: string): void => {
    setValeurs((prev) => ({ ...prev, [cle]: v }));
    setProvenance((prev) => ({ ...prev, [cle]: 'estime' }));
  };
  const mode = valeurs.mode as ModeLocation;
  const changerMode = (m: ModeLocation): void => {
    changer('mode', m);
    // En colocation, les chambres du bien sont une bonne première valeur des chambres louées.
    if (m === 'colocation' && valeurs.chambresLouees === '' && valeurs.chambres !== '') {
      setValeurs((prev) => ({ ...prev, chambresLouees: prev.chambres }));
    }
  };
  const basculerTravaux = (): void => {
    if (travauxOuverts) setValeurs((prev) => ({ ...prev, travaux: '' }));
    setTravauxOuverts(!travauxOuverts);
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const trouvees = valider(valeurs);
        setErreurs(trouvees);
        if (Object.keys(trouvees).length === 0) {
          onCreer(versSaisie(valeurs, provenance, annonce), { visiteFaite });
        }
      }}
      className="flex flex-col gap-5"
    >
      <Carte>
        <h2 className="m-0 font-display text-[22px] font-semibold">Le bien</h2>
        <div className={GRILLE}>
          <Champ cle="typeBien" libelle="Type de bien" options={TYPES} {...c} />

          <Champ cle="prix" libelle="Prix affiché" unite="€" erreur={erreurs.prix} {...c} />
          <Champ cle="honorairesAgence" libelle="dont honoraires d'agence" unite="€" {...c} />
          <Champ cle="surface" libelle="Surface" unite="m²" erreur={erreurs.surface} {...c} />
          <Champ cle="pieces" libelle="Pièces" {...c} />
          <Champ cle="chambres" libelle="Chambres" {...c} />
          <Champ cle="etage" libelle="Étage" {...c} />
          <Champ cle="ascenseur" libelle="Ascenseur" options={OUI_NON} {...c} />
          <Champ cle="annee" libelle="Année de construction" {...c} />
          <Champ cle="dpe" libelle="DPE" options={DPE} {...c} />
          <Champ cle="ges" libelle="GES" options={DPE} {...c} />
          <Champ cle="etat" libelle="État" options={ETATS} {...c} />
          <Champ cle="exterieur" libelle="Balcon ou terrasse" options={OUI_NON} {...c} />
          <Champ cle="codePostal" libelle="Code postal" erreur={erreurs.codePostal} {...c} />
          <Champ cle="ville" libelle="Ville" erreur={erreurs.ville} {...c} />
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            aria-expanded={travauxOuverts}
            aria-controls="champ-travaux"
            onClick={basculerTravaux}
            className="inline-flex min-h-[44px] items-center gap-2 self-start rounded-full border border-bordure bg-surface px-4 text-sm font-semibold text-encre-2 hover:bg-accent-fond"
          >
            {travauxOuverts ? '− Retirer les travaux' : '+ Ajouter des travaux'}
          </button>
          {travauxOuverts && (
            <div id="champ-travaux" className={GRILLE}>
              <Champ cle="travaux" libelle="Travaux prévus" unite="€" {...c} />
            </div>
          )}
        </div>
      </Carte>

      <Carte>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="m-0 font-display text-[22px] font-semibold">
            La location — {TYPES_LOCATION[mode]}
          </h2>
          {provenance.mode === 'annonce' && (
            <Pastille ton="neutre" compacte>
              annonce
            </Pastille>
          )}
        </div>
        <SelecteurMode nom="type-location-verifier" valeur={mode} onChange={changerMode} />
        <div className={GRILLE}>
          {(mode === 'nu' || mode === 'meuble' || mode === 'moyenne_duree') && (
            <Champ
              cle="loyerHc"
              libelle="Loyer visé, hors charges"
              unite="€/mois"
              aToi
              erreur={erreurs.loyerHc}
              {...c}
            />
          )}
          {mode === 'colocation' && (
            <>
              <Champ
                cle="chambresLouees"
                libelle="Chambres louées"
                aToi
                erreur={erreurs.chambresLouees}
                {...c}
              />
              <Champ
                cle="loyerChambre"
                libelle="Loyer par chambre, hors charges"
                unite="€/mois"
                aToi
                erreur={erreurs.loyerChambre}
                {...c}
              />
            </>
          )}
          {mode === 'courte_duree' && (
            <>
              <Champ
                cle="nuitee"
                libelle="Prix de la nuitée, hors ménage"
                unite="€"
                aToi
                erreur={erreurs.nuitee}
                {...c}
              />
              <Champ
                cle="nuiteesParMois"
                libelle="Nuits louées par mois"
                unite="nuits"
                aToi
                erreur={erreurs.nuiteesParMois}
                {...c}
              />
            </>
          )}
          <EstimerLoyer valeurs={valeurs} onEstime={loyerEstime} />
        </div>
        <p className="m-0 text-sm text-encre-3">
          Vacance, ménage, plateforme et charges comprises partent des valeurs de référence du type,
          marquées « estimé » et modifiables dans les hypothèses.
        </p>
      </Carte>

      <Carte>
        <h2 className="m-0 font-display text-[22px] font-semibold">Vous</h2>
        <div className={GRILLE}>
          <Champ cle="apport" libelle="Apport" unite="€" aToi erreur={erreurs.apport} {...c} />
          <Champ
            cle="dureeAnnees"
            libelle="Durée du prêt"
            unite="ans"
            aToi
            erreur={erreurs.dureeAnnees}
            {...c}
          />
          <Champ cle="tmi" libelle="Tranche d'imposition" options={TMI} aToi {...c} />
        </div>
      </Carte>

      <Carte>
        <h2 className="m-0 font-display text-[22px] font-semibold">Charges connues</h2>
        <p className="m-0 text-sm text-encre-2">
          Laissez vide si vous ne savez pas : on estime, et ce sera marqué comme tel.
        </p>
        <div className={GRILLE}>
          <Champ cle="chargesCoproMois" libelle="Charges de copropriété" unite="€/mois" {...c} />
          <Champ cle="taxeFonciere" libelle="Taxe foncière" unite="€/an" {...c} />
          <Champ cle="lotsCopro" libelle="Lots de copropriété" {...c} />
          <Champ
            cle="coproEnProcedure"
            libelle="Copropriété en procédure"
            options={OUI_NON}
            {...c}
          />
        </div>
      </Carte>

      <label className="flex min-h-[44px] w-fit cursor-pointer items-center gap-3 rounded-encart px-2 text-[15px] hover:bg-accent-fond">
        <input
          type="checkbox"
          checked={visiteFaite}
          onChange={(e) => {
            setVisiteFaite(e.target.checked);
          }}
          className="h-5 w-5 accent-accent"
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
