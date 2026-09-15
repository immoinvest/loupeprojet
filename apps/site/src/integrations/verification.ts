import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { AstroIntegration } from 'astro';

import { texteEnTetes } from '../lib/verification/en-tetes';
import { cheminDepuisFichier, verifierPage } from '../lib/verification/pages';

interface OptionsVerification {
  readonly origineSite: string;
  readonly origineApplication: string;
}

async function fichiersDe(racine: string): Promise<string[]> {
  const entrees = await readdir(racine, { recursive: true, withFileTypes: true });
  return entrees
    .filter((entree) => entree.isFile())
    .map((entree) => path.relative(racine, path.join(entree.parentPath, entree.name)));
}

/**
 * Fin du build : chaque page HTML passe `verifierPage` (métadonnées, données structurées, liens internes,
 * CSP). Un défaut arrête le build en listant les pages ; sinon `_headers` est écrit pour Cloudflare Pages.
 */
export function verification(options: OptionsVerification): AstroIntegration {
  return {
    name: 'deklic-verification',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const racine = fileURLToPath(dir);
        const fichiers = await fichiersDe(racine);
        const existants = new Set(fichiers.map(cheminDepuisFichier));
        const pages = fichiers.filter((fichier) => fichier.endsWith('.html'));
        const erreurs: string[] = [];
        for (const fichier of pages) {
          const html = await readFile(path.join(racine, fichier), 'utf8');
          const page = { chemin: cheminDepuisFichier(fichier), html };
          erreurs.push(...verifierPage(page, existants, options.origineSite));
        }
        if (erreurs.length > 0) {
          throw new Error(
            `Vérification du site : ${String(erreurs.length)} défaut(s)\n${erreurs.join('\n')}`,
          );
        }
        await writeFile(path.join(racine, '_headers'), texteEnTetes(options.origineApplication));
        logger.info(`${String(pages.length)} pages vérifiées, _headers écrit`);
      },
    },
  };
}
