/**
 * @loupe/moteur — moteur de calcul d'investissement locatif.
 *
 * TypeScript pur : aucune I/O, aucune date système, aucun aléatoire.
 * L'API publique est enrichie story par story (voir .product/specs/moteur-calcul-specs.md).
 */
export const VERSION_MOTEUR = '0.1.0';

export { calculerBase, type ResultatsBase } from './calculer-base';
export {
  calculerProjet,
  type MetaResultats,
  type OptionsCalcul,
  type Resultats,
} from './calculer-projet';
export * from './cashflow';
export * from './commun';
export * from './estimation';
export * from './financement';
export * from './fiscalite';
export * from './regles';
export * from './rendement';
export * from './revente';
export * from './scenarios';
export * from './schema';
export * from './schema/resultats';
export * from './verdict';
export * from './visite';
export { projetExemple } from './exemples/t3-marseille';
