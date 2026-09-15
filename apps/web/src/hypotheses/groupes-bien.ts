import { VERSION_REGLES_COURANTE, obtenirRegles, type ProjetEntree } from '@loupe/moteur';

import { pasAdaptatif } from '@/composants/saisie/pas';
import { euros } from '@/formatage/nombres';

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
    {
      chemin: 'bien.pieces',
      libelle: 'Pièces',
      type: 'entier',
      obligatoire: true,
      bornes: { min: 1, max: 20 },
    },
    { chemin: 'bien.chambres', libelle: 'Chambres', type: 'entier', bornes: { min: 0, max: 20 } },
    {
      chemin: 'bien.etage',
      libelle: 'Étage',
      type: 'entier',
      bornes: { min: 0, max: 50 },
      libelleZero: 'RDC',
    },
    { chemin: 'bien.ascenseur', libelle: 'Ascenseur', type: 'bool', options: OUI_NON },
    {
      chemin: 'bien.annee',
      libelle: 'Année de construction',
      type: 'entier',
      commande: 'annee',
      terme: 'anneeConstruction',
    },
    {
      chemin: 'bien.dpe',
      libelle: 'DPE',
      type: 'enum',
      options: DPE,
      commande: 'energie',
      terme: 'dpe',
    },
    { chemin: 'bien.etat', libelle: 'État', type: 'enum', options: ETATS },
    { chemin: 'bien.exterieur', libelle: 'Balcon ou terrasse', type: 'bool', options: OUI_NON },
    {
      chemin: 'bien.venduLoue',
      libelle: 'Vendu loué',
      type: 'bool',
      options: OUI_NON,
      terme: 'venduLoue',
    },
    { chemin: 'bien.departement', libelle: 'Département', type: 'texte', obligatoire: true },
    {
      chemin: 'bien.copro.lots',
      libelle: 'Lots de copropriété',
      type: 'entier',
      bornes: { min: 1, max: 9999, pas: pasAdaptatif(20, 10) },
      terme: 'lotsCopro',
    },
  ],
};

/** La rénovation énergétique ne joue qu'en location nue (déficit foncier) et avec des travaux. */
const locationNueAvecTravaux = (p: ProjetEntree): boolean =>
  p.hypotheses.location.mode === 'nu' && (p.hypotheses.achat.travaux ?? 0) > 0;

const DEFICIT_FONCIER = obtenirRegles(VERSION_REGLES_COURANTE).fiscalite.deficitFoncier;

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
      terme: 'honorairesAcquereur',
    },
    {
      chemin: 'hypotheses.achat.negociationTaux',
      libelle: 'Négociation',
      type: 'pourcent',
      unite: '%',
      aToi: true,
      terme: 'negociation',
    },
    { chemin: 'hypotheses.achat.travaux', libelle: 'Travaux', type: 'euros', unite: '€' },
    {
      chemin: 'hypotheses.achat.travauxRenovationEnergetique',
      libelle: 'Ces travaux font sortir le logement des classes E, F ou G',
      type: 'bool',
      options: OUI_NON,
      visibleSi: locationNueAvecTravaux,
      aide: `Déficit foncier imputable sur le revenu global porté de ${euros(DEFICIT_FONCIER.plafondRevenuGlobal)} à ${euros(DEFICIT_FONCIER.plafondRenovationEnergetique)} (nu au réel, jusqu'au 31/12/2027).`,
      terme: 'renovationEnergetique',
    },
    {
      chemin: 'hypotheses.achat.mobilier',
      libelle: 'Mobilier',
      type: 'euros',
      unite: '€',
      terme: 'mobilier',
    },
  ],
};

/** Les champs de la carte « L'achat » repliés derrière « + Ajouter des travaux ». */
export const CHEMINS_TRAVAUX: readonly string[] = [
  'hypotheses.achat.travaux',
  'hypotheses.achat.travauxRenovationEnergetique',
  'hypotheses.achat.mobilier',
];
