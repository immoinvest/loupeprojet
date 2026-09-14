import { z } from 'zod';

const taux = (max: number): z.ZodNumber => z.number().min(0).max(max);
const montant = (): z.ZodNumber => z.number().nonnegative();

export const AchatSchema = z.object({
  /** Prix affiché, honoraires d'agence inclus s'ils sont à la charge de l'acquéreur. */
  prix: z.number().positive(),
  honorairesAgence: montant().default(0),
  honorairesChargeAcquereur: z.boolean().default(true),
  travaux: montant().default(0),
  travauxRenovationEnergetique: z.boolean().default(false),
  mobilier: montant().default(0),
  /** Taux DMTO imposé (sinon déduit du département). */
  dmtoTaux: taux(0.1).optional(),
});

export const PretSchema = z
  .object({
    apport: montant().default(0),
    tauxNominal: taux(0.2),
    dureeAnnees: z.number().int().min(1).max(30),
    /** En proportion du capital initial, par an. */
    tauxAssurance: taux(0.02).default(0.0025),
    fraisDossier: montant().default(0),
    fraisGarantie: montant().default(0),
    differeTotalMois: z.number().int().nonnegative().default(0),
    differePartielMois: z.number().int().nonnegative().default(0),
  })
  .refine((p) => p.differeTotalMois + p.differePartielMois < p.dureeAnnees * 12, {
    message: 'Le différé doit être plus court que le prêt',
    path: ['differeTotalMois'],
  });

/**
 * Les cinq types d'exploitation : location nue, meublée longue durée, colocation (meublée, par chambre),
 * courte durée (meublé de tourisme, à la nuitée), moyenne durée (bail mobilité, meublé, 1 à 10 mois).
 */
export const ModeLocationSchema = z.enum([
  'nu',
  'meuble',
  'colocation',
  'courte_duree',
  'moyenne_duree',
]);
export type ModeLocation = z.infer<typeof ModeLocationSchema>;
export const MODES_LOCATION: readonly ModeLocation[] = ModeLocationSchema.options;

/** Gestion déléguée, en proportion des loyers encaissés (0 = auto-gestion). */
const gestionTaux = (): z.ZodDefault<z.ZodNumber> => taux(1).default(0);
/** Semaines sans locataire par an. */
const vacanceSemaines = (defaut: number): z.ZodDefault<z.ZodNumber> =>
  z.number().min(0).max(52).default(defaut);

export const LocationNueSchema = z.object({
  mode: z.literal('nu'),
  /** Loyer mensuel hors charges. */
  loyerHc: montant(),
  /** Charges refacturées au locataire, par mois (information ; neutres dans le calcul). */
  chargesLocataire: montant().default(0),
  vacanceSemaines: vacanceSemaines(3),
  gestionTaux: gestionTaux(),
});

export const LocationMeubleeSchema = z.object({
  mode: z.literal('meuble'),
  /** Loyer mensuel hors charges en meublé. */
  loyerHc: montant(),
  /** Loyer mensuel hors charges si le bien était loué nu (défaut : déduit de la prime meublé). */
  loyerHcNu: montant().optional(),
  chargesLocataire: montant().default(0),
  vacanceSemaines: vacanceSemaines(3),
  gestionTaux: gestionTaux(),
});

export const LocationColocationSchema = z.object({
  mode: z.literal('colocation'),
  /** Chambres louées (pas forcément toutes les chambres du bien). */
  chambres: z.number().int().min(1).max(20),
  /** Loyer mensuel hors charges d'une chambre (loyer unique pour toutes). */
  loyerChambre: montant(),
  /** Forfait de charges comprises facturé par chambre et par mois (eau, énergie, internet). */
  forfaitChargesChambre: montant().default(0),
  /** Vacance par chambre : la rotation des colocataires vide chaque chambre à son tour. */
  vacanceSemaines: vacanceSemaines(4),
  gestionTaux: gestionTaux(),
});

export const LocationCourteDureeSchema = z.object({
  mode: z.literal('courte_duree'),
  /** Prix d'une nuit hors frais de ménage. */
  nuitee: z.number().positive(),
  /** Nuits louées par mois en moyenne sur l'année (30 = complet). */
  nuiteesParMois: z.number().min(0).max(31),
  /** Durée moyenne d'un séjour, en nuits : donne le nombre de séjours, donc de ménages. */
  dureeSejourNuits: z.number().min(1).max(31).default(4),
  /** Frais de ménage facturés au voyageur, par séjour (recette). */
  menageFactureParSejour: montant().default(0),
  /** Ménage payé au prestataire, par séjour (charge). */
  menageCoutParSejour: montant().default(0),
  /** Commission de la plateforme à la charge de l'hôte, en proportion des recettes. */
  plateformeTaux: taux(1).default(0),
  /** Conciergerie, en proportion des recettes (0 = auto-gestion). */
  conciergerieTaux: taux(1).default(0),
  /** Meublé de tourisme classé : abattement et plafond micro-BIC du meublé classique. */
  tourismeClasse: z.boolean().default(false),
});

export const LocationMoyenneDureeSchema = z.object({
  mode: z.literal('moyenne_duree'),
  /** Loyer mensuel hors charges. */
  loyerHc: montant(),
  /** Forfait de charges mensuel (le bail mobilité impose le forfait). */
  forfaitCharges: montant().default(0),
  /** Durée moyenne d'un séjour, en mois (bail mobilité : 1 à 10). */
  dureeSejourMois: z.number().min(1).max(10).default(4),
  /** Semaines vides entre deux séjours, cumulées sur l'année. */
  vacanceSemaines: vacanceSemaines(4),
  /** Ménage entre deux séjours, payé au prestataire. */
  menageCoutParSejour: montant().default(0),
  /** Commission de la plateforme de moyenne durée, en proportion des loyers. */
  plateformeTaux: taux(1).default(0),
  gestionTaux: gestionTaux(),
});

export const LocationSchema = z.discriminatedUnion('mode', [
  LocationNueSchema,
  LocationMeubleeSchema,
  LocationColocationSchema,
  LocationCourteDureeSchema,
  LocationMoyenneDureeSchema,
]);
export type Location = z.infer<typeof LocationSchema>;
export type LocationEntree = z.input<typeof LocationSchema>;
export type LocationNue = z.infer<typeof LocationNueSchema>;
export type LocationMeublee = z.infer<typeof LocationMeubleeSchema>;
export type LocationColocation = z.infer<typeof LocationColocationSchema>;
export type LocationCourteDuree = z.infer<typeof LocationCourteDureeSchema>;
export type LocationMoyenneDuree = z.infer<typeof LocationMoyenneDureeSchema>;

export const ChargesSchema = z.object({
  taxeFonciere: montant().default(0),
  coproAnnuel: montant().default(0),
  pno: montant().default(0),
  comptable: montant().default(0),
  cfe: montant().default(0),
  /** Abonnements d'énergie payés par le propriétaire (charges comprises), par mois. */
  energieMensuel: montant().default(0),
  /** Abonnement internet ou télévision payé par le propriétaire, par mois. */
  internetMensuel: montant().default(0),
  /** Provision annuelle d'entretien, en proportion du prix. */
  entretienTaux: taux(0.05).default(0.005),
});

export const RegimeSchema = z.enum(['micro_bic', 'lmnp_reel', 'micro_foncier', 'nu_reel']);
export type Regime = z.infer<typeof RegimeSchema>;

const REGIMES_BIC: readonly Regime[] = ['micro_bic', 'lmnp_reel'];
const TOUS_REGIMES: readonly Regime[] = ['micro_bic', 'lmnp_reel', 'micro_foncier', 'nu_reel'];

/**
 * Régimes qui ont un sens pour un type de location. En nue et en meublée, les quatre : comparer
 * « et si je louais nu / meublé » fait partie de l'analyse. En colocation, courte et moyenne durée,
 * seulement les régimes du meublé (BIC).
 */
export const REGIMES_PAR_MODE: Readonly<Record<ModeLocation, readonly Regime[]>> = {
  nu: TOUS_REGIMES,
  meuble: TOUS_REGIMES,
  colocation: REGIMES_BIC,
  courte_duree: REGIMES_BIC,
  moyenne_duree: REGIMES_BIC,
};

export function regimesCompatibles(mode: ModeLocation): readonly Regime[] {
  return REGIMES_PAR_MODE[mode];
}

export const TmiSchema = z.union([
  z.literal(0),
  z.literal(0.11),
  z.literal(0.3),
  z.literal(0.41),
  z.literal(0.45),
]);

export const FiscaliteSchema = z.object({
  tmi: TmiSchema,
  psBic: taux(0.3).default(0.186),
  psFoncier: taux(0.3).default(0.172),
  regime: RegimeSchema,
});

export const ReventeSchema = z.object({
  annees: z.number().int().min(1).max(30).default(10),
  evolutionAnnuelle: z.number().min(-0.2).max(0.2).default(0.015),
  fraisAgenceTaux: taux(0.15).default(0.04),
  diagnostics: montant().default(500),
});

export const HypothesesSchema = z
  .object({
    achat: AchatSchema,
    pret: PretSchema,
    location: LocationSchema,
    charges: ChargesSchema.prefault({}),
    fiscalite: FiscaliteSchema,
    revente: ReventeSchema.prefault({}),
    /** Revenus nets mensuels du ménage, pour le taux d'effort. */
    revenusMensuels: montant(),
  })
  .refine((h) => regimesCompatibles(h.location.mode).includes(h.fiscalite.regime), {
    message: 'Ce régime fiscal ne s’applique pas à ce type de location',
    path: ['fiscalite', 'regime'],
  });
export type Hypotheses = z.infer<typeof HypothesesSchema>;
export type HypothesesEntree = z.input<typeof HypothesesSchema>;
