import { VersionReglesSchema, arrondirCentime, type Resultats } from '@loupe/moteur';
import { z } from 'zod';

import { decoderJson, encoderJson } from '@/stockage/base64url';

/**
 * Le lien « Simuler un prêt » : le prêt d'un projet, dans le format du simulateur de prêt
 * (`/simulateur-pret#s=…`, contrat de `.product/specs/simulateur-pret-specs.md`). Le schéma est
 * une copie locale du contrat ; le simulateur, une fois livré, le remplacera par celui du moteur
 * sans changer le lien.
 */

const taux = (max: number): z.ZodNumber => z.number().min(0).max(max);
const montant = (): z.ZodNumber => z.number().nonnegative();

export const OffrePretSchema = z.object({
  nom: z.string().min(1).max(40).optional(),
  apport: montant().optional(),
  fraisDossier: montant().optional(),
  fraisGarantie: montant().optional(),
  /** `true` : frais de dossier et garantie empruntés, comme dans le rapport d'un projet. */
  fraisBancairesFinances: z.boolean().optional(),
  tauxNominal: taux(0.2),
  tauxAssurance: taux(0.02).optional(),
  dureeAnnees: z.number().int().min(1).max(30),
  differeTotalMois: z.number().int().min(0).max(36).optional(),
  differePartielMois: z.number().int().min(0).max(36).optional(),
});

export const ProjetFinanceSchema = z.object({
  /** Prix affiché, honoraires inclus. */
  prix: z.number().positive().max(100_000_000),
  honorairesAgence: montant().optional(),
  travaux: montant().optional(),
  fraisNotaire: montant(),
  departement: z.string().min(2).max(3).optional(),
  revenusMensuels: montant().optional(),
});

export const SimulationPretEntreeSchema = z.object({
  versionRegles: VersionReglesSchema.optional(),
  projet: ProjetFinanceSchema,
  offres: z.array(OffrePretSchema).min(1).max(2),
});
export type SimulationPretEntree = z.infer<typeof SimulationPretEntreeSchema>;

export const CHEMIN_SIMULATEUR = '/simulateur-pret';
const PARAMETRE = 's';

/** Le prêt du projet tel que le rapport le calcule, prêt à être repris par le simulateur. */
export function simulationDepuisResultats(r: Resultats): SimulationPretEntree {
  const { achat, pret } = r.projet.hypotheses;
  const honoraires = achat.honorairesChargeAcquereur ? achat.honorairesAgence : 0;
  return {
    versionRegles: r.meta.versionRegles,
    projet: {
      prix: achat.prix,
      ...(honoraires > 0 ? { honorairesAgence: honoraires } : {}),
      ...(achat.travaux > 0 ? { travaux: achat.travaux } : {}),
      // Frontière d'affichage : le lien porte des centimes, pas le bruit du calcul en flottant.
      fraisNotaire: arrondirCentime(r.financement.fraisAcquisition.total),
      departement: r.projet.bien.departement,
    },
    offres: [
      {
        apport: pret.apport,
        fraisDossier: pret.fraisDossier,
        fraisGarantie: pret.fraisGarantie,
        fraisBancairesFinances: true,
        tauxNominal: pret.tauxNominal,
        tauxAssurance: pret.tauxAssurance,
        dureeAnnees: pret.dureeAnnees,
        ...(pret.differeTotalMois > 0 ? { differeTotalMois: pret.differeTotalMois } : {}),
        ...(pret.differePartielMois > 0 ? { differePartielMois: pret.differePartielMois } : {}),
      },
    ],
  };
}

export function encoderSimulation(simulation: SimulationPretEntree): string {
  return encoderJson(simulation);
}

export type DecodageSimulation =
  | { readonly ok: true; readonly simulation: SimulationPretEntree }
  | { readonly ok: false; readonly raison: 'vide' | 'illisible' | 'invalide' };

/** Texte d'un fragment `#s=` → simulation validée par Zod ; jamais d'exception. */
export function decoderSimulation(texte: string): DecodageSimulation {
  const nettoye = texte.trim();
  if (nettoye === '') return { ok: false, raison: 'vide' };
  const lecture = decoderJson(nettoye);
  if (!lecture.ok) return { ok: false, raison: 'illisible' };
  const resultat = SimulationPretEntreeSchema.safeParse(lecture.valeur);
  return resultat.success
    ? { ok: true, simulation: resultat.data }
    : { ok: false, raison: 'invalide' };
}

/** Le chemin du simulateur avec le prêt dans le fragment : `/simulateur-pret#s=…`. */
export function lienSimulateurPret(simulation: SimulationPretEntree): string {
  return `${CHEMIN_SIMULATEUR}#${PARAMETRE}=${encoderSimulation(simulation)}`;
}

/** Extrait le texte encodé d'un fragment d'URL (`#s=…`) ; `null` s'il n'y en a pas. */
export function lireFragmentSimulation(hash: string): string | null {
  return new URLSearchParams(hash.replace(/^#/, '')).get(PARAMETRE);
}
