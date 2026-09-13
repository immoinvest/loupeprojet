/**
 * Script de contenu, injecté dans l'onglet de l'annonce au clic sur « Analyser dans Loupe ».
 * Il lit la page et dépose le résultat dans son monde isolé ; il n'émet aucune requête réseau
 * et ne modifie pas la page. Le build ajoute en dernière ligne `globalThis.__loupeCapture;` :
 * c'est la valeur que `chrome.scripting.executeScript` rend au popup.
 */
import { lirePage } from './logique/lire-page';
import { REGISTRE } from './regles';

interface MondeIsole {
  __loupeCapture?: unknown;
}

(globalThis as MondeIsole).__loupeCapture = lirePage(document, location.href, REGISTRE);
