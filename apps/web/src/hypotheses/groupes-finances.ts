import { regimesCompatibles } from '@loupe/moteur';

import { coutTotalDuProjet } from '@/annonces/apport';
import { texteApport } from '@/textes/apport';

import type { Groupe } from './types';

/** Les différés de remboursement se comptent en mois, rarement au-delà de trois ans. */
const BORNES_DIFFERE = { min: 0, max: 36 } as const;

export const GROUPE_FINANCEMENT: Groupe = {
  titre: 'Le financement',
  champs: [
    {
      chemin: 'hypotheses.pret.apport',
      libelle: 'Apport',
      type: 'euros',
      unite: '€',
      aToi: true,
      commande: 'apport',
      aideSelon: (projet) =>
        texteApport(projet.hypotheses.pret.apport ?? null, coutTotalDuProjet(projet)),
      terme: 'apport',
    },
    {
      chemin: 'hypotheses.pret.dureeAnnees',
      libelle: 'Durée du prêt',
      type: 'entier',
      unite: 'ans',
      obligatoire: true,
      aToi: true,
      commande: 'duree',
    },
    {
      chemin: 'hypotheses.pret.tauxNominal',
      libelle: 'Taux nominal',
      type: 'pourcent',
      unite: '%',
      obligatoire: true,
      terme: 'tauxNominal',
    },
    {
      chemin: 'hypotheses.pret.tauxAssurance',
      libelle: 'Assurance emprunteur',
      type: 'pourcent',
      unite: '% du capital / an',
      terme: 'assuranceEmprunteur',
    },
    {
      chemin: 'hypotheses.pret.fraisDossier',
      libelle: 'Frais de dossier',
      type: 'euros',
      unite: '€',
      terme: 'fraisDossier',
    },
    {
      chemin: 'hypotheses.pret.fraisGarantie',
      libelle: 'Garantie',
      type: 'euros',
      unite: '€',
      terme: 'garantie',
    },
    {
      chemin: 'hypotheses.pret.differeTotalMois',
      libelle: 'Différé total',
      type: 'entier',
      unite: 'mois',
      bornes: BORNES_DIFFERE,
      terme: 'differeTotal',
    },
    {
      chemin: 'hypotheses.pret.differePartielMois',
      libelle: 'Différé partiel',
      type: 'entier',
      unite: 'mois',
      bornes: BORNES_DIFFERE,
      terme: 'differePartiel',
    },
  ],
};

export const GROUPE_CHARGES: Groupe = {
  titre: 'Les charges',
  champs: [
    {
      chemin: 'hypotheses.charges.taxeFonciere',
      libelle: 'Taxe foncière',
      type: 'euros',
      unite: '€/an',
    },
    {
      chemin: 'hypotheses.charges.coproAnnuel',
      libelle: 'Copropriété (part propriétaire)',
      type: 'euros',
      unite: '€/an',
      terme: 'chargesCopro',
    },
    {
      chemin: 'hypotheses.charges.pno',
      libelle: 'Assurance propriétaire',
      type: 'euros',
      unite: '€/an',
      terme: 'pno',
    },
    {
      chemin: 'hypotheses.charges.comptable',
      libelle: 'Comptable',
      type: 'euros',
      unite: '€/an',
      terme: 'comptable',
    },
    {
      chemin: 'hypotheses.charges.cfe',
      libelle: 'CFE',
      type: 'euros',
      unite: '€/an',
      terme: 'cfe',
    },
    {
      chemin: 'hypotheses.charges.energieMensuel',
      libelle: 'Énergie payée par le propriétaire',
      type: 'euros',
      unite: '€/mois',
    },
    {
      chemin: 'hypotheses.charges.internetMensuel',
      libelle: 'Internet et TV payés par le propriétaire',
      type: 'euros',
      unite: '€/mois',
    },
    {
      chemin: 'hypotheses.charges.entretienTaux',
      libelle: 'Provision entretien',
      type: 'pourcent',
      unite: '% du prix / an',
      terme: 'entretien',
    },
  ],
};

export const GROUPE_FISCALITE: Groupe = {
  titre: 'La fiscalité et la revente',
  champs: [
    {
      chemin: 'hypotheses.fiscalite.tmi',
      libelle: "Tranche d'imposition",
      type: 'nombre',
      aToi: true,
      options: [
        { v: '0', l: '0 %' },
        { v: '0.11', l: '11 %' },
        { v: '0.3', l: '30 %' },
        { v: '0.41', l: '41 %' },
        { v: '0.45', l: '45 %' },
      ],
      terme: 'tmi',
    },
    {
      chemin: 'hypotheses.fiscalite.regime',
      libelle: 'Régime retenu',
      type: 'enum',
      aToi: true,
      options: [
        { v: 'lmnp_reel', l: 'Meublé au réel' },
        { v: 'micro_bic', l: 'Meublé micro-BIC' },
        { v: 'nu_reel', l: 'Nu au réel' },
        { v: 'micro_foncier', l: 'Nu micro-foncier' },
      ],
      // Colocation, courte et moyenne durée : régimes du meublé seulement (le moteur refuse les autres).
      optionVisibleSi: (v, projet) =>
        (regimesCompatibles(projet.hypotheses.location.mode) as readonly string[]).includes(v),
      terme: 'regimeFiscal',
    },
    {
      chemin: 'hypotheses.fiscalite.psBic',
      libelle: 'Prélèvements sociaux meublé',
      type: 'pourcent',
      unite: '%',
      terme: 'prelevementsSociaux',
    },
    {
      chemin: 'hypotheses.fiscalite.psFoncier',
      libelle: 'Prélèvements sociaux nu',
      type: 'pourcent',
      unite: '%',
      terme: 'prelevementsSociaux',
    },
    {
      chemin: 'hypotheses.revente.annees',
      libelle: 'Revente dans',
      type: 'entier',
      unite: 'ans',
      bornes: { min: 1, max: 30 },
    },
    {
      chemin: 'hypotheses.revente.evolutionAnnuelle',
      libelle: 'Évolution du prix',
      type: 'pourcent',
      unite: '% / an',
      terme: 'evolutionPrix',
    },
    {
      chemin: 'hypotheses.revente.fraisAgenceTaux',
      libelle: "Frais d'agence à la revente",
      type: 'pourcent',
      unite: '%',
    },
  ],
};
