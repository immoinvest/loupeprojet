import type { ProjetEntree } from '@loupe/moteur';

import type { SaisieProjet } from '@/annonces';

import type { ClientWorker } from './client';
import type { ReponseMarche } from './contrat';

/**
 * Les loyers d'annonce ANIL sont charges comprises : on retire 8 % pour un loyer de référence
 * hors charges (spécification, étape « Estimer »).
 */
export const PART_CHARGES_LOYER = 0.08;

export type MarcheEntree = NonNullable<ProjetEntree['marche']>;

export interface MarcheEnrichi {
  readonly marche: MarcheEntree;
  /** Provenance par chemin du projet : `dvf` et `anil` s'affichent « donnée publique ». */
  readonly provenance: Readonly<Record<string, string>>;
  readonly codeInsee: string;
}

const CHAMPS_DVF = ['medianM2', 'q1M2', 'q3M2', 'nombreVentes'] as const;

/** Réponse /marche → bloc `marche` du moteur, avec la provenance de chaque valeur. */
export function marcheDepuisReponse(r: ReponseMarche): MarcheEnrichi {
  const marche: { dvf?: MarcheEntree['dvf']; loyerReferenceM2?: number } = {};
  const provenance: Record<string, string> = {};
  if (r.dvf !== null) {
    marche.dvf = {
      medianM2: r.dvf.medianeM2,
      q1M2: r.dvf.q1M2,
      q3M2: r.dvf.q3M2,
      nombreVentes: r.dvf.ventes,
    };
    for (const champ of CHAMPS_DVF) provenance[`marche.dvf.${champ}`] = 'dvf';
  }
  if (r.loyer !== null) {
    marche.loyerReferenceM2 = Math.round(r.loyer.loyerM2 * (1 - PART_CHARGES_LOYER) * 100) / 100;
    provenance['marche.loyerReferenceM2'] = 'anil';
  }
  return { marche, provenance, codeInsee: r.codeInsee };
}

/**
 * Situe le bien (code postal + ville) puis lit les données de marché de sa commune.
 * Tout échec rend `null` : le projet est créé sans repère de marché, comme avant.
 */
export async function enrichirSaisie(
  saisie: SaisieProjet,
  client: ClientWorker,
): Promise<MarcheEnrichi | null> {
  const lieu = await client.geocoder(`${saisie.codePostal} ${saisie.ville}`, saisie.codePostal);
  if (!lieu.ok) return null;
  const codeInsee = lieu.valeur?.codeInsee ?? null;
  if (codeInsee === null) return null;
  const marche = await client.marche({
    codeInsee,
    codePostal: saisie.codePostal,
    type: 'appartement',
    pieces: saisie.pieces,
  });
  return marche.ok ? marcheDepuisReponse(marche.valeur) : null;
}
