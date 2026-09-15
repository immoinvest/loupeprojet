import { liensApplication } from './lib/liens';

/** Liens vers l'application, calculés une fois au build depuis la variable `DEKLIC_ORIGINE`. */
export const LIENS = liensApplication(process.env.DEKLIC_ORIGINE);
