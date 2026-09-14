import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import {
  CreationReponseSchema,
  occupationDe,
  PaiementSchema,
  type BienGere,
  type Locataire,
  type LocationGeree,
  type Paiement,
} from '@loupe/gestion';

import { ErreurGestion, estDoublon, type DepotGestion } from './depot';
import {
  valeurSql,
  versBien,
  versLocataire,
  versLocation,
  versPaiement,
  versPreferences,
  type Ligne,
} from './lignes';

export interface OptionsDepot {
  /** Horodatage ISO des créations ; l'horloge réelle par défaut. */
  readonly maintenant?: () => string;
  readonly genererId?: () => string;
}

type Lier = (
  sql: string,
  ...valeurs: (string | number | boolean | undefined)[]
) => D1PreparedStatement;

const SQL = {
  biens: 'select * from gestion_bien where userId = ? order by creeLe, id',
  locataires: 'select * from gestion_locataire where userId = ? order by creeLe, id',
  locations: 'select * from gestion_location where userId = ? order by debut, id',
  paiements: 'select * from gestion_paiement where userId = ? order by periode, id',
  preferences: 'select * from gestion_preference where userId = ?',
  locationDuCompte: 'select id from gestion_location where id = ? and userId = ?',
  insererBien:
    'insert into gestion_bien (id, userId, nom, adresse, codePostal, ville, type, surface, meuble, projetId, projet, creeLe, modifieLe) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  insererLocataire:
    'insert into gestion_locataire (id, userId, prenom, nom, email, creeLe) values (?, ?, ?, ?, ?, ?)',
  insererLocation:
    'insert into gestion_location (id, userId, bienId, locataireId, type, debut, fin, jourLoyer, loyerHorsCharges, charges, depot, creeLe) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  insererPaiement:
    'insert into gestion_paiement (id, userId, locationId, periode, montant, date, source, creeLe) values (?, ?, ?, ?, ?, ?, ?, ?)',
  supprimerPaiement: 'delete from gestion_paiement where id = ? and userId = ?',
  enregistrerPreferences:
    'insert into gestion_preference (userId, analyser, gerer, modifieLe) values (?, ?, ?, ?) on conflict (userId) do update set analyser = excluded.analyser, gerer = excluded.gerer, modifieLe = excluded.modifieLe',
} as const;

function insererBien(lier: Lier, userId: string, b: BienGere): D1PreparedStatement {
  const projet = b.projet === undefined ? undefined : JSON.stringify(b.projet);
  return lier(
    SQL.insererBien,
    b.id,
    userId,
    b.nom,
    b.adresse,
    b.codePostal,
    b.ville,
    b.type,
    b.surface,
    b.meuble,
    b.projetId,
    projet,
    b.creeLe,
    b.modifieLe,
  );
}

function insererLocataire(lier: Lier, userId: string, l: Locataire): D1PreparedStatement {
  return lier(SQL.insererLocataire, l.id, userId, l.prenom, l.nom, l.email, l.creeLe);
}

function insererLocation(lier: Lier, userId: string, l: LocationGeree): D1PreparedStatement {
  return lier(
    SQL.insererLocation,
    l.id,
    userId,
    l.bienId,
    l.locataireId,
    l.type,
    l.debut,
    l.fin,
    l.jourLoyer,
    l.loyerHorsCharges,
    l.charges,
    l.depot,
    l.creeLe,
  );
}

function insererPaiement(lier: Lier, userId: string, p: Paiement): D1PreparedStatement {
  return lier(
    SQL.insererPaiement,
    p.id,
    userId,
    p.locationId,
    p.periode,
    p.montant,
    p.date,
    p.source,
    p.creeLe,
  );
}

/** Le dépôt de production : la base D1 des comptes (tables gestion_* de la migration 0002). */
export function depotD1(base: D1Database, options: OptionsDepot = {}): DepotGestion {
  const maintenant = options.maintenant ?? ((): string => new Date().toISOString());
  const genererId = options.genererId ?? ((): string => crypto.randomUUID());
  const lier: Lier = (sql, ...valeurs) => base.prepare(sql).bind(...valeurs.map(valeurSql));
  const lire = async (sql: string, userId: string): Promise<Ligne[]> =>
    (await lier(sql, userId).all<Ligne>()).results;

  return {
    async etat(userId) {
      const [biens, locataires, locations, paiements, preferences] = await Promise.all([
        lire(SQL.biens, userId),
        lire(SQL.locataires, userId),
        lire(SQL.locations, userId),
        lire(SQL.paiements, userId),
        lire(SQL.preferences, userId),
      ]);
      return {
        biens: biens.map(versBien),
        locataires: locataires.map(versLocataire),
        locations: locations.map(versLocation),
        paiements: paiements.map(versPaiement),
        preferences: versPreferences(preferences[0]),
      };
    },

    async creer(userId, creation) {
      const horodatage = maintenant();
      const bien: BienGere = {
        id: genererId(),
        ...creation.bien,
        creeLe: horodatage,
        modifieLe: horodatage,
      };
      const instructions = [insererBien(lier, userId, bien)];
      let locataire: Locataire | null = null;
      let location: LocationGeree | null = null;
      const occupation = occupationDe(creation);
      if (occupation !== null) {
        locataire = { id: genererId(), ...occupation.locataire, creeLe: horodatage };
        location = {
          id: genererId(),
          bienId: bien.id,
          locataireId: locataire.id,
          ...occupation.location,
          creeLe: horodatage,
        };
        instructions.push(
          insererLocataire(lier, userId, locataire),
          insererLocation(lier, userId, location),
        );
      }
      await base.batch(instructions);
      return CreationReponseSchema.parse({ bien, locataire, location });
    },

    async payer(userId, nouveau) {
      const siens = await lier(SQL.locationDuCompte, nouveau.locationId, userId).first();
      if (siens === null) throw new ErreurGestion('INTROUVABLE');
      const paiement = PaiementSchema.parse({
        id: genererId(),
        ...nouveau,
        source: 'manuel',
        creeLe: maintenant(),
      });
      try {
        await insererPaiement(lier, userId, paiement).run();
      } catch (erreur) {
        if (estDoublon(erreur)) throw new ErreurGestion('PERIODE_DEJA_RECUE');
        throw erreur;
      }
      return paiement;
    },

    async annulerPaiement(userId, paiementId) {
      const resultat = await lier(SQL.supprimerPaiement, paiementId, userId).run();
      if (resultat.meta.changes === 0) throw new ErreurGestion('INTROUVABLE');
    },

    async enregistrerPreferences(userId, preferences) {
      await lier(
        SQL.enregistrerPreferences,
        userId,
        preferences.analyser,
        preferences.gerer,
        maintenant(),
      ).run();
      return preferences;
    },
  };
}
