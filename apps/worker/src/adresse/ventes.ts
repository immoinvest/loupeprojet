/** Une vente de logement telle que publiée dans `dvf/<millesime>/<codeInsee>.csv`. */
export interface VenteDvf {
  readonly date: string;
  readonly prix: number;
  readonly surface: number;
  readonly type: 'appartement' | 'maison';
  readonly pieces: number;
  readonly lat: number | null;
  readonly lon: number | null;
  readonly idParcelle: string | null;
  readonly numero: number | null;
  readonly suffixe: string | null;
  readonly codeVoie: string | null;
  readonly voie: string | null;
  readonly carrez: number | null;
  /** Dépendances vendues avec le logement ; `null` dans les CSV publiés avant la colonne (15/09/2026). */
  readonly dependances: number | null;
  /** Terrain vendu avec le logement, en m² ; `null` sans terrain ou dans un ancien CSV. */
  readonly terrain: number | null;
  /** Lots de copropriété de la mutation ; `null` hors copropriété ou dans un ancien CSV. */
  readonly lots: number | null;
  /** Commune de la vente quand elle vient d'une commune voisine ; absente pour la commune du bien. */
  readonly codeInsee?: string | undefined;
}

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

function nombreOuNull(texte: string): number | null {
  if (texte === '') return null;
  const valeur = Number(texte);
  return Number.isFinite(valeur) ? valeur : null;
}

function texteOuNull(texte: string): string | null {
  return texte === '' ? null : texte;
}

/**
 * Lit le CSV des ventes d'une commune. Les colonnes d'adresse absentes (fichiers publiés avant leur ajout)
 * valent `null` ; une ligne sans date, prix, surface ou type valables est ignorée.
 */
export function lireVentes(csv: string): VenteDvf[] {
  const lignes = csv.split(/\r?\n/);
  const colonnes = lignes.slice(0, 1).join('').split(',');
  const position = new Map(colonnes.map((nom, index) => [nom.trim(), index]));
  const ventes: VenteDvf[] = [];
  for (const ligne of lignes.slice(1)) {
    const cellules = ligne.split(',');
    const valeur = (nom: string): string => {
      const index = position.get(nom);
      return index === undefined ? '' : (cellules[index] ?? '').trim();
    };
    const date = valeur('date');
    const prix = Number(valeur('prix'));
    const surface = Number(valeur('surface'));
    const type = valeur('type');
    if (!DATE_ISO.test(date) || !(prix > 0) || !(surface > 0)) continue;
    if (type !== 'appartement' && type !== 'maison') continue;
    ventes.push({
      date,
      prix,
      surface,
      type,
      pieces: nombreOuNull(valeur('pieces')) ?? 0,
      lat: nombreOuNull(valeur('lat')),
      lon: nombreOuNull(valeur('lon')),
      idParcelle: texteOuNull(valeur('idParcelle')),
      numero: nombreOuNull(valeur('numero')),
      suffixe: texteOuNull(valeur('suffixe')),
      codeVoie: texteOuNull(valeur('codeVoie')),
      voie: texteOuNull(valeur('voie')),
      carrez: nombreOuNull(valeur('carrez')),
      dependances: nombreOuNull(valeur('dependances')),
      terrain: nombreOuNull(valeur('terrain')),
      lots: nombreOuNull(valeur('lots')),
    });
  }
  return ventes;
}
