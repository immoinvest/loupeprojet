import type { D1Database } from '@cloudflare/workers-types';
import { DEPENSES_MAX, type NouvelleDepense } from '@loupe/gestion';

import { valeurSql, type Ligne, type Lier } from '../lignes';
import { ErreurArgent, estTableArgentAbsente, type DepotArgent } from './depot';
import { versDepense, versPret } from './lignes';

export interface OptionsDepotArgent {
  /** Horodatage ISO des écritures ; l'horloge réelle par défaut. */
  readonly maintenant?: () => string;
  readonly genererId?: () => string;
  /** Nombre maximal de dépenses par compte (réglable pour les tests). */
  readonly limiteDepenses?: number;
}

// Un bien facultatif : `? is null` laisse passer une dépense sans bien, sinon le bien doit être du compte.
const BIEN_DU_COMPTE =
  '(? is null or exists (select 1 from gestion_bien where id = ? and userId = ?))';

const SQL = {
  depenses: 'select * from gestion_depense where userId = ? order by date, id',
  prets: 'select * from gestion_pret where userId = ? order by bienId',
  bienDuCompte: 'select id from gestion_bien where id = ? and userId = ?',
  // Insertion conditionnelle : le compte reste sous la limite et le bien est le sien, en une instruction.
  inserer: `insert into gestion_depense (id, userId, bienId, categorie, montant, date, libelle, recuperable, frequence, jusquAu, creeLe, modifieLe) select ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? where (select count(*) from gestion_depense where userId = ?) < ? and ${BIEN_DU_COMPTE} returning *`,
  modifier: `update gestion_depense set bienId = ?, categorie = ?, montant = ?, date = ?, libelle = ?, recuperable = ?, frequence = ?, jusquAu = ?, modifieLe = ? where id = ? and userId = ? and ${BIEN_DU_COMPTE} returning *`,
  supprimer: 'delete from gestion_depense where id = ? and userId = ?',
  pret: 'select * from gestion_pret where bienId = ? and userId = ?',
  enregistrerPret:
    'insert into gestion_pret (bienId, userId, capital, tauxAnnuel, dureeMois, debut, assuranceMensuelle, modifieLe) select ?, ?, ?, ?, ?, ?, ?, ? where exists (select 1 from gestion_bien where id = ? and userId = ?) on conflict ("bienId") do update set capital = excluded.capital, tauxAnnuel = excluded.tauxAnnuel, dureeMois = excluded.dureeMois, debut = excluded.debut, assuranceMensuelle = excluded.assuranceMensuelle, modifieLe = excluded.modifieLe returning *',
  supprimerPret: 'delete from gestion_pret where bienId = ? and userId = ?',
} as const;

/** Les colonnes d'une dépense, dans l'ordre des requêtes (de `bienId` à `jusquAu`). */
function colonnes(d: NouvelleDepense): (string | number | boolean | undefined)[] {
  return [
    d.bienId,
    d.categorie,
    d.montant,
    d.date,
    d.libelle,
    d.recuperable,
    d.recurrence?.frequence,
    d.recurrence?.jusquAu,
  ];
}

/** Le dépôt de production des dépenses et des prêts : la base D1 des comptes (migration 0007). */
export function depotArgentD1(base: D1Database, options: OptionsDepotArgent = {}): DepotArgent {
  const maintenant = options.maintenant ?? ((): string => new Date().toISOString());
  const genererId = options.genererId ?? ((): string => crypto.randomUUID());
  const limite = options.limiteDepenses ?? DEPENSES_MAX;
  const lier: Lier = (sql, ...valeurs) => base.prepare(sql).bind(...valeurs.map(valeurSql));
  const lire = async (sql: string, ...valeurs: string[]): Promise<Ligne[]> =>
    (await lier(sql, ...valeurs).all<Ligne>()).results;
  const bienDuCompte = async (userId: string, bienId: string): Promise<boolean> =>
    (await lire(SQL.bienDuCompte, bienId, userId)).length > 0;
  /** La ligne rendue par `returning *`, ou `null` si la condition de l'écriture a tout refusé. */
  const ecrire = async (
    sql: string,
    ...valeurs: (string | number | boolean | undefined)[]
  ): Promise<Ligne | null> => (await lier(sql, ...valeurs).all<Ligne>()).results[0] ?? null;

  const etat: DepotArgent['etat'] = async (userId) => {
    const [depenses, prets] = await Promise.all([
      lire(SQL.depenses, userId),
      lire(SQL.prets, userId),
    ]);
    return { depenses: depenses.map(versDepense), prets: prets.map(versPret) };
  };

  return {
    etat,

    depenses: async (userId) => (await lire(SQL.depenses, userId)).map(versDepense),

    async ajouterDepense(userId, nouvelle) {
      const horodatage = maintenant();
      const ligne = await ecrire(
        SQL.inserer,
        genererId(),
        userId,
        ...colonnes(nouvelle),
        horodatage,
        horodatage,
        userId,
        limite,
        nouvelle.bienId,
        nouvelle.bienId,
        userId,
      );
      if (ligne !== null) return versDepense(ligne);
      const bienRefuse =
        nouvelle.bienId !== undefined && !(await bienDuCompte(userId, nouvelle.bienId));
      throw new ErreurArgent(bienRefuse ? 'INTROUVABLE' : 'LIMITE_ATTEINTE');
    },

    async modifierDepense(userId, id, depense) {
      const ligne = await ecrire(
        SQL.modifier,
        ...colonnes(depense),
        maintenant(),
        id,
        userId,
        depense.bienId,
        depense.bienId,
        userId,
      );
      if (ligne === null) throw new ErreurArgent('INTROUVABLE');
      return versDepense(ligne);
    },

    async supprimerDepense(userId, id) {
      const { meta } = await lier(SQL.supprimer, id, userId).run();
      if (meta.changes === 0) throw new ErreurArgent('INTROUVABLE');
    },

    async pret(userId, bienId) {
      if (!(await bienDuCompte(userId, bienId))) throw new ErreurArgent('INTROUVABLE');
      const [ligne] = await lire(SQL.pret, bienId, userId);
      return ligne === undefined ? null : versPret(ligne);
    },

    async enregistrerPret(userId, bienId, pret) {
      const ligne = await ecrire(
        SQL.enregistrerPret,
        bienId,
        userId,
        pret.capital,
        pret.tauxAnnuel,
        pret.dureeMois,
        pret.debut,
        pret.assuranceMensuelle,
        maintenant(),
        bienId,
        userId,
      );
      if (ligne === null) throw new ErreurArgent('INTROUVABLE');
      return versPret(ligne);
    },

    async supprimerPret(userId, bienId) {
      const { meta } = await lier(SQL.supprimerPret, bienId, userId).run();
      if (meta.changes === 0) throw new ErreurArgent('INTROUVABLE');
    },

    async exporter(userId) {
      try {
        return await etat(userId);
      } catch (erreur) {
        if (estTableArgentAbsente(erreur)) return null;
        throw erreur;
      }
    },
  };
}
