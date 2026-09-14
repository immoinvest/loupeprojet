import type { ModeLocation, ProjetEntree } from '@loupe/moteur';

import { TYPES_LOCATION } from '@/textes/regimes';

import type { Descripteur, Groupe } from './types';

/** Visible seulement pour ces types d'exploitation. */
const pour =
  (...modes: readonly ModeLocation[]) =>
  (p: ProjetEntree): boolean =>
    modes.includes(p.hypotheses.location.mode);

export const CHEMIN_MODE = 'hypotheses.location.mode';

/** Le type d'exploitation : première question de la carte « La location ». */
export const CHAMP_MODE: Descripteur = {
  chemin: CHEMIN_MODE,
  libelle: 'Type de location',
  type: 'enum',
  obligatoire: true,
  aToi: true,
  options: (Object.keys(TYPES_LOCATION) as ModeLocation[]).map((v) => ({
    v,
    l: TYPES_LOCATION[v],
  })),
};

/** Les champs propres à chaque type ; seuls ceux du type choisi s'affichent. */
export const GROUPE_LOCATION: Groupe = {
  titre: 'La location',
  champs: [
    CHAMP_MODE,
    {
      chemin: 'hypotheses.location.loyerHc',
      libelle: 'Loyer visé, hors charges',
      type: 'euros',
      unite: '€/mois',
      aToi: true,
      visibleSi: pour('nu', 'meuble', 'moyenne_duree'),
    },
    // L'encadrement des loyers n'est dans aucun référentiel : à saisir, à côté du loyer visé (jamais en courte durée).
    {
      chemin: 'marche.plafondLoyerMensuel',
      libelle: "Plafond d'encadrement",
      type: 'euros',
      unite: '€/mois',
      visibleSi: pour('nu', 'meuble', 'colocation', 'moyenne_duree'),
    },
    {
      chemin: 'hypotheses.location.loyerHcNu',
      libelle: 'Loyer si loué nu',
      type: 'euros',
      unite: '€/mois',
      visibleSi: pour('meuble'),
    },
    {
      chemin: 'hypotheses.location.chambres',
      libelle: 'Chambres louées',
      type: 'entier',
      obligatoire: true,
      aToi: true,
      visibleSi: pour('colocation'),
    },
    {
      chemin: 'hypotheses.location.loyerChambre',
      libelle: 'Loyer par chambre, hors charges',
      type: 'euros',
      unite: '€/mois',
      aToi: true,
      visibleSi: pour('colocation'),
    },
    {
      chemin: 'hypotheses.location.forfaitChargesChambre',
      libelle: 'Charges comprises, par chambre',
      type: 'euros',
      unite: '€/mois',
      visibleSi: pour('colocation'),
    },
    {
      chemin: 'hypotheses.location.forfaitCharges',
      libelle: 'Forfait de charges',
      type: 'euros',
      unite: '€/mois',
      visibleSi: pour('moyenne_duree'),
    },
    {
      chemin: 'hypotheses.location.nuitee',
      libelle: 'Prix de la nuitée, hors ménage',
      type: 'euros',
      unite: '€',
      aToi: true,
      visibleSi: pour('courte_duree'),
    },
    {
      chemin: 'hypotheses.location.nuiteesParMois',
      libelle: 'Nuits louées par mois',
      type: 'nombre',
      unite: 'nuits',
      obligatoire: true,
      aToi: true,
      visibleSi: pour('courte_duree'),
    },
    {
      chemin: 'hypotheses.location.dureeSejourNuits',
      libelle: "Durée moyenne d'un séjour",
      type: 'nombre',
      unite: 'nuits',
      visibleSi: pour('courte_duree'),
    },
    {
      chemin: 'hypotheses.location.dureeSejourMois',
      libelle: "Durée moyenne d'un séjour",
      type: 'nombre',
      unite: 'mois',
      visibleSi: pour('moyenne_duree'),
    },
    {
      chemin: 'hypotheses.location.menageFactureParSejour',
      libelle: 'Ménage facturé au voyageur',
      type: 'euros',
      unite: '€ / séjour',
      visibleSi: pour('courte_duree'),
    },
    {
      chemin: 'hypotheses.location.menageCoutParSejour',
      libelle: 'Ménage payé',
      type: 'euros',
      unite: '€ / séjour',
      visibleSi: pour('courte_duree', 'moyenne_duree'),
    },
    {
      chemin: 'hypotheses.location.chargesLocataire',
      libelle: 'Charges refacturées',
      type: 'euros',
      unite: '€/mois',
      visibleSi: pour('nu', 'meuble'),
    },
    {
      chemin: 'hypotheses.location.vacanceSemaines',
      libelle: 'Vacance',
      type: 'nombre',
      unite: 'semaines / an',
      visibleSi: pour('nu', 'meuble', 'colocation', 'moyenne_duree'),
    },
    {
      chemin: 'hypotheses.location.gestionTaux',
      libelle: 'Gestion déléguée',
      type: 'pourcent',
      unite: '% des loyers',
      visibleSi: pour('nu', 'meuble', 'colocation', 'moyenne_duree'),
    },
    {
      chemin: 'hypotheses.location.conciergerieTaux',
      libelle: 'Conciergerie',
      type: 'pourcent',
      unite: '% des recettes',
      visibleSi: pour('courte_duree'),
    },
    {
      chemin: 'hypotheses.location.plateformeTaux',
      libelle: 'Commission de la plateforme',
      type: 'pourcent',
      unite: '% des recettes',
      visibleSi: pour('courte_duree', 'moyenne_duree'),
    },
    {
      chemin: 'hypotheses.location.tourismeClasse',
      libelle: 'Meublé de tourisme classé',
      type: 'bool',
      visibleSi: pour('courte_duree'),
    },
  ],
};
