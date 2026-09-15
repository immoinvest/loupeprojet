import type { D1Database } from '@cloudflare/workers-types';
import { expirationDepuis, LIMITE_PARTAGES_PAR_HEURE } from '@loupe/projets';

import type { DepotPartages } from './depot';
import {
  aleatoireCrypto,
  empreinte,
  nouveauJeton,
  nouvelIdentifiant,
  type Aleatoire,
} from './jetons';

export interface OptionsDepotPartages {
  /** Horloge en millisecondes ; l'heure réelle par défaut. */
  readonly maintenant?: () => number;
  /** Créations par heure et par IP (réglable pour les tests). */
  readonly limiteParHeure?: number;
  readonly aleatoire?: Aleatoire;
}

const HEURE_MS = 3_600_000;
/** Deux identifiants tirés identiques de suite sont improbables (≈ 1 sur 10¹⁴) : au-delà, erreur. */
const ESSAIS_IDENTIFIANT = 3;

const SQL = {
  purgerExpires: 'delete from partage where expireLe <= ?',
  // L'empreinte d'IP ne sert plus après une heure : elle est effacée.
  oublierIp: 'update partage set ipHash = null where ipHash is not null and creeLe <= ?',
  // Compter et insérer dans la même instruction : deux créations simultanées ne dépassent pas la limite.
  inserer:
    'insert into partage ("id", "contenu", "creeLe", "expireLe", "jetonHash", "ipHash") select ?1, ?2, ?3, ?4, ?5, ?6 where (select count(*) from partage where ipHash = ?6 and creeLe > ?7) < ?8 on conflict ("id") do nothing',
  compterIp: 'select count(*) as n from partage where ipHash = ? and creeLe > ?',
  ouvrir:
    'update partage set expireLe = ?1 where id = ?2 and expireLe > ?3 returning contenu, expireLe',
  supprimer: 'delete from partage where id = ? and jetonHash = ?',
} as const;

/** Le dépôt de production : la table partage de la base D1 des comptes (migration 0006). */
export function depotPartagesD1(
  base: D1Database,
  secret: string,
  options: OptionsDepotPartages = {},
): DepotPartages {
  const horloge = options.maintenant ?? ((): number => Date.now());
  const limite = options.limiteParHeure ?? LIMITE_PARTAGES_PAR_HEURE;
  const aleatoire = options.aleatoire ?? aleatoireCrypto;

  return {
    async creer(contenu, ip) {
      const maintenant = horloge();
      const iso = new Date(maintenant).toISOString();
      const ilYAUneHeure = new Date(maintenant - HEURE_MS).toISOString();
      await base.batch([
        base.prepare(SQL.purgerExpires).bind(iso),
        base.prepare(SQL.oublierIp).bind(ilYAUneHeure),
      ]);
      const ipHash = await empreinte(`${secret}:ip:${ip}`);
      const jeton = nouveauJeton(aleatoire);
      const jetonHash = await empreinte(jeton);
      const expireLe = expirationDepuis(maintenant);
      for (let essai = 0; essai < ESSAIS_IDENTIFIANT; essai += 1) {
        const id = nouvelIdentifiant(aleatoire);
        const resultat = await base
          .prepare(SQL.inserer)
          .bind(id, contenu, iso, expireLe, jetonHash, ipHash, ilYAUneHeure, limite)
          .run();
        if (resultat.meta.changes > 0) return { id, jeton, expireLe };
        const recents = await base
          .prepare(SQL.compterIp)
          .bind(ipHash, ilYAUneHeure)
          .first<number>('n');
        if (Number(recents) >= limite) return 'limite';
      }
      throw new Error('partage : identifiant déjà pris trois fois de suite');
    },

    async lire(id) {
      const maintenant = horloge();
      const { results } = await base
        .prepare(SQL.ouvrir)
        .bind(expirationDepuis(maintenant), id, new Date(maintenant).toISOString())
        .all<{ contenu: string; expireLe: string }>();
      const [ligne] = results;
      return ligne === undefined ? null : { contenu: ligne.contenu, expireLe: ligne.expireLe };
    },

    async supprimer(id, jeton) {
      const resultat = await base
        .prepare(SQL.supprimer)
        .bind(id, await empreinte(jeton))
        .run();
      return resultat.meta.changes > 0;
    },
  };
}
