import { fileURLToPath } from 'node:url';

/**
 * Les seuils de l'usure n'ont pas de source ouverte automatisable (jeu data.economie vide depuis 2018,
 * Webstat sans clé d'API, page Banque de France fermée aux robots) : ils sont saisis chaque trimestre
 * dans ce dossier, un fichier `<AAAA>-T<n>.json` par publication, puis validés et publiés par le script.
 */
export const DOSSIER_SAISIES_USURE = fileURLToPath(
  new URL('../../../sources/usure/', import.meta.url),
);
