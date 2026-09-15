import { estExempleIntact } from '@loupe/projets';
import { z } from 'zod';

import { compresserJson, decompresserJson } from './compression';
import { ProjetEnregistreSchema, migrerEnregistre, type ProjetEnregistre } from './projets';

/**
 * Transfert des projets de l'appareil vers la nouvelle adresse (fiche 23) : le stockage du
 * navigateur est propre à chaque domaine. L'ancienne adresse envoie ses projets compressés dans le
 * fragment (`/transfert#d=…`, jamais envoyé au serveur) ; la nouvelle les importe sans écraser un
 * projet plus récent.
 */

export const CHEMIN_TRANSFERT = '/transfert';
const PARAMETRE = 'd';
export const VERSION_TRANSFERT = 1;

/** Posé sur l'ancienne adresse quand ses projets sont partis : le transfert n'a lieu qu'une fois. */
export const CLE_TRANSFERT_FAIT = 'deklic.transfert.v1';

const EnveloppeSchema = z.object({
  version: z.literal(VERSION_TRANSFERT),
  projets: z.array(z.unknown()),
});

export type DecodageTransfert =
  | { readonly ok: true; readonly projets: ProjetEnregistre[]; readonly ignores: number }
  | { readonly ok: false; readonly raison: 'vide' | 'illisible' | 'invalide' };

/** Les projets à emporter : tous, sauf le projet d'exemple jamais touché. */
export function projetsATransferer(projets: readonly ProjetEnregistre[]): ProjetEnregistre[] {
  return projets.filter((p) => !estExempleIntact(p));
}

export async function lienTransfert(
  origineCible: string,
  projets: readonly ProjetEnregistre[],
): Promise<string> {
  const texte = await compresserJson({ version: VERSION_TRANSFERT, projets });
  return `${origineCible}${CHEMIN_TRANSFERT}#${PARAMETRE}=${texte}`;
}

export function lireFragmentTransfert(hash: string): string | null {
  return new URLSearchParams(hash.replace(/^#/, '')).get(PARAMETRE);
}

/** Texte du fragment → projets valides (les autres sont comptés, pas importés) ; jamais d'exception. */
export async function decoderTransfert(texte: string): Promise<DecodageTransfert> {
  const nettoye = texte.trim();
  if (nettoye === '') return { ok: false, raison: 'vide' };
  const lecture = await decompresserJson(nettoye);
  if (!lecture.ok) return { ok: false, raison: 'illisible' };
  const enveloppe = EnveloppeSchema.safeParse(lecture.valeur);
  if (!enveloppe.success) return { ok: false, raison: 'invalide' };
  const projets: ProjetEnregistre[] = [];
  for (const brut of enveloppe.data.projets) {
    const resultat = ProjetEnregistreSchema.safeParse(migrerEnregistre(brut));
    if (resultat.success) projets.push(resultat.data);
  }
  return { ok: true, projets, ignores: enveloppe.data.projets.length - projets.length };
}

export interface FusionTransfert {
  readonly projets: ProjetEnregistre[];
  /** Identifiants ajoutés ou remplacés : à noter au journal de synchronisation. */
  readonly ecrits: string[];
  /** Projets d'exemple jamais touchés, posés par cet appareil et retirés au profit des projets reçus. */
  readonly retires: ProjetEnregistre[];
  readonly ajoutes: number;
  readonly remplaces: number;
  /** Projets reçus dont la version de l'appareil est aussi récente ou plus récente : gardée. */
  readonly gardes: number;
}

export function fusionnerTransfert(
  existants: readonly ProjetEnregistre[],
  recus: readonly ProjetEnregistre[],
): FusionTransfert {
  const idsRecus = new Set(recus.map((p) => p.id));
  // L'exemple posé à l'ouverture de la nouvelle adresse ferait doublon avec les projets qui arrivent.
  const retires =
    recus.length === 0 ? [] : existants.filter((p) => estExempleIntact(p) && !idsRecus.has(p.id));
  let projets = existants.filter((p) => !retires.includes(p));
  const ecrits: string[] = [];
  const nouveaux: ProjetEnregistre[] = [];
  let remplaces = 0;
  let gardes = 0;
  for (const recu of recus) {
    const existant = projets.find((p) => p.id === recu.id);
    if (existant === undefined) {
      nouveaux.push(recu);
      ecrits.push(recu.id);
    } else if (recu.modifieLe > existant.modifieLe) {
      projets = projets.map((p) => (p.id === recu.id ? recu : p));
      ecrits.push(recu.id);
      remplaces += 1;
    } else {
      gardes += 1;
    }
  }
  return {
    projets: [...nouveaux, ...projets],
    ecrits,
    retires,
    ajoutes: nouveaux.length,
    remplaces,
    gardes,
  };
}

export function transfertDejaFait(stockage: Storage): boolean {
  return stockage.getItem(CLE_TRANSFERT_FAIT) !== null;
}

export function marquerTransfertFait(stockage: Storage, date: string): void {
  stockage.setItem(CLE_TRANSFERT_FAIT, date);
}
