/**
 * Script de contenu, injecté dans l'onglet de l'annonce (clic sur l'icône, ou lecture demandée par
 * Deklic). Il lit la page, charge au besoin les données que la page elle-même charge (Bien'ici),
 * sur le portail et jamais ailleurs, et dépose le résultat (une promesse) dans son monde isolé.
 * Le build ajoute en dernière ligne `globalThis.__loupeCapture;` : c'est la valeur que
 * `chrome.scripting.executeScript` attend puis rend.
 */
import { chargeurDuPortail, lirePage } from './logique/lire-page';
import { REGISTRE } from './regles';

interface MondeIsole {
  __loupeCapture?: unknown;
}

(globalThis as MondeIsole).__loupeCapture = lirePage(
  document,
  location.href,
  REGISTRE,
  chargeurDuPortail((adresse, init) => fetch(adresse, init), location.origin),
);
