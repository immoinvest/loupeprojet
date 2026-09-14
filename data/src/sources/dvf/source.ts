import { join } from 'node:path';
import type { Contexte } from '../../commun/contexte.ts';
import { lireCsv } from '../../commun/csv.ts';
import { ecrireJson, ecrireTexte } from '../../commun/fichiers.ts';
import { elementA } from '../../commun/listes.ts';
import {
  ErreurTelechargement,
  existe,
  telechargerTexteEnFlux,
} from '../../commun/telechargement.ts';
import {
  IndexDvfDepartementSchema,
  IndexDvfNationalSchema,
  TendanceDvfDepartementSchema,
  type IndexDvfDepartement,
  type StatistiquesCommune,
  type Vente,
} from '../../schemas/dvf.ts';
import { ecrireMillesimeCourant } from '../courant.ts';
import {
  ANNEES_LUES,
  FENETRE_MOIS,
  FILTRES_DVF,
  SEUIL_VENTES_SEMESTRE,
  SOURCE_DVF,
  urlDvf,
} from './constantes.ts';
import { csvDesVentes } from './csv-sortie.ts';
import { dansFenetre, fenetreDesVentes } from './fenetre.ts';
import { regrouperParMutation } from './mutations.ts';
import { indexDesCommunes } from './statistiques.ts';
import { tendanceDesVentes } from './tendance.ts';
import { MOTIFS_EXCLUSION, venteDepuisMutation, type MotifExclusion } from './vente.ts';

export interface OptionsDvf {
  readonly departements: readonly string[];
  /** Vrai quand la passe couvre tous les départements : l'index national est alors écrit. */
  readonly passeComplete: boolean;
  /** Année du dossier DVF le plus récent ; détectée par sondage si absente. */
  readonly millesime?: number;
}

type Compteurs = Record<MotifExclusion | 'rupture', number>;

interface Collecte {
  readonly ventesParCommune: Map<string, Vente[]>;
  readonly exclusions: Compteurs;
  mutations: number;
}

/** Millésime = dossier annuel le plus récent disponible, sondé de l'année courante vers le passé. */
export async function detecterMillesime(
  contexte: Contexte,
  departementSonde: string,
): Promise<number> {
  const anneeCourante = contexte.horloge().getUTCFullYear();
  for (let annee = anneeCourante; annee > anneeCourante - ANNEES_LUES; annee -= 1) {
    if (await existe(urlDvf(annee, departementSonde), contexte)) {
      return annee;
    }
  }
  throw new Error(
    `aucun dossier DVF trouvé entre ${String(anneeCourante - ANNEES_LUES + 1)} et ${String(anneeCourante)}`,
  );
}

function nouvelleCollecte(): Collecte {
  const exclusions = { rupture: 0 } as Compteurs;
  for (const motif of MOTIFS_EXCLUSION) {
    exclusions[motif] = 0;
  }
  return { ventesParCommune: new Map(), exclusions, mutations: 0 };
}

async function collecterAnnee(
  contexte: Contexte,
  annee: number,
  departement: string,
  collecte: Collecte,
): Promise<void> {
  const url = urlDvf(annee, departement);
  const texte = telechargerTexteEnFlux(url, contexte, { gzip: true, encodage: 'utf-8' });
  try {
    for await (const mutation of regrouperParMutation(lireCsv(texte, { separateur: ',' }))) {
      collecte.mutations += 1;
      if (mutation.rupture) {
        collecte.exclusions.rupture += 1;
        continue;
      }
      const resultat = venteDepuisMutation(mutation.lignes, FILTRES_DVF);
      if (!resultat.ok) {
        collecte.exclusions[resultat.motif] += 1;
        continue;
      }
      const liste = collecte.ventesParCommune.get(resultat.vente.codeCommune);
      if (liste === undefined) {
        collecte.ventesParCommune.set(resultat.vente.codeCommune, [resultat.vente.vente]);
      } else {
        liste.push(resultat.vente.vente);
      }
    }
  } catch (erreur) {
    if (erreur instanceof ErreurTelechargement && erreur.statut === 404) {
      contexte.journal.avertissement('dossier DVF absent pour cette année', { url });
      return;
    }
    throw erreur;
  }
}

async function traiterDepartement(
  contexte: Contexte,
  departement: string,
  millesime: number,
): Promise<IndexDvfDepartement | null> {
  const collecte = nouvelleCollecte();
  for (let decalage = 0; decalage < ANNEES_LUES; decalage += 1) {
    await collecterAnnee(contexte, millesime - decalage, departement, collecte);
  }
  const fenetre = fenetreDesVentes([...collecte.ventesParCommune.values()].flat(), FENETRE_MOIS);
  if (fenetre === null) {
    contexte.journal.avertissement('aucune vente de logement retenue', { departement });
    return null;
  }
  const retenues = new Map<string, Vente[]>();
  for (const [code, ventes] of collecte.ventesParCommune) {
    const dansLaFenetre = ventes.filter((vente) => dansFenetre(vente, fenetre));
    if (dansLaFenetre.length > 0) {
      retenues.set(code, dansLaFenetre);
    }
  }
  const dossier = join(contexte.dossierSortie, 'dvf', String(millesime));
  let ventesPubliees = 0;
  // Le CSV d'une commune garde toutes les ventes collectées (cinq ans) : là où elles sont rares, les plus
  // anciennes comptent, et le Worker les ramène au dernier semestre par la tendance. L'index reste sur 24 mois.
  for (const [code, ventes] of collecte.ventesParCommune) {
    ventesPubliees += ventes.length;
    await ecrireTexte(join(dossier, `${code}.csv`), csvDesVentes(ventes));
  }
  const index = IndexDvfDepartementSchema.parse({
    genereLe: contexte.horloge().toISOString(),
    millesime: String(millesime),
    source: SOURCE_DVF,
    departement,
    fenetre,
    communes: indexDesCommunes(retenues),
  });
  await ecrireJson(join(dossier, 'index', `${departement}.json`), index);
  // La tendance lit toutes les ventes collectées (cinq ans), pas seulement la fenêtre publiée.
  const tendance = TendanceDvfDepartementSchema.parse({
    genereLe: contexte.horloge().toISOString(),
    millesime: String(millesime),
    source: SOURCE_DVF,
    departement,
    seuilVentes: SEUIL_VENTES_SEMESTRE,
    ...tendanceDesVentes(collecte.ventesParCommune, SEUIL_VENTES_SEMESTRE),
  });
  await ecrireJson(join(dossier, 'tendance', `${departement}.json`), tendance);
  contexte.journal.info('DVF : département publié', {
    departement,
    fenetre,
    communes: retenues.size,
    ventes: ventesPubliees,
    mutations: collecte.mutations,
    exclusions: collecte.exclusions,
  });
  return index;
}

/** Ventes de logements des cinq dossiers annuels : un CSV par commune ; index des 24 derniers mois par département, national si passe complète. */
export async function executerDvf(contexte: Contexte, options: OptionsDvf): Promise<void> {
  const millesime =
    options.millesime ?? (await detecterMillesime(contexte, elementA(options.departements, 0)));
  contexte.journal.info('DVF : millésime retenu', { millesime });
  const communes: Record<string, StatistiquesCommune> = {};
  const departements: string[] = [];
  for (const departement of options.departements) {
    const index = await traiterDepartement(contexte, departement, millesime);
    if (index !== null) {
      Object.assign(communes, index.communes);
      departements.push(departement);
    }
  }
  if (options.passeComplete) {
    const national = IndexDvfNationalSchema.parse({
      genereLe: contexte.horloge().toISOString(),
      millesime: String(millesime),
      source: SOURCE_DVF,
      departements,
      communes,
    });
    await ecrireJson(
      join(contexte.dossierSortie, 'dvf', String(millesime), 'index.json'),
      national,
    );
    await ecrireMillesimeCourant(contexte, 'dvf', String(millesime));
    contexte.journal.info('DVF : index national publié', { departements: departements.length });
  }
}
