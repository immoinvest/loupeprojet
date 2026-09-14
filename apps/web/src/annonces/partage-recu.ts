import { resoudreAnnonce } from './resoudre';

/** Texte partagé gardé pour la lecture : une annonce tient largement dedans. */
export const LONGUEUR_MAX_TEXTE_PARTAGE = 10_000;

/** Au-delà, un paramètre reçu est coupé avant toute lecture : l'adresse vient d'une autre app. */
const LONGUEUR_MAX_PARAMETRE = 2 * LONGUEUR_MAX_TEXTE_PARTAGE;

/** Paramètres de la cible de partage (`share_target` du manifeste) : titre, texte et lien. */
export const PARAMETRES_PARTAGE = { titre: 'titre', texte: 'texte', lien: 'lien' } as const;

/** Ce que Nouveau projet reçoit quand une annonce est partagée vers Deklic depuis une autre app. */
export type PartageRecu =
  | { readonly statut: 'absent' }
  | { readonly statut: 'recu'; readonly url: string }
  | { readonly statut: 'recu'; readonly texte: string };

const LIEN = /https?:\/\/[^\s<>"']+/g;

/** Ponctuation collée au lien en fin de phrase (« …/2214738851. »), jamais utile à l'adresse. */
const PONCTUATION_FINALE: ReadonlySet<string> = new Set([
  '.',
  ',',
  ';',
  ':',
  '!',
  '?',
  ')',
  ']',
  '}',
  '»',
]);

/** Retire la ponctuation finale en un seul passage (pas d'expression régulière qui revient en arrière). */
function sansPonctuationFinale(lien: string): string {
  let fin = lien.length;
  // `charAt(-1)` rend une chaîne vide : la boucle s'arrête au plus tard au début du lien.
  while (PONCTUATION_FINALE.has(lien.charAt(fin - 1))) fin -= 1;
  return lien.slice(0, fin);
}

function liensDans(texte: string): string[] {
  return Array.from(texte.matchAll(LIEN), (correspondance) =>
    sansPonctuationFinale(correspondance[0]),
  );
}

/**
 * Lit `?titre=…&texte=…&lien=…`. L'adresse retenue est le premier lien d'annonce reconnu (lien, puis
 * texte, puis titre), sinon le premier lien trouvé. Sans aucun lien, ce qui a été partagé est rendu
 * pour être lu, tronqué à 10 000 caractères. Rien n'est stocké.
 */
export function lirePartageRecu(recherche: string): PartageRecu {
  const parametres = new URLSearchParams(recherche);
  const lire = (nom: string): string =>
    (parametres.get(nom) ?? '').slice(0, LONGUEUR_MAX_PARAMETRE).trim();
  const lien = lire(PARAMETRES_PARTAGE.lien);
  const texte = lire(PARAMETRES_PARTAGE.texte);
  const titre = lire(PARAMETRES_PARTAGE.titre);

  const liens = [lien, texte, titre].flatMap(liensDans);
  const url = liens.find((candidat) => resoudreAnnonce(candidat) !== null) ?? liens[0];
  if (url !== undefined) return { statut: 'recu', url };

  const partage = [titre, texte, lien].filter((morceau) => morceau !== '').join('\n');
  if (partage === '') return { statut: 'absent' };
  return { statut: 'recu', texte: partage.slice(0, LONGUEUR_MAX_TEXTE_PARTAGE) };
}

/** Ce que Nouveau projet reprend d'un partage reçu, à son premier rendu. */
export interface AnnoncePartagee {
  /** Un partage a été reçu : l'adresse est à nettoyer. */
  readonly recue: boolean;
  /** Le lien trouvé dans le partage, sinon `null`. */
  readonly lien: string | null;
  /** Le texte partagé sans lien, sinon vide. */
  readonly texte: string;
  /** Lien d'annonce reconnu ou texte à lire : l'écran s'ouvre sur « Le texte de l'annonce ». */
  readonly etape: 'lien' | 'texte';
}

/** Une capture de l'extension reçue en même temps reste prioritaire : le partage est alors ignoré. */
export function annoncePartagee(captureRecue: boolean, recherche: string): AnnoncePartagee {
  const partage: PartageRecu = captureRecue ? { statut: 'absent' } : lirePartageRecu(recherche);
  const lien = partage.statut === 'recu' && 'url' in partage ? partage.url : null;
  const texte = partage.statut === 'recu' && 'texte' in partage ? partage.texte : '';
  const aLire = (lien !== null && resoudreAnnonce(lien) !== null) || texte !== '';
  return { recue: partage.statut === 'recu', lien, texte, etape: aLire ? 'texte' : 'lien' };
}
