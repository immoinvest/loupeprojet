/** Espace fine insécable : le séparateur des milliers de `Intl.NumberFormat('fr-FR')`. */
export const ESPACE_MILLIERS = ' ';

const CHIFFRE = /\d/;
const SIGNIFICATIF = /[\d,.]/;

/**
 * Ce qui reste d'une frappe ou d'un collage : les chiffres et, si le champ en accepte, une virgule
 * décimale. Sans décimales, une virgule termine le nombre (« 155 000,50 € » → « 155000 ») et un point
 * sert de séparateur des milliers ; avec décimales, le premier point ou la première virgule sépare
 * les décimales. Les zéros de tête disparaissent.
 */
export function nettoyerMontant(texte: string, decimales: number): string {
  let entier = '';
  let fraction = '';
  let separateur = false;
  for (const c of texte) {
    if (CHIFFRE.test(c)) {
      if (separateur) fraction += c;
      else entier += c;
    } else if (c === ',' && decimales === 0) {
      break;
    } else if ((c === ',' || c === '.') && decimales > 0 && !separateur) {
      separateur = true;
    }
  }
  entier = entier.replace(/^0+(?=\d)/, '');
  if (!separateur) return entier;
  return `${entier === '' ? '0' : entier},${fraction.slice(0, decimales)}`;
}

/** « 155000 » → « 155 000 », « 32.5 » ou « 32,5 » → « 32,5 » ; les milliers groupés par trois. */
export function formaterMontant(brut: string): string {
  const [entier = '', fraction] = brut.split(/[.,]/);
  const groupe = entier.replace(/\B(?=(\d{3})+(?!\d))/g, ESPACE_MILLIERS);
  return fraction === undefined ? groupe : `${groupe},${fraction}`;
}

/** Nombre de chiffres et de séparateurs décimaux avant la position du curseur de texte. */
export function significatifsAvant(texte: string, position: number): number {
  return texte.slice(0, position).replace(/[^\d,.]/g, '').length;
}

/** Position, dans le texte mis en forme, juste après le n-ième chiffre ou séparateur décimal. */
export function positionApres(formate: string, significatifs: number): number {
  if (significatifs <= 0) return 0;
  let vus = 0;
  for (let i = 0; i < formate.length; i += 1) {
    if (SIGNIFICATIF.test(formate.charAt(i))) vus += 1;
    if (vus === significatifs) return i + 1;
  }
  return formate.length;
}
