/**
 * Les règles de reconnaissance des URL d'annonces vivent dans `@loupe/capture`, partagées avec
 * l'extension et le bouton-favori : une seule source de vérité. Ce module ne fait que ré-exporter.
 */
export { PORTAILS, resoudreAnnonce, type AnnonceResolue, type Portail } from '@loupe/capture';
