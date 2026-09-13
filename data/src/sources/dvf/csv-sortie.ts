import { EN_TETE_VENTES, type Vente } from '../../schemas/dvf.ts';

function texteOuVide(valeur: number | null): string {
  return valeur === null ? '' : String(valeur);
}

export function ligneCsvVente(vente: Vente): string {
  return [
    vente.date,
    String(vente.prix),
    String(vente.surface),
    vente.type,
    String(vente.pieces),
    texteOuVide(vente.lat),
    texteOuVide(vente.lon),
  ].join(',');
}

/** Contenu du fichier `dvf/<millesime>/<codeInsee>.csv`, ventes triées par date croissante. */
export function csvDesVentes(ventes: readonly Vente[]): string {
  const triees = [...ventes].sort((a, b) => a.date.localeCompare(b.date));
  return `${[EN_TETE_VENTES.join(','), ...triees.map(ligneCsvVente)].join('\n')}\n`;
}
