import type { CleTri, DpeVente, FiltresVentes, VenteProcheAdresse } from '@/enrichissement';
import { dateCourte, nombre } from '@/formatage/nombres';

import { prixM2 } from './adresse';

/** Textes du tableau des ventes comparables de l'onglet Estimation. */

export const LIBELLES_COLONNES: Readonly<Record<CleTri, string>> = {
  date: 'Date',
  surface: 'Surface',
  pieces: 'Pièces',
  prix: 'Prix',
  prixM2: 'Prix au m²',
  prixAujourdhui: "Au prix d'aujourd'hui",
  distance: 'Distance',
  dpe: 'DPE',
};

export const LIBELLES_FILTRES: Readonly<
  Record<Exclude<keyof FiltresVentes, 'memesPieces'>, string>
> = {
  memeImmeuble: 'Même immeuble',
  recentes: '2 dernières années',
  passoires: 'DPE F ou G',
};

export const PHRASES_VENTES = {
  titre: 'Les ventes comparables les plus proches',
  filtres: 'Filtrer les ventes',
  aucune: 'Aucune vente pour ces filtres.',
  precedent: 'Précédent',
  suivant: 'Suivant',
  pagination: 'Pages des ventes',
  detail: 'Détail',
  inconnu: '—',
  dpeProbable: 'DPE probable : rapproché par l’adresse, la surface et la date de la vente.',
  dpeIndisponible:
    'La base des DPE de l’ADEME ne répond pas : le DPE des ventes n’est pas affiché pour le moment.',
} as const;

function pluriel(n: number, singulier: string, plurielTexte: string): string {
  return `${nombre(n)} ${n > 1 ? plurielTexte : singulier}`;
}

/** « 60 m² », « 58,5 m² » : une décimale seulement quand la surface n'est pas entière. */
function metresCarres(surface: number): string {
  return `${nombre(surface, Number.isInteger(surface) ? 0 : 1)} m²`;
}

/** « 3 pièces » : filtre « même nombre de pièces que le bien ». */
export function libelleFiltrePieces(pieces: number): string {
  return pluriel(pieces, 'pièce', 'pièces');
}

/** « Page 2 sur 7 ». */
export function phrasePage(page: number, pages: number): string {
  return `Page ${nombre(page)} sur ${nombre(pages)}`;
}

/** « 42 ventes » : nombre de lignes après filtres. */
export function phraseNombreVentes(n: number): string {
  return pluriel(n, 'vente', 'ventes');
}

/** « Les 300 ventes les plus proches sur 1 240. » */
export function phraseTronquees(affichees: number, total: number): string {
  return `Les ${nombre(affichees)} ventes les plus proches sur ${nombre(total)}.`;
}

/** « Tri par Prix au m², croissant » : annonce du tri pour les lecteurs d'écran. */
export function phraseTri(cle: CleTri, croissant: boolean): string {
  return `Tri par ${LIBELLES_COLONNES[cle]}, ${croissant ? 'croissant' : 'décroissant'}`;
}

/**
 * « 4 000 €/m² à la signature → 4 120 €/m² aujourd'hui (× 1,030) → 4 150 €/m² ramené à la surface du bien
 * (× 1,007) » : les étapes que le Worker a données.
 */
export function phrasePrixDetail(v: VenteProcheAdresse): string {
  const etapes = [`${prixM2(v.prixM2)} à la signature`];
  if (v.prixM2Actualise !== undefined && v.coefficient !== undefined) {
    etapes.push(`${prixM2(v.prixM2Actualise)} aujourd'hui (× ${nombre(v.coefficient, 3)})`);
  }
  if (v.prixM2Corrige !== undefined && v.correctionSurface !== undefined) {
    etapes.push(
      `${prixM2(v.prixM2Corrige)} ramené à la surface du bien (× ${nombre(v.correctionSurface, 3)})`,
    );
  }
  return etapes.join(' → ');
}

/** « 60 m², dont 58,5 m² Carrez · 3 pièces ». */
export function phraseSurfaces(v: VenteProcheAdresse): string {
  const carrez = v.carrez == null ? '' : `, dont ${metresCarres(v.carrez)} Carrez`;
  const pieces = v.pieces > 0 ? ` · ${libelleFiltrePieces(v.pieces)}` : '';
  return `${metresCarres(v.surface)}${carrez}${pieces}`;
}

/** « 1 dépendance vendue avec (cave, parking…) · terrain de 850 m² · 2 lots » ; `null` quand rien n'est connu. */
export function phraseAnnexes(v: VenteProcheAdresse): string | null {
  const parties: string[] = [];
  if (v.dependances != null && v.dependances > 0) {
    parties.push(
      `${pluriel(v.dependances, 'dépendance vendue', 'dépendances vendues')} avec (cave, parking…)`,
    );
  }
  if (v.terrain != null) parties.push(`terrain de ${metresCarres(v.terrain)}`);
  if (v.lots != null) parties.push(pluriel(v.lots, 'lot de copropriété', 'lots de copropriété'));
  return parties.length === 0 ? null : parties.join(' · ');
}

/**
 * « DPE D, GES E, 232 kWh/m²/an, établi le 10 déc. 2024 pour 62 m² · période de construction : 1948-1974 ·
 * chauffage : gaz naturel ».
 */
export function phraseDpe(dpe: DpeVente): string {
  const parties = [`DPE ${dpe.etiquetteDpe}`];
  if (dpe.etiquetteGes !== null) parties.push(`GES ${dpe.etiquetteGes}`);
  if (dpe.consommationM2 !== null) parties.push(`${nombre(dpe.consommationM2)} kWh/m²/an`);
  parties.push(`établi le ${dateCourte(dpe.date)} pour ${metresCarres(dpe.surface)}`);
  const suite = [
    ...(dpe.periodeConstruction === null
      ? []
      : [`période de construction : ${dpe.periodeConstruction}`]),
    ...(dpe.energieChauffage === null ? [] : [`chauffage : ${dpe.energieChauffage.toLowerCase()}`]),
  ];
  return [parties.join(', '), ...suite].join(' · ');
}

/** « Parcelle cadastrale 132058200E0318 » ; `null` sans parcelle. */
export function phraseParcelle(v: VenteProcheAdresse): string | null {
  return v.parcelle == null ? null : `Parcelle cadastrale ${v.parcelle}`;
}
