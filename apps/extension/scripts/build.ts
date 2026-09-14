/**
 * Build de l'extension : esbuild regroupe popup.ts et contenu.ts (IIFE, sans dépendance externe),
 * copie le manifeste, le popup et génère les icônes dans dist/chrome ; dist/firefox reprend le
 * tout avec les réglages propres à Firefox. `--dev` vise http://localhost:5173, `--watch` rebâtit
 * à chaque modification.
 *
 * Lancement : `node --experimental-strip-types scripts/build.ts [--dev] [--watch]`.
 */
import { build, context, type BuildOptions } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TAILLES_ICONES, icone } from './icones.ts';

const racine = dirname(dirname(fileURLToPath(import.meta.url)));
const dev = process.argv.includes('--dev');
const surveiller = process.argv.includes('--watch');
const BASE_URL_DEV = 'http://localhost:5173';
const dossierChrome = join(racine, 'dist', 'chrome');
const dossierFirefox = join(racine, 'dist', 'firefox');

function options(entree: string, complement: BuildOptions): BuildOptions {
  return {
    entryPoints: [join(racine, 'src', entree)],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['chrome120', 'firefox128'],
    minify: !dev,
    sourcemap: dev ? 'inline' : false,
    legalComments: 'none',
    outdir: dossierChrome,
    logLevel: 'info',
    ...complement,
  };
}

/** Le script de contenu se termine par cette expression : c'est la valeur que reçoit le popup. */
const contenu = options('contenu.ts', { footer: { js: 'globalThis.__loupeCapture;' } });
const popup = options(
  'popup.ts',
  dev ? { banner: { js: `globalThis.LOUPE_BASE_URL = ${JSON.stringify(BASE_URL_DEV)};` } } : {},
);
const pont = options('pont.ts', {});
const arrierePlan = options('arriere-plan.ts', {});
const entrees = [contenu, popup, pont, arrierePlan];

function copierStatiques(): void {
  mkdirSync(join(dossierChrome, 'icones'), { recursive: true });
  cpSync(join(racine, 'manifest.json'), join(dossierChrome, 'manifest.json'));
  cpSync(join(racine, 'src', 'popup.html'), join(dossierChrome, 'popup.html'));
  cpSync(join(racine, 'src', 'popup.css'), join(dossierChrome, 'popup.css'));
  for (const taille of TAILLES_ICONES) {
    writeFileSync(join(dossierChrome, 'icones', `${String(taille)}.png`), icone(taille));
  }
}

/**
 * Firefox exige un identifiant d'extension et une version minimale pour le Manifest V3, et lance
 * l'arrière-plan comme script d'événements plutôt que comme service worker.
 */
function deriverFirefox(): void {
  rmSync(dossierFirefox, { recursive: true, force: true });
  cpSync(dossierChrome, dossierFirefox, { recursive: true });
  const manifeste = JSON.parse(
    readFileSync(join(dossierChrome, 'manifest.json'), 'utf8'),
  ) as Record<string, unknown>;
  manifeste.browser_specific_settings = {
    gecko: { id: 'loupe@loupeprojet.pages.dev', strict_min_version: '128.0' },
  };
  manifeste.background = { scripts: ['arriere-plan.js'] };
  writeFileSync(join(dossierFirefox, 'manifest.json'), `${JSON.stringify(manifeste, null, 2)}\n`);
}

rmSync(join(racine, 'dist'), { recursive: true, force: true });
copierStatiques();
if (surveiller) {
  const contextes = await Promise.all(entrees.map((entree) => context(entree)));
  await Promise.all(contextes.map((c) => c.watch()));
  deriverFirefox();
  process.stdout.write(
    `Extension en veille (${dev ? BASE_URL_DEV : 'production'}) : ${dossierChrome}\n`,
  );
} else {
  await Promise.all(entrees.map((entree) => build(entree)));
  deriverFirefox();
  process.stdout.write(`Extension construite : ${dossierChrome} et ${dossierFirefox}\n`);
}
