import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import {
  CongeSchema,
  LocataireSchema,
  ModeChargesLocationSchema,
  MouvementColocationSchema,
  refusChangementColocataire,
  refusConge,
  type Locataire,
  type MouvementColocation,
  type SensMouvement,
} from '@loupe/gestion';

import { lignes, lireLocation, lirePaiements } from '../lecture';
import { valeurSql, type Lier } from '../lignes';
import { ErreurFinBail, type DepotFinBail } from './depot';
import { depotSoldes } from './depot-soldes';
import { lireMouvements, premiere } from './lecture';
import {
  versConge,
  versDecompte,
  versDecompteComplet,
  versModeCharges,
  versMouvement,
  versRegularisation,
  versRestitution,
} from './lignes';

export interface OptionsDepotFinBail {
  /** Horodatage ISO des écritures et date du jour des contrôles ; l'horloge réelle par défaut. */
  readonly maintenant?: () => string;
  readonly genererId?: () => string;
}

const SQL = {
  conges: 'select * from gestion_conge where userId = ? order by locationId',
  charges: 'select * from gestion_location_charges where userId = ? order by locationId',
  restitutions: 'select * from gestion_depot_restitution where userId = ? order by locationId',
  regularisations:
    'select * from gestion_regularisation where userId = ? order by locationId, annee',
  mouvements:
    'select * from gestion_colocation_mouvement where userId = ? order by locationId, date, id',
  decomptes:
    'select id, type, locationId, numero, emisLe from gestion_decompte where userId = ? order by emisLe, id',
  // Le congé d'abord : sans la migration 0011, le lot échoue avant de toucher à la sortie (ADR-G35).
  enregistrerConge:
    'insert into gestion_conge (locationId, userId, recuLe, fin, reduit, modifieLe) values (?, ?, ?, ?, ?, ?) on conflict (locationId) do update set recuLe = excluded.recuLe, fin = excluded.fin, reduit = excluded.reduit, modifieLe = excluded.modifieLe',
  sortie: 'update gestion_location set fin = ? where userId = ? and id = ?',
  conge: 'select * from gestion_conge where userId = ? and locationId = ?',
  retirerConge: 'delete from gestion_conge where userId = ? and locationId = ?',
  sansSortie: 'update gestion_location set fin = null where userId = ? and id = ?',
  enregistrerCharges:
    'insert into gestion_location_charges (locationId, userId, mode, modifieLe) values (?, ?, ?, ?) on conflict (locationId) do update set mode = excluded.mode, modifieLe = excluded.modifieLe',
  ordres: 'select ordre from gestion_colocataire where userId = ? and locationId = ?',
  insererMouvement:
    'insert into gestion_colocation_mouvement (id, userId, locationId, locataireId, sens, date, creeLe) values (?, ?, ?, ?, ?, ?, ?)',
  insererLocataire:
    'insert into gestion_locataire (id, userId, prenom, nom, email, creeLe) values (?, ?, ?, ?, ?, ?)',
  insererColocataire:
    'insert into gestion_colocataire (locationId, locataireId, userId, ordre) values (?, ?, ?, ?)',
  decompte: 'select * from gestion_decompte where userId = ? and id = ?',
} as const;

/** Le dépôt de production : tables de la migration 0011 de la base D1 des comptes. */
export function depotFinBailD1(base: D1Database, options: OptionsDepotFinBail = {}): DepotFinBail {
  const maintenant = options.maintenant ?? ((): string => new Date().toISOString());
  const genererId = options.genererId ?? ((): string => crypto.randomUUID());
  const lier: Lier = (sql, ...valeurs) => base.prepare(sql).bind(...valeurs.map(valeurSql));
  const ensemble = (
    instructions: D1PreparedStatement[],
  ): Promise<readonly { readonly meta: { readonly changes: number } }[]> =>
    base.batch(instructions);
  const soldes = depotSoldes({ lier, maintenant, genererId, ensemble });

  return {
    ...soldes,

    etat: async (userId) => {
      const [conges, charges, restitutions, regularisations, mouvements, decomptes] =
        await Promise.all([
          lignes(lier, SQL.conges, userId),
          lignes(lier, SQL.charges, userId),
          lignes(lier, SQL.restitutions, userId),
          lignes(lier, SQL.regularisations, userId),
          lignes(lier, SQL.mouvements, userId),
          lignes(lier, SQL.decomptes, userId),
        ]);
      return {
        conges: conges.map(versConge),
        charges: charges.map(versModeCharges),
        restitutions: restitutions.map(versRestitution),
        regularisations: regularisations.map(versRegularisation),
        mouvements: mouvements.map(versMouvement),
        decomptes: decomptes.map(versDecompte),
      };
    },

    enregistrerConge: async (userId, locationId, saisie) => {
      const location = await lireLocation(lier, userId, locationId);
      const paiements = await lirePaiements(lier, userId, locationId);
      const refus = refusConge(location, saisie, paiements, maintenant().slice(0, 10));
      if (refus !== null) throw new ErreurFinBail(refus);
      const modifieLe = maintenant();
      const { recuLe, fin, reduit } = saisie;
      await ensemble([
        lier(SQL.enregistrerConge, locationId, userId, recuLe, fin, reduit, modifieLe),
        lier(SQL.sortie, fin, userId, locationId),
      ]);
      return {
        conge: CongeSchema.parse({ locationId, recuLe, fin, reduit, modifieLe }),
        location: await lireLocation(lier, userId, locationId),
      };
    },

    retirerConge: async (userId, locationId) => {
      premiere(await lignes(lier, SQL.conge, userId, locationId));
      await ensemble([
        lier(SQL.retirerConge, userId, locationId),
        lier(SQL.sansSortie, userId, locationId),
      ]);
      return { location: await lireLocation(lier, userId, locationId) };
    },

    enregistrerModeCharges: async (userId, locationId, mode) => {
      await lireLocation(lier, userId, locationId);
      const modifieLe = maintenant();
      await lier(SQL.enregistrerCharges, locationId, userId, mode, modifieLe).run();
      return ModeChargesLocationSchema.parse({ locationId, mode, modifieLe });
    },

    changerColocataire: async (userId, locationId, changement) => {
      const location = await lireLocation(lier, userId, locationId);
      const refus = refusChangementColocataire(
        location,
        await lireMouvements(lier, userId, locationId),
        changement,
      );
      if (refus !== null) {
        throw new ErreurFinBail(refus === 'LIMITE_ATTEINTE' ? refus : 'COLOCATAIRE_REFUSE');
      }
      const creeLe = maintenant();
      const instructions: D1PreparedStatement[] = [];
      const mouvements: MouvementColocation[] = [];
      const noter = (locataireId: string, sens: SensMouvement, date: string): void => {
        const m = MouvementColocationSchema.parse({
          id: genererId(),
          locationId,
          locataireId,
          sens,
          date,
          creeLe,
        });
        mouvements.push(m);
        instructions.push(
          lier(SQL.insererMouvement, m.id, userId, locationId, locataireId, sens, date, creeLe),
        );
      };
      const { depart, arrivee } = changement;
      if (depart !== undefined) noter(depart.locataireId, 'depart', depart.date);
      let locataire: Locataire | null = null;
      if (arrivee !== undefined) {
        const ordres = await lignes(lier, SQL.ordres, userId, locationId);
        const ordre = ordres.reduce((max, l) => Math.max(max, Number(l.ordre)), 0) + 1;
        const nouveau = LocataireSchema.parse({ id: genererId(), ...arrivee.locataire, creeLe });
        locataire = nouveau;
        instructions.push(
          lier(
            SQL.insererLocataire,
            nouveau.id,
            userId,
            nouveau.prenom,
            nouveau.nom,
            nouveau.email,
            creeLe,
          ),
          lier(SQL.insererColocataire, locationId, nouveau.id, userId, ordre),
        );
        noter(nouveau.id, 'arrivee', arrivee.date);
      }
      await ensemble(instructions);
      return { location: await lireLocation(lier, userId, locationId), locataire, mouvements };
    },

    decompte: async (userId, id) =>
      versDecompteComplet(premiere(await lignes(lier, SQL.decompte, userId, id))),
  };
}
