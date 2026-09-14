import type { Feu, PhaseCredit } from '@loupe/moteur';

/** Textes de l'onglet Financement. */
export const TEXTES_FINANCEMENT = {
  titre: "Comment se finance l'achat ?",
  pret: 'Votre prêt',
  simuler: 'Simuler un prêt',
  cout: 'Ce que ça coûte',
  origine: "D'où vient l'argent",
  couverture: 'Le loyer porte-t-il le crédit ?',
  anneeParAnnee: 'Année par année',
  sansEmprunt: "Pas d'emprunt : l'apport couvre tout, rien à rembourser.",
  usure: "au-dessus du taux d'usure",
  dureeMax: (annees: number): string =>
    `plus long que le maximum bancaire de ${String(annees)} ans`,
  effortAncien: 'Effort bancaire (revenus indiqués à la création)',
  effortDepasse: (seuil: string): string => `au-dessus de ${seuil}`,
} as const;

/** Les phases d'un prêt, pour l'échéancier. */
export const PHASES: Readonly<Record<PhaseCredit, string>> = {
  differe_total: 'Différé total, rien à payer',
  differe_partiel: 'Différé partiel, intérêts seuls',
  amortissement: 'Amortissement',
};

/** Une phrase sous le gros chiffre de la couverture, selon le feu. */
export function phraseCouverture(feu: Feu): string {
  switch (feu) {
    case 'bon':
      return 'Le loyer porte le crédit, même en comptant 30 % de charges et de mois vides : la lecture de la banque.';
    case 'surveiller':
      return 'Le loyer couvre la mensualité, mais pas les charges ni les mois vides : regardez le cash-flow.';
    case 'probleme':
      return 'Le loyer ne couvre même pas la mensualité : il faudra compléter chaque mois.';
    case 'inconnu':
      return 'Indiquez un loyer pour savoir si le crédit est couvert.';
  }
}
