import { z } from 'zod';

import { BienSchema } from './bien';
import { ReglagesEstimationSchema } from './estimation';
import { HypothesesSchema, type HypothesesCompletes } from './hypotheses';
import { MarcheSchema } from './marche';

export const VersionReglesSchema = z.enum(['2026-09']);

/** Source de chaque hypothèse : « annonce », « ademe », « anil », « estime », « utilisateur », « llm:0.92 »… */
export const ProvenanceSchema = z.record(z.string(), z.string());
export type Provenance = z.infer<typeof ProvenanceSchema>;

/** D'où vient le projet : l'annonce d'origine (jamais son texte, seulement son adresse). */
export const SourceAnnonceSchema = z.object({
  portail: z.string().min(1),
  id: z.string().min(1),
  url: z.url(),
});
export type SourceAnnonce = z.infer<typeof SourceAnnonceSchema>;

/** L'objet unique que le moteur consomme. Les résultats ne sont jamais stockés dedans. */
export const ProjetSchema = z.object({
  id: z.string().min(1),
  versionRegles: VersionReglesSchema,
  source: SourceAnnonceSchema.optional(),
  bien: BienSchema,
  marche: MarcheSchema.prefault({}),
  hypotheses: HypothesesSchema,
  estimation: ReglagesEstimationSchema.prefault({}),
  provenance: ProvenanceSchema.default({}),
});
export type Projet = z.infer<typeof ProjetSchema>;
export type ProjetEntree = z.input<typeof ProjetSchema>;

/** Projet dont le loyer visé est connu : le rapport peut être calculé en entier. */
export type ProjetComplet = Projet & { readonly hypotheses: HypothesesCompletes };

export function estComplet(projet: Projet): projet is ProjetComplet {
  return projet.hypotheses.location.loyerHc !== undefined;
}

/** Valide une entrée et exige le loyer : pour ce qui ne sait calculer qu'un projet complet. */
export function parserComplet(entree: ProjetEntree): ProjetComplet {
  const projet = ProjetSchema.parse(entree);
  if (!estComplet(projet)) throw new Error('Projet incomplet : le loyer visé manque.');
  return projet;
}
