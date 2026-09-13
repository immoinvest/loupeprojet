import { z } from 'zod';
import type { Commune } from '../../schemas/communes.ts';

/** Réponse de l'API Géo pour `/departements/<dep>/communes` et `/communes?type=arrondissement-municipal`. */
export const CommuneApiSchema = z.object({
  nom: z.string().min(1),
  code: z.string().min(1),
  codesPostaux: z.array(z.string()),
  population: z.number().int().nonnegative().optional(),
  codeEpci: z.string().optional(),
});
export type CommuneApi = z.infer<typeof CommuneApiSchema>;

export const ReponseCommunesSchema = z.array(CommuneApiSchema);

export interface Arrondissements {
  readonly communeParente: string;
  readonly liste: readonly CommuneApi[];
}

function versCommune(api: CommuneApi, communeParente?: string): Commune {
  const commune: Commune = { nom: api.nom, codesPostaux: api.codesPostaux };
  if (api.population !== undefined) {
    commune.population = api.population;
  }
  if (api.codeEpci !== undefined) {
    commune.epci = api.codeEpci;
  }
  if (communeParente !== undefined) {
    commune.communeParente = communeParente;
  }
  return commune;
}

/** Communes du département par code INSEE, arrondissements municipaux rattachés à leur commune. */
export function communesDepuisApi(
  communes: readonly CommuneApi[],
  arrondissements: Arrondissements | null,
): Record<string, Commune> {
  const resultat: Record<string, Commune> = {};
  for (const commune of communes) {
    resultat[commune.code] = versCommune(commune);
  }
  if (arrondissements !== null) {
    for (const arrondissement of arrondissements.liste) {
      resultat[arrondissement.code] = versCommune(arrondissement, arrondissements.communeParente);
    }
  }
  return resultat;
}
