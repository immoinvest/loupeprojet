import { NOM_PROJET_EXEMPLE, type ProjetEnregistre, type StatutProjet } from '@/stockage/projets';

/** Les étapes d'un achat montrées sur l'accueil, dans l'ordre du parcours. */
export const ETAPES = [
  'analyse',
  'visite',
  'offre',
  'achete',
] as const satisfies readonly StatutProjet[];
export type Etape = (typeof ETAPES)[number];

/** Ce que l'accueil propose de faire ensuite sur un projet. */
export type ActionProjet = 'gerer' | 'financement' | 'visite' | 'rapport';

export interface ProchaineEtape {
  readonly action: ActionProjet;
  readonly projet: ProjetEnregistre;
  readonly chemin: string;
}

export interface MeilleurCashflow {
  readonly projet: ProjetEnregistre;
  readonly mensuel: number;
}

export interface ResumeAnalyser {
  /** Aucun projet à soi : la liste est vide ou ne contient que l'exemple jamais modifié. */
  readonly vide: boolean;
  readonly exemple: ProjetEnregistre | null;
  /** Projets encore à l'étude : ni écartés, ni achetés. */
  readonly aEtudier: number;
  readonly parEtape: Readonly<Record<Etape, number>>;
  readonly meilleur: MeilleurCashflow | null;
  readonly prochaine: ProchaineEtape | null;
}

export interface OptionsResume {
  /** La section Gérer est affichée : un bien acheté peut y être repris. */
  readonly gerer: boolean;
  /** Cash-flow mensuel d'un projet, `null` quand l'analyse est incomplète (le moteur, injecté). */
  readonly cashflow: (projet: ProjetEnregistre) => number | null;
}

function estEtape(statut: StatutProjet): statut is Etape {
  return (ETAPES as readonly StatutProjet[]).includes(statut);
}

const A_ETUDIER: ReadonlySet<StatutProjet> = new Set(['analyse', 'visite', 'offre', 'scenario']);

/** Le projet d'exemple tel qu'amorcé : même nom, jamais modifié depuis sa création. */
export function estExempleIntact(p: ProjetEnregistre): boolean {
  return p.nom === NOM_PROJET_EXEMPLE && p.creeLe === p.modifieLe;
}

interface Regle {
  readonly statut: StatutProjet;
  readonly action: ActionProjet;
  readonly chemin: (id: string) => string;
  readonly retenir: (p: ProjetEnregistre, options: OptionsResume) => boolean;
}

/** Par priorité : le projet le plus avancé d'abord. */
const REGLES: readonly Regle[] = [
  {
    statut: 'achete',
    action: 'gerer',
    chemin: (id) => `/gerer/pret/${id}`,
    retenir: (_p, options) => options.gerer,
  },
  {
    statut: 'offre',
    action: 'financement',
    chemin: (id) => `/projets/${id}/financement`,
    retenir: () => true,
  },
  {
    statut: 'visite',
    action: 'visite',
    chemin: (id) => `/projets/${id}/visite`,
    retenir: (p) => p.visite?.faite !== true,
  },
  { statut: 'analyse', action: 'rapport', chemin: (id) => `/projets/${id}`, retenir: () => true },
];

function plusRecentDabord(a: ProjetEnregistre, b: ProjetEnregistre): number {
  return b.modifieLe.localeCompare(a.modifieLe);
}

function prochaineEtape(
  projets: readonly ProjetEnregistre[],
  options: OptionsResume,
): ProchaineEtape | null {
  const tries = [...projets].sort(plusRecentDabord);
  for (const regle of REGLES) {
    const projet = tries.find((p) => p.statut === regle.statut && regle.retenir(p, options));
    if (projet !== undefined) {
      return { action: regle.action, projet, chemin: regle.chemin(projet.id) };
    }
  }
  return null;
}

function meilleurCashflow(
  projets: readonly ProjetEnregistre[],
  options: OptionsResume,
): MeilleurCashflow | null {
  let meilleur: MeilleurCashflow | null = null;
  for (const projet of projets) {
    if (!A_ETUDIER.has(projet.statut)) continue;
    const mensuel = options.cashflow(projet);
    if (mensuel !== null && (meilleur === null || mensuel > meilleur.mensuel)) {
      meilleur = { projet, mensuel };
    }
  }
  return meilleur;
}

/** Ce que le bloc Analyser de l'accueil affiche, à partir des projets enregistrés. */
export function resumeAnalyser(
  projets: readonly ProjetEnregistre[],
  options: OptionsResume,
): ResumeAnalyser {
  const parEtape: Record<Etape, number> = { analyse: 0, visite: 0, offre: 0, achete: 0 };
  for (const { statut } of projets) {
    if (estEtape(statut)) parEtape[statut] += 1;
  }
  return {
    vide: projets.every(estExempleIntact),
    exemple: projets.find(estExempleIntact) ?? null,
    aEtudier: projets.filter((p) => A_ETUDIER.has(p.statut)).length,
    parEtape,
    meilleur: meilleurCashflow(projets, options),
    prochaine: prochaineEtape(projets, options),
  };
}
