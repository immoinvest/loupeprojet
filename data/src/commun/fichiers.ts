import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** Écrit un fichier texte UTF-8 en créant les dossiers manquants. */
export async function ecrireTexte(chemin: string, contenu: string): Promise<void> {
  await mkdir(dirname(chemin), { recursive: true });
  await writeFile(chemin, contenu, 'utf8');
}

/** Écrit un JSON compact (les fichiers publiés sont lus par des machines) terminé par un saut de ligne. */
export async function ecrireJson(chemin: string, valeur: unknown): Promise<void> {
  await ecrireTexte(chemin, `${JSON.stringify(valeur)}\n`);
}

export async function lireJson(chemin: string): Promise<unknown> {
  return JSON.parse(await readFile(chemin, 'utf8')) as unknown;
}

/** Chemins des fichiers d'un dossier portant l'extension donnée, triés par nom. */
export async function listerFichiers(dossier: string, extension: string): Promise<string[]> {
  const noms = await readdir(dossier);
  return noms
    .filter((nom) => nom.endsWith(extension))
    .sort()
    .map((nom) => join(dossier, nom));
}
