import { join } from 'node:path';
import type { Contexte } from '../../commun/contexte.ts';
import { dateIso, trimestreDe } from '../../commun/dates.ts';
import { ecrireJson, lireJson, listerFichiers } from '../../commun/fichiers.ts';
import { SaisieUsureSchema, type SaisieUsure } from '../../schemas/usure.ts';
import { DOSSIER_SAISIES_USURE } from './constantes.ts';
import { publierUsure } from './transformer.ts';

export interface OptionsUsure {
  /** Dossier des saisies trimestrielles ; `data/sources/usure` par défaut. */
  readonly dossierSaisies?: string;
}

/** Seuils de l'usure : `usure/<trimestre>.json` pour chaque saisie et `usure/courant.json` pour le trimestre applicable. */
export async function executerUsure(contexte: Contexte, options: OptionsUsure): Promise<void> {
  const dossier = options.dossierSaisies ?? DOSSIER_SAISIES_USURE;
  const fichiers = await listerFichiers(dossier, '.json');
  const saisies: SaisieUsure[] = [];
  for (const fichier of fichiers) {
    saisies.push(SaisieUsureSchema.parse(await lireJson(fichier)));
  }
  const maintenant = contexte.horloge();
  const aujourdhui = dateIso(maintenant);
  const publication = publierUsure(saisies, aujourdhui, maintenant.toISOString());
  for (const trimestre of publication.trimestres) {
    await ecrireJson(
      join(contexte.dossierSortie, 'usure', `${trimestre.trimestre}.json`),
      trimestre,
    );
  }
  if (publication.courant === null) {
    throw new Error(
      `usure : aucun trimestre applicable au ${aujourdhui} parmi ${String(saisies.length)} saisie(s) dans ${dossier}`,
    );
  }
  await ecrireJson(join(contexte.dossierSortie, 'usure', 'courant.json'), publication.courant);
  if (publication.courant.perime) {
    contexte.journal.avertissement(
      'usure : le trimestre en cours n’est pas saisi, courant.json reste sur le précédent',
      { courant: publication.courant.trimestre, attendu: trimestreDe(aujourdhui), dossier },
    );
  }
  contexte.journal.info('usure : publié', {
    trimestres: publication.trimestres.length,
    courant: publication.courant.trimestre,
    perime: publication.courant.perime,
  });
}
