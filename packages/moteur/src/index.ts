/**
 * @loupe/moteur — moteur de calcul d'investissement locatif.
 *
 * TypeScript pur : aucune I/O, aucune date système, aucun aléatoire.
 * L'API publique est enrichie story par story (voir .product/specs/moteur-calcul-specs.md).
 */
export const VERSION_MOTEUR = '0.1.0';

export * from './commun';
export * from './regles';
export * from './schema';
export { projetExemple } from './exemples/t3-marseille';
