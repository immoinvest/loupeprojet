import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { compilerMigration, contenuMigration, FICHIER_MIGRATION } from './migration';

// Régénère migrations/0001_comptes.sql après une montée de version de Better Auth ou un changement
// de configuration qui touche au schéma. Le test « migration » échoue tant que le fichier diffère.
const sql = await compilerMigration();
writeFileSync(FICHIER_MIGRATION, contenuMigration(sql));
process.stdout.write(`Migration écrite : ${fileURLToPath(FICHIER_MIGRATION)}\n`);
