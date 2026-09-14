import type { Groupe } from './types';

export const GROUPE_FINANCEMENT: Groupe = {
  titre: 'Le financement',
  champs: [
    { chemin: 'hypotheses.pret.apport', libelle: 'Apport', type: 'euros', unite: '€', aToi: true },
    {
      chemin: 'hypotheses.pret.dureeAnnees',
      libelle: 'Durée du prêt',
      type: 'entier',
      unite: 'ans',
      obligatoire: true,
      aToi: true,
    },
    {
      chemin: 'hypotheses.pret.tauxNominal',
      libelle: 'Taux nominal',
      type: 'pourcent',
      unite: '%',
      obligatoire: true,
    },
    {
      chemin: 'hypotheses.pret.tauxAssurance',
      libelle: 'Assurance emprunteur',
      type: 'pourcent',
      unite: '% du capital / an',
    },
    {
      chemin: 'hypotheses.pret.fraisDossier',
      libelle: 'Frais de dossier',
      type: 'euros',
      unite: '€',
    },
    { chemin: 'hypotheses.pret.fraisGarantie', libelle: 'Garantie', type: 'euros', unite: '€' },
    {
      chemin: 'hypotheses.pret.differeTotalMois',
      libelle: 'Différé total',
      type: 'entier',
      unite: 'mois',
    },
    {
      chemin: 'hypotheses.pret.differePartielMois',
      libelle: 'Différé partiel',
      type: 'entier',
      unite: 'mois',
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
    },
    {
      chemin: 'hypotheses.charges.pno',
      libelle: 'Assurance propriétaire',
      type: 'euros',
      unite: '€/an',
    },
    { chemin: 'hypotheses.charges.comptable', libelle: 'Comptable', type: 'euros', unite: '€/an' },
    { chemin: 'hypotheses.charges.cfe', libelle: 'CFE', type: 'euros', unite: '€/an' },
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
    },
    {
      chemin: 'hypotheses.fiscalite.psBic',
      libelle: 'Prélèvements sociaux meublé',
      type: 'pourcent',
      unite: '%',
    },
    {
      chemin: 'hypotheses.fiscalite.psFoncier',
      libelle: 'Prélèvements sociaux nu',
      type: 'pourcent',
      unite: '%',
    },
    { chemin: 'hypotheses.revente.annees', libelle: 'Revente dans', type: 'entier', unite: 'ans' },
    {
      chemin: 'hypotheses.revente.evolutionAnnuelle',
      libelle: 'Évolution du prix',
      type: 'pourcent',
      unite: '% / an',
    },
    {
      chemin: 'hypotheses.revente.fraisAgenceTaux',
      libelle: "Frais d'agence à la revente",
      type: 'pourcent',
      unite: '%',
    },
  ],
};
