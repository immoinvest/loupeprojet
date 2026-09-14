import { z } from 'zod';

/** Les corrections de l'estimation du prix, chacune désactivable pour un projet. */
export const CodeCorrectionSchema = z.enum(['dpe', 'etage', 'exterieur', 'occupation', 'charges']);
export type CodeCorrection = z.infer<typeof CodeCorrectionSchema>;

/** Réglages de l'estimation propres au projet. */
export const ReglagesEstimationSchema = z.object({
  correctionsIgnorees: z.array(CodeCorrectionSchema).default([]),
});
export type ReglagesEstimation = z.infer<typeof ReglagesEstimationSchema>;
