import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import {
  ajouterJours,
  cleDocument,
  CreationReponseSchema,
  ExportGestionSchema,
  loyerDuMois,
  occupationDe,
  PaiementSchema,
  periodeDe,
  type BienGere,
  type EtatGestion,
  type Paiement,
} from '@loupe/gestion';

import { ErreurGestion, type DepotGestion } from './depot';
import { depotBaux } from './depot-baux';
import { depotDocuments } from './depot-documents';
import { depotModifications } from './depot-modifications';
import { ecrireOccupation } from './ecritures';
import { lireLocation } from './lecture';
import {
  changementsParLocation,
  colocatairesParLocation,
  valeurSql,
  versBien,
  versDocument,
  versLocataire,
  versLocation,
  versPaiement,
  versPreferences,
  type Ligne,
  type Lier,
} from './lignes';

export interface OptionsDepot {
  /** Horodatage ISO des créations et date du jour des contrôles ; l'horloge réelle par défaut. */
  readonly maintenant?: () => string;
  readonly genererId?: () => string;
  /** Nombre maximal de biens par compte (réglable pour les tests). */
  readonly limiteBiens?: number;
}

/**
 * Au-delà d'un investisseur particulier, et une borne contre l'abus : sans elle, un compte pourrait
 * épuiser le quota d'écritures de la base partagée.
 */
export const LIMITE_BIENS = 200;

/** Un loyer ne se marque pas reçu plus d'un an à l'avance. */
const JOURS_D_AVANCE_MAX = 366;

/** Un loyer ne se marque pas reçu plus d'un an à l'avance. */
function tropEnAvance(periode: string, aujourdhui: string): boolean {
  return periode > periodeDe(ajouterJours(aujourdhui, JOURS_D_AVANCE_MAX));
}

const SQL = {
  biens: 'select * from gestion_bien where userId = ? order by creeLe, id',
  documents:
    'select id, type, numero, locationId, periode, paiementId, emisLe from gestion_document where userId = ? order by emisLe, id',
  locataires: 'select * from gestion_locataire where userId = ? order by creeLe, id',
  locations: 'select * from gestion_location where userId = ? order by debut, id',
  colocataires:
    'select locationId, locataireId from gestion_colocataire where userId = ? order by locationId, ordre',
  changements:
    'select locationId, aPartirDe, loyerHorsCharges, charges, apl from gestion_changement where userId = ? order by locationId, aPartirDe',
  // Plusieurs paiements par mois depuis G1b : l'ordre chronologique, stable.
  paiements: 'select * from gestion_paiement where userId = ? order by periode, date, creeLe, id',
  preferences: 'select * from gestion_preference where userId = ?',
  paiementDuCompte: 'select locationId, periode from gestion_paiement where id = ? and userId = ?',
  documentsDuPaiement:
    'select count(*) as n from gestion_document where userId = ? and (cle = ? or cle = ?)',
  nombreDeBiens: 'select count(*) as n from gestion_bien where userId = ?',
  insererBien:
    'insert into gestion_bien (id, userId, nom, adresse, codePostal, ville, type, surface, meuble, projetId, projet, creeLe, modifieLe) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  // Insertion conditionnelle (ADR-G11) : atomique, la somme du mois ne dépasse jamais le dû.
  insererPaiement:
    'insert into gestion_paiement (id, userId, locationId, periode, montant, date, source, creeLe) select ?, ?, ?, ?, ?, ?, ?, ? where (select coalesce(sum(montant), 0) from gestion_paiement where userId = ? and locationId = ? and periode = ?) + ? <= ?',
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

/** L'écriture d'un paiement, qui n'a lieu que si le mois reçu reste ≤ `du` (centimes). */
function insererPaiement(lier: Lier, userId: string, p: Paiement, du: number): D1PreparedStatement {
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
    userId,
    p.locationId,
    p.periode,
    p.montant,
    du,
  );
}

/** Le dépôt de production : la base D1 des comptes (tables gestion_* des migrations 0002 à 0005). */
export function depotD1(base: D1Database, options: OptionsDepot = {}): DepotGestion {
  const maintenant = options.maintenant ?? ((): string => new Date().toISOString());
  const genererId = options.genererId ?? ((): string => crypto.randomUUID());
  const limiteBiens = options.limiteBiens ?? LIMITE_BIENS;
  const lier: Lier = (sql, ...valeurs) => base.prepare(sql).bind(...valeurs.map(valeurSql));
  const lire = async (sql: string, userId: string): Promise<Ligne[]> =>
    (await lier(sql, userId).all<Ligne>()).results;
  const outils = { lier, maintenant, genererId };
  const documents = depotDocuments(outils);
  const baux = depotBaux({ ...outils, ensemble: (instructions) => base.batch(instructions) });
  const modifications = depotModifications(outils);

  const etat = async (userId: string): Promise<EtatGestion> => {
    const [biens, locataires, locations, colocations, changes, paiements, emis, bailleur, prefs] =
      await Promise.all([
        lire(SQL.biens, userId),
        lire(SQL.locataires, userId),
        lire(SQL.locations, userId),
        lire(SQL.colocataires, userId),
        lire(SQL.changements, userId),
        lire(SQL.paiements, userId),
        lire(SQL.documents, userId),
        documents.bailleur(userId),
        lire(SQL.preferences, userId),
      ]);
    const colocataires = colocatairesParLocation(colocations);
    const changements = changementsParLocation(changes);
    return {
      biens: biens.map(versBien),
      locataires: locataires.map(versLocataire),
      locations: locations.map((l) =>
        versLocation(l, colocataires.get(String(l.id)) ?? [], changements.get(String(l.id)) ?? []),
      ),
      paiements: paiements.map(versPaiement),
      bailleur,
      documents: emis.map(versDocument),
      preferences: versPreferences(prefs[0]),
    };
  };

  return {
    etat,
    enregistrerBailleur: documents.enregistrerBailleur,
    emettreDocument: documents.emettreDocument,
    document: documents.document,
    terminerLocation: baux.terminerLocation,
    louer: baux.louer,
    modifierLocation: modifications.modifierLocation,
    exporter: async (userId) =>
      ExportGestionSchema.parse({
        ...(await etat(userId)),
        exporteLe: maintenant(),
        documents: await documents.documentsComplets(userId),
      }),

    async creer(userId, creation) {
      const { results: compte } = await lier(SQL.nombreDeBiens, userId).all<{ n: number }>();
      const nombre = compte.reduce((somme, ligne) => somme + ligne.n, 0);
      if (nombre >= limiteBiens) throw new ErreurGestion('LIMITE_ATTEINTE');
      const horodatage = maintenant();
      const bien: BienGere = {
        id: genererId(),
        ...creation.bien,
        creeLe: horodatage,
        modifieLe: horodatage,
      };
      const occupation = occupationDe(creation);
      const { instructions, ...occupee } =
        occupation === null
          ? { locataire: null, location: null, colocataires: [], instructions: [] }
          : ecrireOccupation({ lier, userId, bienId: bien.id, horodatage, genererId }, occupation);
      await base.batch([insererBien(lier, userId, bien), ...instructions]);
      return CreationReponseSchema.parse({ bien, ...occupee });
    },

    async payer(userId, nouveau) {
      const location = await lireLocation(lier, userId, nouveau.locationId);
      const aujourdhui = maintenant().slice(0, 10);
      // Le dû est recalculé ici (changements de montants compris), jamais lu dans la requête ;
      // aucun dû = période hors de la location.
      const du = loyerDuMois(location, nouveau.periode);
      if (du === null || tropEnAvance(nouveau.periode, aujourdhui)) {
        throw new ErreurGestion('HORS_LOCATION');
      }
      if (nouveau.date > aujourdhui) throw new ErreurGestion('DATE_INVALIDE');
      const paiement = PaiementSchema.parse({
        id: genererId(),
        ...nouveau,
        source: 'manuel',
        creeLe: maintenant(),
      });
      const resultat = await insererPaiement(lier, userId, paiement, du.total).run();
      if (resultat.meta.changes === 0) throw new ErreurGestion('MONTANT_DEPASSE');
      return paiement;
    },

    async annulerPaiement(userId, paiementId) {
      const { results } = await lier(SQL.paiementDuCompte, paiementId, userId).all<{
        locationId: string;
        periode: string;
      }>();
      const [paiement] = results;
      if (paiement === undefined) throw new ErreurGestion('INTROUVABLE');
      const { results: emis } = await lier(
        SQL.documentsDuPaiement,
        userId,
        cleDocument({ type: 'recu', paiementId }),
        cleDocument({
          type: 'quittance',
          locationId: paiement.locationId,
          periode: paiement.periode,
        }),
      ).all<{ n: number }>();
      if (emis.reduce((somme, ligne) => somme + ligne.n, 0) > 0) {
        throw new ErreurGestion('DOCUMENT_EMIS');
      }
      await lier(SQL.supprimerPaiement, paiementId, userId).run();
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
