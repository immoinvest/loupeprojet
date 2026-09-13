import { lireJsonValide, type Passe } from '../donnees/passe';
import { CourantSchema, millesimesDvfCandidats } from './fichiers';

/** `dvf/courant.json` n'existe qu'après une passe France entière : sinon, on essaie les derniers millésimes. */
export async function millesimesDvfAEssayer(passe: Passe): Promise<readonly string[]> {
  const courant = await lireJsonValide(passe, 'dvf/courant.json', CourantSchema);
  return courant === null ? millesimesDvfCandidats(passe.deps.maintenant()) : [courant.millesime];
}
