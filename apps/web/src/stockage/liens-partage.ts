import { ID_PARTAGE } from '@loupe/projets';
import { z } from 'zod';

import type { ProjetEnregistre } from './projets';

/**
 * Les liens courts créés sur cet appareil, par projet : réutiliser le même lien tant que le projet
 * n'a pas changé, et garder les jetons pour « Arrêter le partage ». Jamais synchronisé avec le compte.
 */

export const CLE_LIENS_PARTAGE = 'deklic.partages.v1';

/** Liens gardés au plus par projet : les plus anciens sont oubliés (ils expirent d'eux-mêmes). */
export const LIENS_GARDES_PAR_PROJET = 20;

const LienMemoriseSchema = z.object({
  id: z.string().regex(ID_PARTAGE),
  jeton: z.string().min(1),
  /** La version du projet partagée par ce lien. */
  modifieLe: z.string(),
  expireLe: z.string(),
});
export type LienMemorise = z.infer<typeof LienMemoriseSchema>;

const MemoireSchema = z.record(z.string(), z.array(LienMemoriseSchema));
type Memoire = z.infer<typeof MemoireSchema>;

function lire(stockage: Storage): Memoire {
  try {
    const resultat = MemoireSchema.safeParse(
      JSON.parse(stockage.getItem(CLE_LIENS_PARTAGE) ?? '{}'),
    );
    return resultat.success ? resultat.data : {};
  } catch {
    return {};
  }
}

function ecrire(stockage: Storage, memoire: Memoire): void {
  try {
    stockage.setItem(CLE_LIENS_PARTAGE, JSON.stringify(memoire));
  } catch {
    // Stockage plein ou refusé : le lien reste valable, il sera seulement recréé au prochain partage.
  }
}

/** Les liens courts gardés pour ce projet, du plus ancien au plus récent. */
export function liensDuProjet(stockage: Storage, projetId: string): LienMemorise[] {
  return lire(stockage)[projetId] ?? [];
}

/** Le dernier lien de cette version du projet, s'il n'a pas expiré ; `null` sinon. */
export function lienReutilisable(
  stockage: Storage,
  enregistre: ProjetEnregistre,
  maintenant: string,
): LienMemorise | null {
  const dernier = liensDuProjet(stockage, enregistre.id).at(-1);
  return dernier?.modifieLe === enregistre.modifieLe && dernier.expireLe > maintenant
    ? dernier
    : null;
}

export function memoriserLien(stockage: Storage, projetId: string, lien: LienMemorise): void {
  const memoire = lire(stockage);
  memoire[projetId] = [...(memoire[projetId] ?? []), lien].slice(-LIENS_GARDES_PAR_PROJET);
  ecrire(stockage, memoire);
}

/** Oublie les liens d'un projet dont l'arrêt a réussi (les autres restent, pour réessayer). */
export function oublierLiens(stockage: Storage, projetId: string, ids: readonly string[]): void {
  const memoire = lire(stockage);
  const restants = (memoire[projetId] ?? []).filter((l) => !ids.includes(l.id));
  const suivante: Memoire = Object.fromEntries(
    Object.entries(memoire).filter(([cle]) => cle !== projetId),
  );
  if (restants.length > 0) suivante[projetId] = restants;
  ecrire(stockage, suivante);
}
