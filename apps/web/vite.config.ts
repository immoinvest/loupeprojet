import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const DOSSIER_COMPTES = fileURLToPath(new URL('../comptes', import.meta.url));

/** Bundle le worker des comptes avec le wrangler de apps/comptes (sans déploiement), dans un dossier temporaire. */
function bundlerComptes(): string {
  const temporaire = mkdtempSync(join(tmpdir(), 'deklic-comptes-'));
  const exiger = createRequire(join(DOSSIER_COMPTES, 'package.json'));
  const wrangler = join(dirname(exiger.resolve('wrangler/package.json')), 'bin', 'wrangler.js');
  const resultat = spawnSync(
    process.execPath,
    [wrangler, 'deploy', '--dry-run', '--outdir', temporaire],
    { cwd: DOSSIER_COMPTES, stdio: 'inherit' },
  );
  if (resultat.status !== 0) {
    throw new Error('Le worker des comptes ne se bundle pas (wrangler deploy --dry-run).');
  }
  return temporaire;
}

/** Seul /api/* entre dans le worker ; le reste est servi en statique (et _redirects s'applique). */
const ROUTES_PAGES = { version: 1, include: ['/api/*'], exclude: [] };

/**
 * L'API des comptes (apps/comptes) est servie sur l'origine du site par Cloudflare Pages : le build
 * dépose son worker en dist/_worker.js et dist/_routes.json, qui ne lui envoie que /api/*.
 */
function workerDesComptes(): Plugin {
  let sortie = '';
  return {
    name: 'deklic-worker-comptes',
    // Opt-in : sans DEKLIC_COMPTES=1 (variable de build du projet Pages), ni _worker.js ni _routes.json,
    // donc ni flag nodejs_compat ni base D1 requis ; le site se déploie comme avant, connexion indisponible.
    apply: (_config, { command }) => command === 'build' && process.env.DEKLIC_COMPTES === '1',
    configResolved(config) {
      sortie = join(config.root, config.build.outDir);
    },
    closeBundle() {
      const temporaire = bundlerComptes();
      const modules = readdirSync(temporaire).filter((f) => /\.(m?js|wasm)$/.test(f));
      const [seul] = modules;
      if (modules.length === 1 && seul !== undefined) {
        copyFileSync(join(temporaire, seul), join(sortie, '_worker.js'));
      } else {
        const dossier = join(sortie, '_worker.js');
        mkdirSync(dossier, { recursive: true });
        for (const module of modules) copyFileSync(join(temporaire, module), join(dossier, module));
      }
      rmSync(temporaire, { recursive: true, force: true });
      writeFileSync(join(sortie, '_routes.json'), `${JSON.stringify(ROUTES_PAGES, null, 2)}\n`);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), workerDesComptes()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // Port fourni par l'environnement (aperçu Claude Code) ; 5173 par défaut en local.
    port: Number(process.env.PORT) || 5173,
    // En développement, l'API des comptes tourne à part (npm run dev -w apps/comptes, port 8787) :
    // le navigateur la voit sur l'origine du site, comme en production.
    proxy: { '/api': 'http://localhost:8787' },
  },
});
