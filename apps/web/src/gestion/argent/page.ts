import {
  ajouterMois,
  argentDeLAnnee,
  argentDuMois,
  CATEGORIES_DEPENSE,
  courbeDesMois,
  periodeDe,
  PeriodeSchema,
  type BienGere,
  type BilanArgent,
  type CategorieDepense,
  type DonneesArgent,
  type EtatArgent,
  type EtatGestion,
  type PointCourbe,
  type PretBien,
} from '@loupe/gestion';

import { pretDepuisAnalyse } from './pret-analyse';

/** Ce que les pages Argent calculent : l'état de Gérer et celui des dépenses, réunis. */
export function donneesArgent(
  gestion: Pick<EtatGestion, 'biens' | 'locations' | 'paiements'>,
  argent: EtatArgent,
): DonneesArgent {
  return {
    biens: gestion.biens,
    locations: gestion.locations,
    paiements: gestion.paiements,
    depenses: argent.depenses,
    prets: argent.prets,
  };
}

/** La période affichée : un mois, ou une année civile. */
export type Vue =
  | { readonly type: 'mois'; readonly periode: string }
  | { readonly type: 'annee'; readonly annee: number };

/** Mois proposés dans la liste, et années. */
export const MOIS_PROPOSES = 24;
export const ANNEES_PROPOSEES = 5;

/** `?annee=2026` ou `?mois=2026-10` ; sinon le mois en cours. */
export function vueDepuisRecherche(recherche: URLSearchParams, aujourdhui: string): Vue {
  const annee = recherche.get('annee') ?? '';
  if (/^\d{4}$/.test(annee)) return { type: 'annee', annee: Number(annee) };
  const mois = PeriodeSchema.safeParse(recherche.get('mois'));
  return { type: 'mois', periode: mois.success ? mois.data : periodeDe(aujourdhui) };
}

/** Le bien du filtre `?bien=`, s'il existe encore ; sinon tous les biens. */
export function bienDuFiltre(
  recherche: URLSearchParams,
  biens: readonly BienGere[],
): string | undefined {
  const id = recherche.get('bien');
  return biens.find((b) => b.id === id)?.id;
}

export function bilanDeLaVue(donnees: DonneesArgent, vue: Vue, bienId?: string): BilanArgent {
  return vue.type === 'mois'
    ? argentDuMois(donnees, vue.periode, { bienId })
    : argentDeLAnnee(donnees, vue.annee, { bienId });
}

/** La courbe des 12 mois qui finissent par le mois affiché, ou ceux de l'année affichée. */
export function courbeDeLaVue(
  donnees: DonneesArgent,
  vue: Vue,
  bienId?: string,
): readonly PointCourbe[] {
  const dernier = vue.type === 'mois' ? vue.periode : `${String(vue.annee)}-12`;
  return courbeDesMois(donnees, dernier, { bienId });
}

/** Les 24 derniers mois, le mois en cours d'abord. */
export function moisProposes(aujourdhui: string): readonly string[] {
  const courant = periodeDe(aujourdhui);
  return Array.from({ length: MOIS_PROPOSES }, (_, rang) => ajouterMois(courant, -rang));
}

/** Les 5 dernières années, l'année en cours d'abord. */
export function anneesProposees(aujourdhui: string): readonly number[] {
  const courante = Number(aujourdhui.slice(0, 4));
  return Array.from({ length: ANNEES_PROPOSEES }, (_, rang) => courante - rang);
}

/** « Tous les biens » dans la liste du filtre. */
export const TOUS_LES_BIENS = '';

/**
 * Les valeurs de la liste des périodes : « AAAA-MM » (24 derniers mois) ou « AAAA » (5 dernières
 * années), avec la période affichée en tête si elle est plus ancienne (adresse gardée).
 */
export function periodesDuChoix(vue: Vue, aujourdhui: string): readonly string[] {
  const proposees =
    vue.type === 'mois' ? moisProposes(aujourdhui) : anneesProposees(aujourdhui).map(String);
  const affichee = vue.type === 'mois' ? vue.periode : String(vue.annee);
  return proposees.includes(affichee) ? proposees : [affichee, ...proposees];
}

export interface MontantCategorie {
  readonly categorie: CategorieDepense;
  readonly montant: number;
}

/** Les catégories qui ont des dépenses, la plus lourde d'abord (ordre de la liste à égalité). */
export function categoriesDuBilan(bilan: BilanArgent): readonly MontantCategorie[] {
  return CATEGORIES_DEPENSE.map((categorie) => ({
    categorie,
    montant: bilan.depensesParCategorie[categorie],
  }))
    .filter((c) => c.montant > 0)
    .sort((a, b) => b.montant - a.montant);
}

export interface PretAEnregistrer {
  readonly bien: BienGere;
  readonly pret: PretBien;
}

/** Les biens venus d'une analyse avec emprunt dont le prêt n'est pas encore enregistré, par nom. */
export function pretsAEnregistrer(
  biens: readonly BienGere[],
  argent: EtatArgent,
): readonly PretAEnregistrer[] {
  return biens
    .filter((bien) => !argent.prets.some((p) => p.bienId === bien.id))
    .flatMap((bien) => {
      const pret = pretDepuisAnalyse(bien);
      return pret === null ? [] : [{ bien, pret }];
    })
    .sort((a, b) => a.bien.nom.localeCompare(b.bien.nom, 'fr', { numeric: true }));
}
