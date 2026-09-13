import { parseArgs } from 'node:util';
import { DEPARTEMENTS, estDepartement } from '../commun/departements.ts';
import { messageDe } from '../commun/erreurs.ts';

export const NOMS_SOURCES = [
  'dvf',
  'loyers',
  'taxe-fonciere',
  'zonage',
  'usure',
  'communes',
] as const;
export type NomSource = (typeof NOMS_SOURCES)[number];

export interface Arguments {
  readonly aide: boolean;
  readonly sources: readonly NomSource[];
  readonly departements: readonly string[];
  /** Vrai quand aucun département n'est imposé : la passe couvre la France entière. */
  readonly passeComplete: boolean;
  readonly dossierSortie: string;
  readonly millesimeDvf?: number;
  readonly anneeRei?: string;
}

export class ErreurArguments extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErreurArguments';
  }
}

export const DOSSIER_SORTIE_DEFAUT = 'dist';

export const AIDE = [
  'Usage : npm run referentiels -w data -- --source <nom> [--departement <code>]... [options]',
  '',
  `  --source <nom>          ${NOMS_SOURCES.join(', ')} ou « tout » (répétable)`,
  '  --departement <code>    01 à 95, 2A, 2B, 971 à 976 (répétable ; tous les départements sinon)',
  `  --sortie <dossier>      dossier de sortie (${DOSSIER_SORTIE_DEFAUT} par défaut, relatif à data/)`,
  '  --millesime-dvf <aaaa>  année du dossier DVF le plus récent (détectée sinon)',
  '  --annee-rei <aaaa>      exercice REI pour la taxe foncière (détecté sinon)',
  '  --aide                  affiche cette aide',
].join('\n');

function estNomSource(valeur: string): valeur is NomSource {
  return (NOMS_SOURCES as readonly string[]).includes(valeur);
}

function analyserSources(valeurs: readonly string[] | undefined): NomSource[] {
  if (valeurs === undefined || valeurs.length === 0) {
    throw new ErreurArguments('--source est obligatoire');
  }
  if (valeurs.includes('tout')) {
    return [...NOMS_SOURCES];
  }
  const sources: NomSource[] = [];
  for (const valeur of valeurs) {
    if (!estNomSource(valeur)) {
      throw new ErreurArguments(
        `source inconnue : ${valeur} (attendu : ${NOMS_SOURCES.join(', ')} ou tout)`,
      );
    }
    if (!sources.includes(valeur)) {
      sources.push(valeur);
    }
  }
  return sources;
}

function analyserDepartements(valeurs: readonly string[] | undefined): string[] {
  if (valeurs === undefined || valeurs.length === 0) {
    return [...DEPARTEMENTS];
  }
  const departements: string[] = [];
  for (const valeur of valeurs) {
    const code = valeur.trim().toUpperCase();
    if (!estDepartement(code)) {
      throw new ErreurArguments(`département inconnu : ${valeur}`);
    }
    if (!departements.includes(code)) {
      departements.push(code);
    }
  }
  return departements;
}

function analyserAnnee(valeur: string | undefined, option: string): string | undefined {
  if (valeur === undefined) {
    return undefined;
  }
  if (!/^\d{4}$/.test(valeur)) {
    throw new ErreurArguments(`${option} attend une année sur quatre chiffres : ${valeur}`);
  }
  return valeur;
}

/** Lit la ligne de commande ; toute erreur d'usage est une `ErreurArguments` à afficher avec l'aide. */
export function analyserArguments(argv: readonly string[]): Arguments {
  let valeurs;
  try {
    valeurs = parseArgs({
      args: [...argv],
      strict: true,
      options: {
        source: { type: 'string', multiple: true },
        departement: { type: 'string', multiple: true },
        sortie: { type: 'string' },
        'millesime-dvf': { type: 'string' },
        'annee-rei': { type: 'string' },
        aide: { type: 'boolean' },
      },
    }).values;
  } catch (erreur) {
    throw new ErreurArguments(messageDe(erreur));
  }
  if (valeurs.aide === true) {
    return {
      aide: true,
      sources: [],
      departements: [],
      passeComplete: false,
      dossierSortie: valeurs.sortie ?? DOSSIER_SORTIE_DEFAUT,
    };
  }
  const departementsDemandes = valeurs.departement;
  const millesimeDvf = analyserAnnee(valeurs['millesime-dvf'], '--millesime-dvf');
  const anneeRei = analyserAnnee(valeurs['annee-rei'], '--annee-rei');
  return {
    aide: false,
    sources: analyserSources(valeurs.source),
    departements: analyserDepartements(departementsDemandes),
    passeComplete: departementsDemandes === undefined || departementsDemandes.length === 0,
    dossierSortie: valeurs.sortie ?? DOSSIER_SORTIE_DEFAUT,
    ...(millesimeDvf === undefined ? {} : { millesimeDvf: Number(millesimeDvf) }),
    ...(anneeRei === undefined ? {} : { anneeRei }),
  };
}
