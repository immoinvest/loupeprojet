import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import { idDe, LIMITE_PROJETS, PAGE_PROJETS, type Changement } from '@loupe/projets';

import type { DepotProjets } from './depot';

export interface OptionsDepotProjets {
  /** Horodatage ISO de référence (date bornée, purge) ; l'horloge réelle par défaut. */
  readonly maintenant?: () => string;
  /** Projets actifs par compte (réglable pour les tests). */
  readonly limiteProjets?: number;
  /** Projets renvoyés par réponse (réglable pour les tests). */
  readonly page?: number;
}

/** Une suppression plus ancienne est oubliée : un appareil resté hors ligne plus longtemps la rattrape par `ids`. */
export const JOURS_SUPPRESSIONS_GARDEES = 90;

/** Suppressions gardées au plus par compte, contre la création et suppression en boucle. */
export const SUPPRESSIONS_GARDEES = 500;

const JOUR_MS = 86_400_000;

interface LigneConnue {
  readonly id: string;
  readonly modifieLe: string;
  readonly supprime: number;
}

interface LigneProjet {
  readonly id: string;
  readonly contenu: string;
  readonly revision: number;
}

function marques(nombre: number): string {
  return Array.from({ length: nombre }, () => '?').join(', ');
}

const SQL = {
  connues: (n: number) =>
    `select id, modifieLe, supprime from projet where userId = ? and id in (${marques(n)})`,
  actifs: 'select count(*) as n from projet where userId = ? and supprime = 0',
  // La révision est prise dans la même instruction : D1 sérialise les écritures, un lot est atomique.
  // La dernière modification gagne ; à date égale (dates bornées à l'heure du serveur), la dernière arrivée.
  ecrire:
    'insert into projet ("userId", "id", "contenu", "modifieLe", "revision", "supprime") values (?1, ?2, ?3, ?4, (select coalesce(max(revision), 0) + 1 from projet where userId = ?1), ?5) on conflict ("userId", "id") do update set contenu = excluded.contenu, modifieLe = excluded.modifieLe, revision = excluded.revision, supprime = excluded.supprime where excluded.modifieLe >= projet.modifieLe',
  // Jamais la révision maximale : sinon la prochaine écriture réutiliserait un numéro déjà lu.
  purger:
    'delete from projet where userId = ?1 and supprime = 1 and revision < (select max(revision) from projet where userId = ?1) and (modifieLe < ?2 or revision not in (select revision from projet where userId = ?1 and supprime = 1 order by revision desc limit ?3))',
  revisionMax: 'select coalesce(max(revision), 0) as n from projet where userId = ?',
  page: 'select id, contenu, revision from projet where userId = ? and supprime = 0 and revision > ? order by revision limit ?',
  lignes: (n: number) =>
    `select id, contenu, revision from projet where userId = ? and supprime = 0 and id in (${marques(n)})`,
  ids: 'select id from projet where userId = ? and supprime = 0 order by revision',
} as const;

/** Le dépôt de production : la table projet de la base D1 des comptes (migration 0004). */
export function depotProjetsD1(base: D1Database, options: OptionsDepotProjets = {}): DepotProjets {
  const horloge = options.maintenant ?? ((): string => new Date().toISOString());
  const limite = options.limiteProjets ?? LIMITE_PROJETS;
  const taillePage = options.page ?? PAGE_PROJETS;
  const lier = (sql: string, ...valeurs: (string | number | null)[]): D1PreparedStatement =>
    base.prepare(sql).bind(...valeurs);
  const lire = async <T>(sql: string, ...valeurs: (string | number)[]): Promise<T[]> =>
    (await lier(sql, ...valeurs).all<T>()).results;
  const nombre = async (sql: string, userId: string): Promise<number> =>
    (await lire<{ n: number }>(sql, userId)).reduce((somme, l) => somme + l.n, 0);

  /** Les écritures du lot et les projets refusés à la limite. */
  async function preparer(
    userId: string,
    changements: readonly Changement[],
    maintenant: string,
  ): Promise<{ ecrits: Changement[]; instructions: D1PreparedStatement[]; refuses: string[] }> {
    const ids = changements.map(idDe);
    const connues =
      ids.length === 0 ? [] : await lire<LigneConnue>(SQL.connues(ids.length), userId, ...ids);
    const parId = new Map(connues.map((l) => [l.id, l]));
    let actifs = await nombre(SQL.actifs, userId);
    const ecrits: Changement[] = [];
    const instructions: D1PreparedStatement[] = [];
    const refuses: string[] = [];
    for (const changement of changements) {
      const id = idDe(changement);
      const date = changement.type === 'enregistrer' ? changement.projet.modifieLe : changement.le;
      // Une horloge en avance ne gagne pas indéfiniment : la date retenue ne dépasse pas celle du serveur.
      const retenue = date > maintenant ? maintenant : date;
      const connue = parId.get(id);
      const gagne = connue === undefined || retenue >= connue.modifieLe;
      const actif = connue?.supprime === 0;
      if (changement.type === 'enregistrer') {
        if (gagne && !actif && actifs >= limite) {
          refuses.push(id);
          continue;
        }
        if (gagne && !actif) actifs += 1;
        instructions.push(
          lier(SQL.ecrire, userId, id, JSON.stringify(changement.projet), retenue, 0),
        );
      } else {
        if (gagne && actif) actifs -= 1;
        instructions.push(lier(SQL.ecrire, userId, id, null, retenue, 1));
      }
      ecrits.push(changement);
    }
    return { ecrits, instructions, refuses };
  }

  return {
    async synchroniser(userId, { depuis, changements }) {
      const maintenant = horloge();
      const { ecrits, instructions, refuses } = await preparer(userId, changements, maintenant);
      if (ecrits.some((c) => c.type === 'supprimer')) {
        const oubli = new Date(Date.parse(maintenant) - JOURS_SUPPRESSIONS_GARDEES * JOUR_MS);
        instructions.push(lier(SQL.purger, userId, oubli.toISOString(), SUPPRESSIONS_GARDEES));
      }
      const resultats = instructions.length === 0 ? [] : await base.batch(instructions);
      // Une écriture sans effet (version du compte plus récente) ne compte aucune ligne modifiée.
      const acceptes = new Set<string>();
      for (const [i, resultat] of resultats.entries()) {
        const ecrit = ecrits[i];
        if (ecrit !== undefined && resultat.meta.changes > 0) acceptes.add(idDe(ecrit));
      }

      // La révision maximale est lue avant la page : une écriture concurrente sera relue, jamais perdue.
      const revisionMax = await nombre(SQL.revisionMax, userId);
      const debut = depuis > revisionMax ? 0 : depuis;
      const lue = await lire<LigneProjet>(SQL.page, userId, debut, taillePage + 1);
      const suite = lue.length > taillePage;
      const page = lue.slice(0, taillePage);
      const curseur = suite
        ? Math.max(debut, ...page.map((l) => l.revision))
        : Math.max(revisionMax, debut);

      // Un envoi perdu contre une version plus récente : l'appareil reçoit la version du compte.
      const perdus = ecrits
        .filter((c) => c.type === 'enregistrer' && !acceptes.has(idDe(c)))
        .map(idDe);
      const [versions, actifs] = await Promise.all([
        perdus.length === 0 ? [] : lire<LigneProjet>(SQL.lignes(perdus.length), userId, ...perdus),
        lire<{ id: string }>(SQL.ids, userId),
      ]);
      const aRenvoyer = new Map<string, string>();
      for (const ligne of [...page, ...versions]) {
        if (!acceptes.has(ligne.id)) aRenvoyer.set(ligne.id, ligne.contenu);
      }

      // Le contenu stocké est la sérialisation d'un projet validé : il est recopié sans être réanalysé.
      return `{"curseur":${String(curseur)},"suite":${String(suite)},"ids":${JSON.stringify(
        actifs.map((l) => l.id),
      )},"refuses":${JSON.stringify(refuses)},"projets":[${[...aRenvoyer.values()].join(',')}]}`;
    },
  };
}
