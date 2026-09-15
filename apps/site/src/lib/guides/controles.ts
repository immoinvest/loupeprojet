import { motsDuCorps } from './lecture';
import type { DonneesGuide } from './schema';

/** Un guide tel que le lit le site : identifiant (nom du fichier), frontmatter validé, texte MDX. */
export interface EntreeGuide {
  readonly id: string;
  readonly data: DonneesGuide;
  readonly body?: string | undefined;
}

/** Mots qui ne comptent pas dans un mot-clé (« quittance de loyer » = « quittance loyer »). */
const MOTS_VIDES = new Set([
  'a',
  'au',
  'aux',
  'd',
  'de',
  'des',
  'du',
  'en',
  'et',
  'l',
  'la',
  'le',
  'les',
  'ou',
  'un',
  'une',
]);

function jetons(texte: string): string[] {
  return normaliser(texte)
    .split(/[^a-z0-9]+/)
    .filter((mot) => mot !== '' && !MOTS_VIDES.has(mot));
}

/** Le texte contient-il tous les mots du mot-clé, accents, casse et petits mots mis à part ? */
export function contientMotCle(texte: string, motCle: string): boolean {
  const presents = new Set(jetons(texte));
  return jetons(motCle).every((mot) => presents.has(mot));
}

/**
 * Où le mot-clé principal manque : balise title, titre, adresse, 100 premiers mots. Ce sont les
 * emplacements que Google lit d'abord ; un manque arrête le build.
 */
export function placementMotCle(guide: EntreeGuide): string[] {
  const { motCle, titreSeo, titre } = guide.data;
  const emplacements: readonly (readonly [string, string])[] = [
    ['la balise title', titreSeo],
    ['le titre', titre],
    ['l’adresse', guide.id],
    [
      'les 100 premiers mots',
      motsDuCorps(guide.body ?? '')
        .slice(0, 100)
        .join(' '),
    ],
  ];
  return emplacements
    .filter(([, texte]) => !contientMotCle(texte, motCle))
    .map(([emplacement]) => `${guide.id} : « ${motCle} » absent de ${emplacement}`);
}

/** Les guides publiés (sans brouillons), du plus récemment mis à jour au plus ancien, puis par titre. */
export function publies<T extends EntreeGuide>(guides: readonly T[]): T[] {
  return guides
    .filter((guide) => !guide.data.brouillon)
    .sort(
      (a, b) =>
        b.data.misAJourLe.getTime() - a.data.misAJourLe.getTime() ||
        a.data.titre.localeCompare(b.data.titre, 'fr'),
    );
}

/** « Rentabilité  Locative » et « rentabilite locative » visent le même mot-clé. */
function normaliser(motCle: string): string {
  return motCle
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Mots-clés principaux visés par plusieurs guides : deux pages du même site qui visent la même
 * requête se font concurrence dans Google. Rend un message par mot-clé en double.
 */
export function motsClesEnDouble(guides: readonly EntreeGuide[]): string[] {
  const parMotCle = new Map<string, string[]>();
  for (const guide of guides) {
    const cle = normaliser(guide.data.motCle);
    parMotCle.set(cle, [...(parMotCle.get(cle) ?? []), guide.id]);
  }
  return [...parMotCle.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([motCle, ids]) => `« ${motCle} » visé par : ${ids.join(', ')}`);
}

/** Arrête le build si deux guides visent le même mot-clé ou si un mot-clé manque à sa place. */
export function verifierMotsCles(guides: readonly EntreeGuide[]): void {
  const defauts = [...motsClesEnDouble(guides), ...guides.flatMap(placementMotCle)];
  if (defauts.length > 0) {
    throw new Error(`Mots-clés des guides :\n${defauts.join('\n')}`);
  }
}
