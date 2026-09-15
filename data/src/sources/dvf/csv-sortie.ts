import { EN_TETE_VENTES, type Vente } from '../../schemas/dvf.ts';

function texteOuVide(valeur: number | null): string {
  return valeur === null ? '' : String(valeur);
}

/** Texte libre (nom de voie) : sans virgule, guillemet ni saut de ligne, pour un CSV lisible sans échappement. */
function texteCsv(valeur: string | null): string {
  return valeur === null ? '' : valeur.replace(/[",\s]+/g, ' ').trim();
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
    texteCsv(vente.idParcelle),
    texteOuVide(vente.numero),
    texteCsv(vente.suffixe),
    texteCsv(vente.codeVoie),
    texteCsv(vente.voie),
    texteOuVide(vente.carrez),
    String(vente.dependances),
    texteOuVide(vente.terrain),
    texteOuVide(vente.lots),
  ].join(',');
}

/** Contenu du fichier `dvf/<millesime>/<codeInsee>.csv`, ventes triées par date croissante. */
export function csvDesVentes(ventes: readonly Vente[]): string {
  const triees = [...ventes].sort((a, b) => a.date.localeCompare(b.date));
  return `${[EN_TETE_VENTES.join(','), ...triees.map(ligneCsvVente)].join('\n')}\n`;
}
