import { milieuDePeriode, moisEntre } from '../donnees/anciennete';
import type {
  Communes,
  IndexDvf,
  Indicateur,
  Loyers,
  NomIndicateur,
  Source,
  Statistiques,
  TypeLogement,
  Zonage,
  Zone,
} from './fichiers';

export interface ParametresMarche {
  readonly codeInsee: string;
  readonly codePostal?: string | undefined;
  readonly type: TypeLogement;
  readonly pieces?: number | undefined;
}

export interface FichiersMarche {
  readonly communes: Communes | null;
  readonly dvf: IndexDvf | null;
  readonly loyers: Loyers | null;
  readonly zonage: Zonage | null;
}

export interface DvfMarche extends Omit<Statistiques, 'dateMediane'> {
  readonly type: TypeLogement;
  readonly fenetre: { readonly debut: string; readonly fin: string };
  readonly millesime: string;
  /** Code INSEE dont viennent les ventes : l'arrondissement quand il existe, sinon la commune. */
  readonly codeInsee: string;
  /** Date de la vente médiane ; `null` quand l'index publié ne la porte pas. */
  readonly dateMediane: string | null;
  /** Mois écoulés à la date de la réponse depuis la vente médiane (sinon depuis le milieu de la fenêtre). */
  readonly ancienneteMedianeMois: number | null;
}

export interface LoyerMarche extends Indicateur {
  readonly indicateur: NomIndicateur;
  readonly millesime: string;
  /** Loyers d'annonce ANIL : charges comprises, bien loué vide. */
  readonly chargesComprises: true;
}

export interface ReponseMarche {
  readonly codeInsee: string;
  readonly commune: string | null;
  readonly departement: string;
  readonly dvf: DvfMarche | null;
  readonly loyer: LoyerMarche | null;
  readonly zone: Zone | null;
  readonly sources: readonly Source[];
}

interface CommuneResolue {
  readonly code: string;
  readonly parente: string | null;
  readonly nom: string | null;
}

/**
 * Paris, Lyon et Marseille : le géocodage renvoie souvent la commune entière, les ventes sont indexées
 * par arrondissement. Le code postal désigne l'arrondissement ; sans lui, on garde la commune.
 */
export function resoudreCommune(
  communes: Communes | null,
  codeInsee: string,
  codePostal: string | undefined,
): CommuneResolue {
  const liste = communes?.communes ?? {};
  if (codePostal !== undefined) {
    for (const [code, c] of Object.entries(liste)) {
      if (c.communeParente === codeInsee && c.codesPostaux.includes(codePostal)) {
        return { code, parente: codeInsee, nom: c.nom };
      }
    }
  }
  const commune = liste[codeInsee];
  return { code: codeInsee, parente: commune?.communeParente ?? null, nom: commune?.nom ?? null };
}

/** La première valeur trouvée en parcourant les codes dans l'ordre (arrondissement, puis commune parente). */
function chercher<T>(codes: readonly string[], lire: (code: string) => T | undefined): T | null {
  for (const code of codes) {
    const valeur = lire(code);
    if (valeur !== undefined) return valeur;
  }
  return null;
}

/** Lit une valeur dans un fichier facultatif ; la source n'est citée que si une valeur en vient. */
function depuis<F extends { readonly source: Source }, T>(
  fichier: F | null,
  lire: (f: F) => T | null,
): readonly [T | null, Source | null] {
  if (fichier === null) return [null, null];
  const valeur = lire(fichier);
  return [valeur, valeur === null ? null : fichier.source];
}

export function indicateurPour(type: TypeLogement, pieces: number | undefined): NomIndicateur {
  if (type === 'maison') return 'maison';
  if (pieces === undefined) return 'appartement';
  return pieces <= 2 ? 'appartementT1T2' : 'appartementT3Plus';
}

function dvfPour(
  dvf: IndexDvf,
  codes: readonly string[],
  type: TypeLogement,
  maintenant: number,
): DvfMarche | null {
  return chercher(codes, (code) => {
    const stats = dvf.communes[code]?.[type];
    if (stats === undefined) return undefined;
    const dateMediane = stats.dateMediane ?? null;
    return {
      ...stats,
      type,
      fenetre: dvf.fenetre,
      millesime: dvf.millesime,
      codeInsee: code,
      dateMediane,
      ancienneteMedianeMois: moisEntre(dateMediane ?? milieuDePeriode(dvf.fenetre), maintenant),
    };
  });
}

function loyerPour(
  loyers: Loyers,
  codes: readonly string[],
  type: TypeLogement,
  pieces: number | undefined,
): LoyerMarche | null {
  const precis = indicateurPour(type, pieces);
  // L'indicateur par taille manque parfois : l'indicateur général du type prend le relais.
  const ordre: readonly NomIndicateur[] = precis === type ? [precis] : [precis, type];
  return chercher(codes, (code) => {
    const commune = loyers.communes[code];
    for (const indicateur of ordre) {
      const valeur = commune?.[indicateur];
      if (valeur !== undefined) {
        return {
          ...valeur,
          indicateur,
          millesime: loyers.millesime,
          chargesComprises: true as const,
        };
      }
    }
    return undefined;
  });
}

/** Assemble la réponse /marche à partir des fichiers lus, à l'instant `maintenant` (ancienneté) ; pure, sans réseau. */
export function assemblerMarche(
  parametres: ParametresMarche,
  departement: string,
  fichiers: FichiersMarche,
  maintenant: number,
): ReponseMarche {
  const commune = resoudreCommune(fichiers.communes, parametres.codeInsee, parametres.codePostal);
  const codes = commune.parente === null ? [commune.code] : [commune.code, commune.parente];
  const [dvf, sourceDvf] = depuis(fichiers.dvf, (f) =>
    dvfPour(f, codes, parametres.type, maintenant),
  );
  const [loyer, sourceLoyer] = depuis(fichiers.loyers, (f) =>
    loyerPour(f, codes, parametres.type, parametres.pieces),
  );
  const [zone, sourceZone] = depuis(fichiers.zonage, (f) => chercher(codes, (c) => f.communes[c]));
  return {
    codeInsee: commune.code,
    commune: commune.nom,
    departement,
    dvf,
    loyer,
    zone,
    sources: [sourceDvf, sourceLoyer, sourceZone].filter((s): s is Source => s !== null),
  };
}
