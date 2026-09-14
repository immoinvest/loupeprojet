import type { Groupe, Option } from './types';

const OUI_NON: readonly Option[] = [
  { v: 'oui', l: 'oui' },
  { v: 'non', l: 'non' },
];
const DPE: readonly Option[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((l) => ({ v: l, l }));
const ETATS: readonly Option[] = [
  { v: 'a_renover', l: 'à rénover' },
  { v: 'a_rafraichir', l: 'à rafraîchir' },
  { v: 'bon_etat', l: 'bon état' },
  { v: 'renove', l: 'rénové' },
];

export const OPTIONS_OUI_NON = OUI_NON;

export const GROUPE_BIEN: Groupe = {
  titre: 'Le bien',
  champs: [
    { chemin: 'bien.surface', libelle: 'Surface', type: 'nombre', unite: 'm²', obligatoire: true },
    { chemin: 'bien.pieces', libelle: 'Pièces', type: 'entier', obligatoire: true },
    { chemin: 'bien.chambres', libelle: 'Chambres', type: 'entier' },
    { chemin: 'bien.etage', libelle: 'Étage', type: 'entier' },
    { chemin: 'bien.ascenseur', libelle: 'Ascenseur', type: 'bool', options: OUI_NON },
    { chemin: 'bien.annee', libelle: 'Année de construction', type: 'entier' },
    { chemin: 'bien.dpe', libelle: 'DPE', type: 'enum', options: DPE },
    { chemin: 'bien.etat', libelle: 'État', type: 'enum', options: ETATS },
    { chemin: 'bien.exterieur', libelle: 'Balcon ou terrasse', type: 'bool', options: OUI_NON },
    { chemin: 'bien.departement', libelle: 'Département', type: 'texte', obligatoire: true },
    { chemin: 'bien.copro.lots', libelle: 'Lots de copropriété', type: 'entier' },
  ],
};

export const GROUPE_ACHAT: Groupe = {
  titre: "L'achat",
  champs: [
    {
      chemin: 'hypotheses.achat.prix',
      libelle: 'Prix affiché',
      type: 'euros',
      unite: '€',
      obligatoire: true,
    },
    {
      chemin: 'hypotheses.achat.honorairesAgence',
      libelle: "Honoraires d'agence",
      type: 'euros',
      unite: '€',
    },
    {
      chemin: 'hypotheses.achat.honorairesChargeAcquereur',
      libelle: 'Honoraires à la charge de l’acquéreur',
      type: 'bool',
      options: OUI_NON,
    },
    { chemin: 'hypotheses.achat.travaux', libelle: 'Travaux', type: 'euros', unite: '€' },
    {
      chemin: 'hypotheses.achat.travauxRenovationEnergetique',
      libelle: 'Rénovation énergétique',
      type: 'bool',
      options: OUI_NON,
    },
    { chemin: 'hypotheses.achat.mobilier', libelle: 'Mobilier', type: 'euros', unite: '€' },
  ],
};
