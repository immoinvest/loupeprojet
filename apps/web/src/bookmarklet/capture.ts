/**
 * Point d'entrée du bouton-favori (`public/capture.js`, construit par `vite.bookmarklet.config.ts`).
 * Le code complet est glissé dans la barre de favoris sous forme d'URL `javascript:` : il tourne
 * dans la page de l'annonce, sans rien charger ni envoyer.
 */
import { lancerCapture } from './lancer';

/** Adresse de Deklic, figée au build (production, aperçu Cloudflare Pages, ou LOUPE_BASE_URL). */
declare const __LOUPE_BASE_URL__: string;

lancerCapture(document, window, __LOUPE_BASE_URL__);
