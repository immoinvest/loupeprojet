import { z } from 'zod';

import { VERSION_REGLES_COURANTE } from '../regles';
import { VersionReglesSchema } from '../schema/projet';

/** Borne haute de tout montant saisi : un lien forgé ne peut pas faire déborder les calculs. */
const MONTANT_MAX = 100_000_000;
const DIFFERE_MAX_MOIS = 36;
const DUREE_MAX_ANNEES = 30;

/* Les messages sont affichés tels quels sous le champ fautif du simulateur. */
const taux = (max: number, libelle: string): z.ZodNumber =>
  z.number().min(0, 'Taux positif attendu.').max(max, `Au plus ${libelle}.`);
const montant = (): z.ZodNumber =>
  z.number().min(0, 'Montant positif attendu.').max(MONTANT_MAX, 'Montant trop grand.');
const mois = (): z.ZodNumber =>
  z
    .number()
    .int('Nombre de mois entier attendu.')
    .min(0, 'Nombre de mois positif attendu.')
    .max(DIFFERE_MAX_MOIS, `Au plus ${String(DIFFERE_MAX_MOIS)} mois.`);

/** Une offre de prêt telle qu'une banque la formule. Le nom n'est jamais interprété : texte affiché tel quel. */
export const OffrePretSchema = z
  .object({
    nom: z.string().trim().max(40, 'Au plus 40 caractères.').default(''),
    apport: montant().default(0),
    fraisDossier: montant().default(0),
    fraisGarantie: montant().default(0),
    /** `false` : payés comptant à la signature (offres réelles) ; `true` : ajoutés au prêt, comme dans un projet Deklic. */
    fraisBancairesFinances: z.boolean().default(false),
    tauxNominal: taux(0.2, '20 %'),
    /** En proportion du capital initial, par an. */
    tauxAssurance: taux(0.02, '2 % du capital par an').default(0.0025),
    dureeAnnees: z
      .number()
      .int("Nombre d'années entier attendu.")
      .min(1, 'Au moins 1 an.')
      .max(DUREE_MAX_ANNEES, `Au plus ${String(DUREE_MAX_ANNEES)} ans.`),
    differeTotalMois: mois().default(0),
    differePartielMois: mois().default(0),
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
  prix: z.number().positive('Prix positif attendu.').max(MONTANT_MAX, 'Montant trop grand.'),
  /** Part du prix qui revient à l'agence : sans droits de mutation ni émoluments. */
  honorairesAgence: montant().default(0),
  travaux: montant().default(0),
  fraisNotaire: montant(),
  /** Sert seulement à l'estimation des frais de notaire (taux départemental). */
  departement: z
    .string()
    .trim()
    .min(2, 'Deux ou trois caractères, par exemple 13 ou 2A.')
    .max(3, 'Deux ou trois caractères, par exemple 13 ou 2A.')
    .optional(),
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
