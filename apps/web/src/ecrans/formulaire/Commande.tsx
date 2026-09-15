import { Building2, House } from 'lucide-react';
import type { JSX } from 'react';

import { ChampCommune } from '@/composants/saisie/ChampCommune';
import { EchelleEnergie } from '@/composants/saisie/EchelleEnergie';
import { pasAdaptatif } from '@/composants/saisie/pas';
import { Tuiles } from '@/composants/saisie/Tuiles';
import type { Item } from '@/verifier/items';

import { SelecteurMode } from '../hypotheses/SelecteurMode';
import { Champ } from './Champ';
import { ChoixAnnee } from './ChoixAnnee';
import { ChoixApport } from './ChoixApport';
import { ChoixDuree } from './ChoixDuree';
import { ChoixLoyer } from './ChoixLoyer';
import { ChoixTravaux } from './ChoixTravaux';
import { CompteurChamp, Montant, OuiNonChamp } from './Commandes';
import type { ContexteFormulaire } from './contexte';

type TypeBienSaisi = 'appartement' | 'maison';
type Etat = 'a_renover' | 'a_rafraichir' | 'bon_etat' | 'renove';
type Tranche = '0' | '0.11' | '0.3' | '0.41' | '0.45';

const TYPES: readonly { valeur: TypeBienSaisi; libelle: string; icone: JSX.Element }[] = [
  {
    valeur: 'appartement',
    libelle: 'Appartement',
    icone: <Building2 size={18} aria-hidden="true" />,
  },
  { valeur: 'maison', libelle: 'Maison', icone: <House size={18} aria-hidden="true" /> },
];
const ETATS: readonly { valeur: Etat; libelle: string }[] = [
  { valeur: 'a_renover', libelle: 'À rénover' },
  { valeur: 'a_rafraichir', libelle: 'À rafraîchir' },
  { valeur: 'bon_etat', libelle: 'Bon état' },
  { valeur: 'renove', libelle: 'Rénové' },
];
const TRANCHES: readonly { valeur: Tranche; libelle: string }[] = [
  { valeur: '0', libelle: '0 %' },
  { valeur: '0.11', libelle: '11 %' },
  { valeur: '0.3', libelle: '30 %' },
  { valeur: '0.41', libelle: '41 %' },
  { valeur: '0.45', libelle: '45 %' },
];
const PAS_LOTS = pasAdaptatif(20, 10);

export const PHRASES_FORMULAIRE = {
  tranche: 'Sur votre avis d’impôt : « taux marginal d’imposition ».',
} as const;

/** La commande d'un item du formulaire Vérifier, choisie selon la nature de la donnée. */
export function Commande({ item, c }: { item: Item; c: ContexteFormulaire }): JSX.Element {
  const { valeurs: v, provenance: p } = c;
  switch (item) {
    case 'typeBien':
      return (
        <Champ groupe libelle="Type de bien" provenance={p.typeBien}>
          {({ idLibelle }) => (
            <Tuiles<TypeBienSaisi>
              nom="typeBien"
              idLibelle={idLibelle}
              options={TYPES}
              valeur={v.typeBien as TypeBienSaisi}
              onChange={(type) => {
                if (type !== '') c.changer('typeBien', type);
              }}
            />
          )}
        </Champ>
      );
    case 'prix':
      return <Montant c={c} cle="prix" libelle="Prix affiché" unite="€" />;
    case 'honorairesAgence':
      return (
        <Montant
          c={c}
          cle="honorairesAgence"
          libelle="dont honoraires d'agence"
          unite="€"
          terme="honorairesAcquereur"
        />
      );
    case 'surface':
      return <Montant c={c} cle="surface" libelle="Surface" unite="m²" decimales={2} />;
    case 'commune': {
      const erreurs = [c.erreurs.codePostal, c.erreurs.ville].filter((e) => e !== undefined);
      return (
        <Champ
          libelle="Commune"
          provenance={p.codePostal ?? p.ville}
          erreur={erreurs.length === 0 ? undefined : erreurs.join(' ')}
        >
          {({ id, decritPar, invalide }) => (
            <ChampCommune
              id={id}
              nom="commune"
              codePostal={v.codePostal}
              ville={v.ville}
              onChange={({ codePostal, ville }) => {
                c.poser({ codePostal, ville }, { codePostal: 'utilisateur', ville: 'utilisateur' });
              }}
              decritPar={decritPar}
              invalide={invalide}
            />
          )}
        </Champ>
      );
    }
    case 'pieces':
      return (
        <CompteurChamp
          c={c}
          cle="pieces"
          libelle="Pièces"
          min={1}
          max={10}
          moins="Une pièce de moins"
          plus="Une pièce de plus"
          onChange={c.changerPieces}
        />
      );
    case 'chambres':
      return (
        <CompteurChamp
          c={c}
          cle="chambres"
          libelle="Chambres"
          min={0}
          max={9}
          moins="Une chambre de moins"
          plus="Une chambre de plus"
        />
      );
    case 'etage':
      return (
        <CompteurChamp
          c={c}
          cle="etage"
          libelle="Étage"
          min={0}
          max={30}
          moins="Un étage de moins"
          plus="Un étage de plus"
          suffixe={(n) => (n === 0 ? 'RDC' : undefined)}
        />
      );
    case 'ascenseur':
      return <OuiNonChamp c={c} cle="ascenseur" libelle="Ascenseur" />;
    case 'exterieur':
      return <OuiNonChamp c={c} cle="exterieur" libelle="Balcon ou terrasse" />;
    case 'venduLoue':
      return <OuiNonChamp c={c} cle="venduLoue" libelle="Vendu loué" terme="venduLoue" />;
    case 'coproEnProcedure':
      return (
        <OuiNonChamp
          c={c}
          cle="coproEnProcedure"
          libelle="Copropriété en procédure"
          terme="coproEnProcedure"
        />
      );
    case 'annee':
      return <ChoixAnnee c={c} />;
    case 'dpe':
    case 'ges':
      return (
        <Champ
          groupe
          large
          libelle={item === 'dpe' ? 'DPE' : 'GES'}
          provenance={p[item]}
          terme={item}
        >
          {({ idLibelle }) => (
            <EchelleEnergie
              nom={item}
              variante={item}
              idLibelle={idLibelle}
              valeur={v[item]}
              onChange={(lettre) => {
                c.changer(item, lettre);
              }}
            />
          )}
        </Champ>
      );
    case 'etat':
      return (
        <Champ groupe large libelle="État" provenance={p.etat}>
          {({ idLibelle }) => (
            <Tuiles<Etat>
              nom="etat"
              idLibelle={idLibelle}
              options={ETATS}
              valeur={v.etat as Etat | ''}
              effacable
              onChange={(etat) => {
                c.changer('etat', etat);
              }}
            />
          )}
        </Champ>
      );
    case 'travaux':
      return <ChoixTravaux c={c} />;
    case 'mode':
      return (
        <Champ groupe large aToi libelle="Type de location" provenance={p.mode}>
          {() => (
            <SelecteurMode
              nom="type-location-verifier"
              valeur={v.mode as Parameters<typeof SelecteurMode>[0]['valeur']}
              onChange={c.changerMode}
            />
          )}
        </Champ>
      );
    case 'loyer':
      return <ChoixLoyer c={c} />;
    case 'apport':
      return <ChoixApport c={c} />;
    case 'dureeAnnees':
      return <ChoixDuree c={c} />;
    case 'tmi':
      return (
        <Champ
          groupe
          large
          aToi
          libelle="Tranche d'imposition"
          provenance={p.tmi}
          indication={PHRASES_FORMULAIRE.tranche}
          terme="tmi"
        >
          {({ idLibelle, decritPar }) => (
            <Tuiles<Tranche>
              nom="tmi"
              idLibelle={idLibelle}
              decritPar={decritPar}
              options={TRANCHES}
              valeur={v.tmi as Tranche | ''}
              onChange={(tranche) => {
                if (tranche !== '') c.changer('tmi', tranche);
              }}
            />
          )}
        </Champ>
      );
    case 'chargesCoproMois':
      return (
        <Montant
          c={c}
          cle="chargesCoproMois"
          libelle="Charges de copropriété"
          unite="€/mois"
          terme="chargesCopro"
        />
      );
    case 'taxeFonciere':
      return <Montant c={c} cle="taxeFonciere" libelle="Taxe foncière" unite="€/an" />;
    case 'lotsCopro':
      return (
        <CompteurChamp
          c={c}
          cle="lotsCopro"
          libelle="Lots de copropriété"
          terme="lotsCopro"
          min={1}
          max={9999}
          pas={PAS_LOTS}
          moins="Moins de lots"
          plus="Plus de lots"
        />
      );
  }
}
