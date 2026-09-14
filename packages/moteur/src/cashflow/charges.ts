import type { Hypotheses, Location, Regime } from '../schema/hypotheses';
import type { Recettes } from './recettes';

export const CODES_CHARGES = [
  'taxeFonciere',
  'copro',
  'pno',
  'comptable',
  'cfe',
  'gestion',
  'conciergerie',
  'plateforme',
  'menage',
  'energie',
  'internet',
  'entretien',
] as const;
export type CodeCharge = (typeof CODES_CHARGES)[number];

export interface LigneCharge {
  readonly code: CodeCharge;
  readonly annuel: number;
}

/** Lignes proportionnelles aux recettes encaissées : exclues des charges fixes du point mort. */
export const CODES_PROPORTIONNELS: readonly CodeCharge[] = [
  'gestion',
  'conciergerie',
  'plateforme',
];

const MOIS_PAR_AN = 12;

export function estMeuble(regime: Regime): boolean {
  return regime === 'micro_bic' || regime === 'lmnp_reel';
}

interface FraisDuType {
  readonly gestion: number;
  readonly conciergerie: number;
  readonly plateforme: number;
  readonly menage: number;
}

/** Frais propres au type : gestion déléguée, conciergerie, commission de plateforme, ménage payé. */
function fraisDuType(location: Location, recettes: Recettes): FraisDuType {
  const sejours = recettes.sejours ?? 0;
  switch (location.mode) {
    case 'nu':
    case 'meuble':
    case 'colocation':
      return {
        gestion: location.gestionTaux * recettes.loyersNets,
        conciergerie: 0,
        plateforme: 0,
        menage: 0,
      };
    case 'courte_duree':
      return {
        gestion: 0,
        conciergerie: location.conciergerieTaux * recettes.loyersNets,
        plateforme: location.plateformeTaux * recettes.loyersNets,
        menage: sejours * location.menageCoutParSejour,
      };
    case 'moyenne_duree':
      return {
        gestion: location.gestionTaux * recettes.loyersNets,
        conciergerie: 0,
        plateforme: location.plateformeTaux * recettes.loyersNets,
        menage: sejours * location.menageCoutParSejour,
      };
  }
}

/**
 * Charges d'exploitation annuelles à la charge du propriétaire, charges pleines, pour la location
 * projetée (celle du projet, ou la variante d'un autre régime). Le comptable ne compte qu'au réel
 * meublé, la CFE qu'en meublé ; les frais du type et les abonnements (énergie, internet) sont des
 * charges déductibles au réel, jamais retranchés des recettes.
 */
export function chargesExploitation(
  hypotheses: Hypotheses,
  location: Location,
  regime: Regime,
  recettes: Recettes,
): LigneCharge[] {
  const { charges, achat } = hypotheses;
  const frais = fraisDuType(location, recettes);
  return [
    { code: 'taxeFonciere', annuel: charges.taxeFonciere },
    { code: 'copro', annuel: charges.coproAnnuel },
    { code: 'pno', annuel: charges.pno },
    { code: 'comptable', annuel: regime === 'lmnp_reel' ? charges.comptable : 0 },
    { code: 'cfe', annuel: estMeuble(regime) ? charges.cfe : 0 },
    { code: 'gestion', annuel: frais.gestion },
    { code: 'conciergerie', annuel: frais.conciergerie },
    { code: 'plateforme', annuel: frais.plateforme },
    { code: 'menage', annuel: frais.menage },
    { code: 'energie', annuel: charges.energieMensuel * MOIS_PAR_AN },
    { code: 'internet', annuel: charges.internetMensuel * MOIS_PAR_AN },
    { code: 'entretien', annuel: charges.entretienTaux * achat.prix },
  ];
}

export function totalCharges(lignes: readonly LigneCharge[]): number {
  return lignes.reduce((acc, l) => acc + l.annuel, 0);
}
