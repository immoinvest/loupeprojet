/**
 * Gestes de la carte des ventes, réglés pour ne jamais piéger le défilement de la page : hors plein écran, la molette
 * zoome seulement avec Ctrl (ou ⌘) et, au doigt, il faut deux doigts ; en plein écran, tout est libre.
 */

export type MessageGeste = 'ctrl' | 'doigts';

export type Geste =
  | { readonly type: 'molette'; readonly ctrl: boolean }
  | { readonly type: 'toucher'; readonly doigts: number };

/** Durée d'affichage du message qui explique le geste. */
export const DUREE_MESSAGE_MS = 1_800;

/** Le message à montrer pour ce geste ; `null` quand la carte le prend (et que la page ne défile pas). */
export function messageGeste(geste: Geste, pleinEcran: boolean): MessageGeste | null {
  if (pleinEcran) return null;
  if (geste.type === 'molette') return geste.ctrl ? null : 'ctrl';
  return geste.doigts === 1 ? 'doigts' : null;
}

/** Glisser à un doigt déplace la carte seulement en plein écran ; à la souris, toujours. */
export function glisserActif(auDoigt: boolean, pleinEcran: boolean): boolean {
  return !auDoigt || pleinEcran;
}
