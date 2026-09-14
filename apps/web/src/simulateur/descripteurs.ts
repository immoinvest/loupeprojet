import type { OffrePret, ProjetFinance } from '@loupe/moteur';

import type { Descripteur, Option } from '@/hypotheses';

/*
 * Les champs du simulateur, décrits comme ceux de l'onglet Hypothèses (même composant de champ,
 * mêmes conversions texte ↔ valeur). Le `chemin` est ici une clé plate du schéma du moteur.
 */

export type CleProjet = keyof ProjetFinance;
export type CleOffre = keyof OffrePret;

export interface DescripteurProjet extends Descripteur {
  readonly chemin: CleProjet;
}

export interface DescripteurOffre extends Descripteur {
  readonly chemin: CleOffre;
}

const FRAIS_BANCAIRES: readonly Option[] = [
  { v: 'non', l: 'Non, payés à la signature' },
  { v: 'oui', l: 'Oui, ajoutés au prêt' },
];

export const CHAMPS_PROJET: readonly DescripteurProjet[] = [
  { chemin: 'prix', libelle: 'Prix affiché', type: 'euros', unite: '€', obligatoire: true },
  {
    chemin: 'honorairesAgence',
    libelle: "Honoraires d'agence (compris dans le prix)",
    type: 'euros',
    unite: '€',
  },
  { chemin: 'travaux', libelle: 'Travaux', type: 'euros', unite: '€' },
  {
    chemin: 'fraisNotaire',
    libelle: 'Frais de notaire',
    type: 'euros',
    unite: '€',
    obligatoire: true,
  },
  { chemin: 'departement', libelle: 'Département (pour les frais de notaire)', type: 'texte' },
  {
    chemin: 'revenusMensuels',
    libelle: 'Vos revenus nets',
    type: 'euros',
    unite: '€/mois',
    aToi: true,
  },
];

export const CHAMPS_OFFRE: readonly DescripteurOffre[] = [
  { chemin: 'nom', libelle: 'Banque', type: 'texte', aToi: true },
  { chemin: 'apport', libelle: 'Apport', type: 'euros', unite: '€', aToi: true },
  {
    chemin: 'tauxNominal',
    libelle: 'Taux nominal',
    type: 'pourcent',
    unite: '%',
    obligatoire: true,
  },
  { chemin: 'dureeAnnees', libelle: 'Durée', type: 'entier', unite: 'ans', obligatoire: true },
  {
    chemin: 'tauxAssurance',
    libelle: 'Assurance emprunteur',
    type: 'pourcent',
    unite: '% du capital / an',
  },
  { chemin: 'fraisDossier', libelle: 'Frais de dossier', type: 'euros', unite: '€' },
  { chemin: 'fraisGarantie', libelle: 'Garantie', type: 'euros', unite: '€' },
  {
    chemin: 'fraisBancairesFinances',
    libelle: 'Frais bancaires financés par le prêt',
    type: 'bool',
    options: FRAIS_BANCAIRES,
    obligatoire: true,
  },
  { chemin: 'differeTotalMois', libelle: 'Différé total', type: 'entier', unite: 'mois' },
  { chemin: 'differePartielMois', libelle: 'Différé partiel', type: 'entier', unite: 'mois' },
];

export const CLES_PROJET: readonly CleProjet[] = CHAMPS_PROJET.map((d) => d.chemin);
export const CLES_OFFRE: readonly CleOffre[] = CHAMPS_OFFRE.map((d) => d.chemin);
