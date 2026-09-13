import { debutFenetre } from '../../commun/dates.ts';
import type { Fenetre, Vente } from '../../schemas/dvf.ts';

/** Fenêtre de `mois` mois se terminant à la vente la plus récente ; null sans vente. */
export function fenetreDesVentes(ventes: Iterable<Vente>, mois: number): Fenetre | null {
  let fin: string | null = null;
  for (const vente of ventes) {
    if (fin === null || vente.date > fin) {
      fin = vente.date;
    }
  }
  if (fin === null) {
    return null;
  }
  return { debut: debutFenetre(fin, mois), fin };
}

export function dansFenetre(vente: Vente, fenetre: Fenetre): boolean {
  return vente.date >= fenetre.debut && vente.date <= fenetre.fin;
}
