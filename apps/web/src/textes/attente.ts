import type { EtapeAttente } from '@/annonces/attente';

/** Ce que l'écran d'attente dit à chaque étape ; `portail` est le nom affiché (« SeLoger »). */
export const ETAPES_ATTENTE: Readonly<Record<EtapeAttente, (portail: string) => string>> = {
  contact: (portail) => `On ouvre l'annonce sur ${portail}…`,
  reponse: (portail) => `On attend la réponse de ${portail}…`,
  lecture: () => 'On lit le prix, la surface, le DPE…',
  details: () => 'On rassemble les photos et les détails du bien…',
  long: () => "C'est plus long que d'habitude, on insiste…",
};

/** Ce que fait Deklic, pendant qu'on attend : des faits sur l'analyse, jamais un conseil. */
export const ASTUCES_ATTENTE: readonly string[] = [
  'Le prix est comparé aux ventes réelles du quartier (DVF), pas aux prix affichés.',
  'Le rapport met quatre régimes fiscaux côte à côte : micro-foncier, réel, micro-BIC et LMNP au réel.',
  'Le rendement net compte toutes les charges : taxe foncière, copropriété, assurance, vacance, entretien.',
  "Cinq feux résument l'analyse : prix, rendement, cash-flow, taux d'effort et risques.",
  "Les banques plafonnent le taux d'effort à 35 % des revenus, assurance comprise.",
  "Chaque chiffre dit d'où il vient : l'annonce, une donnée publique, une estimation ou vous.",
];

export const TEXTES_ATTENTE = {
  titre: (portail: string): string => `Deklic lit l'annonce ${portail}`,
  duree: 'De quelques secondes à une minute selon le portail.',
  progression: "Lecture de l'annonce",
  ecoule: (secondes: number): string => `${String(secondes)} s`,
  astuce: 'Le saviez-vous ?',
  annuler: 'Annuler et coller le texte',
} as const;
