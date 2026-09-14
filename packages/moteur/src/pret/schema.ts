import { z } from 'zod';

import { VERSION_REGLES_COURANTE } from '../regles';
import { VersionReglesSchema } from '../schema/projet';

/** Borne haute de tout montant saisi : un lien forgé ne peut pas faire déborder les calculs. */
const MONTANT_MAX = 100_000_000;
const DIFFERE_MAX_MOIS = 36;

const taux = (max: number): z.ZodNumber => z.number().min(0).max(max);
const montant = (): z.ZodNumber => z.number().min(0).max(MONTANT_MAX);

/** Une offre de prêt telle qu'une banque la formule. Le nom n'est jamais interprété : texte affiché tel quel. */
export const OffrePretSchema = z
  .object({
    nom: z.string().trim().max(40).default(''),
    apport: montant().default(0),
    fraisDossier: montant().default(0),
    fraisGarantie: montant().default(0),
    /** `false` : payés comptant à la signature (offres réelles) ; `true` : ajoutés au prêt, comme dans un projet Deklic. */
    fraisBancairesFinances: z.boolean().default(false),
    tauxNominal: taux(0.2),
    /** En proportion du capital initial, par an. */
    tauxAssurance: taux(0.02).default(0.0025),
    dureeAnnees: z.number().int().min(1).max(30),
    differeTotalMois: z.number().int().min(0).max(DIFFERE_MAX_MOIS).default(0),
    differePartielMois: z.number().int().min(0).max(DIFFERE_MAX_MOIS).default(0),
  })
  .refine((o) => o.differeTotalMois + o.differePartielMois < o.dureeAnnees * 12, {
    message: 'Le différé doit être plus court que le prêt',
    path: ['differeTotalMois'],
  });
export type OffrePret = z.infer<typeof OffrePretSchema>;
export type OffrePretEntree = z.input<typeof OffrePretSchema>;

/** Ce que le prêt finance : le bien, les travaux, les frais de notaire. */
export const ProjetFinanceSchema = z.object({
  /** Prix affiché, honoraires d'agence inclus. */
  prix: z.number().positive().max(MONTANT_MAX),
  /** Part du prix qui revient à l'agence : sans droits de mutation ni émoluments. */
  honorairesAgence: montant().default(0),
  travaux: montant().default(0),
  fraisNotaire: montant(),
  /** Sert seulement à l'estimation des frais de notaire (taux départemental). */
  departement: z.string().trim().min(2).max(3).optional(),
  /** Revenus nets mensuels : taux d'endettement. */
  revenusMensuels: montant().optional(),
});
export type ProjetFinance = z.infer<typeof ProjetFinanceSchema>;
export type ProjetFinanceEntree = z.input<typeof ProjetFinanceSchema>;

export const SimulationPretSchema = z.object({
  versionRegles: VersionReglesSchema.default(VERSION_REGLES_COURANTE),
  projet: ProjetFinanceSchema,
  offres: z.array(OffrePretSchema).min(1).max(2),
});
export type SimulationPret = z.infer<typeof SimulationPretSchema>;
export type SimulationPretEntree = z.input<typeof SimulationPretSchema>;
