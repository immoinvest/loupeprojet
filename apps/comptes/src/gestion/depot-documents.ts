import {
  cleDocument,
  contenuQuittance,
  contenuRecu,
  DocumentCompletSchema,
  type DemandeDocument,
  type DocumentComplet,
  type EntreesDocument,
  type IdentiteBailleur,
} from '@loupe/gestion';

import { ErreurGestion, type Emission } from './depot';
import { versBailleur, versDocumentComplet, versPaiement, type Ligne, type Lier } from './lignes';

/** Horloge, identifiants et requêtes du dépôt, partagés avec `depotD1`. */
export interface Outils {
  readonly lier: Lier;
  readonly maintenant: () => string;
  readonly genererId: () => string;
}

const SQL = {
  bailleur: 'select nom, adresse from gestion_bailleur where userId = ?',
  enregistrerBailleur:
    'insert into gestion_bailleur (userId, nom, adresse, modifieLe) values (?, ?, ?, ?) on conflict (userId) do update set nom = excluded.nom, adresse = excluded.adresse, modifieLe = excluded.modifieLe',
  documentParCle: 'select * from gestion_document where userId = ? and cle = ?',
  documentParId: 'select * from gestion_document where userId = ? and id = ?',
  documentsComplets: 'select * from gestion_document where userId = ? order by emisLe, id',
  paiementDuCompte: 'select locationId from gestion_paiement where userId = ? and id = ?',
  // Une seule lecture : la location du compte avec son bien et son locataire (clés étrangères).
  occupation:
    'select l.id, l.debut, l.fin, l.jourLoyer, l.loyerHorsCharges, l.charges, b.nom as bienNom, b.adresse as bienAdresse, t.prenom, t.nom as locataireNom from gestion_location l join gestion_bien b on b.id = l.bienId join gestion_locataire t on t.id = l.locataireId where l.userId = ? and l.id = ?',
  paiementsDeLaLocation: 'select * from gestion_paiement where userId = ? and locationId = ?',
  insererDocument:
    'insert into gestion_document (id, userId, cle, type, numero, locationId, periode, paiementId, contenu, emisLe) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) on conflict (userId, cle) do nothing',
} as const;

async function lignes(lier: Lier, sql: string, ...valeurs: string[]): Promise<Ligne[]> {
  return (await lier(sql, ...valeurs).all<Ligne>()).results;
}

/** La location d'où part la demande : directe (quittance) ou celle du paiement (reçu). */
async function locationDeLaDemande(
  lier: Lier,
  userId: string,
  demande: DemandeDocument,
): Promise<string> {
  if (demande.type === 'quittance') return demande.locationId;
  const [paiement] = await lignes(lier, SQL.paiementDuCompte, userId, demande.paiementId);
  if (paiement === undefined) throw new ErreurGestion('INTROUVABLE');
  return String(paiement.locationId);
}

async function entreesDe(
  outils: Outils,
  userId: string,
  locationId: string,
): Promise<EntreesDocument> {
  const { lier, maintenant } = outils;
  const [occupation] = await lignes(lier, SQL.occupation, userId, locationId);
  if (occupation === undefined) throw new ErreurGestion('INTROUVABLE');
  const [bailleur, paiements] = await Promise.all([
    lignes(lier, SQL.bailleur, userId),
    lignes(lier, SQL.paiementsDeLaLocation, userId, locationId),
  ]);
  const { fin } = occupation;
  return {
    bailleur: versBailleur(bailleur[0]),
    bien: { nom: String(occupation.bienNom), adresse: String(occupation.bienAdresse) },
    locataire: { prenom: String(occupation.prenom), nom: String(occupation.locataireNom) },
    location: {
      id: String(occupation.id),
      debut: String(occupation.debut),
      ...(typeof fin === 'string' ? { fin } : {}),
      jourLoyer: Number(occupation.jourLoyer),
      loyerHorsCharges: Number(occupation.loyerHorsCharges),
      charges: Number(occupation.charges),
    },
    paiements: paiements.map(versPaiement),
    emisLe: maintenant().slice(0, 10),
  };
}

export interface DepotDocuments {
  readonly bailleur: (userId: string) => Promise<IdentiteBailleur | null>;
  readonly enregistrerBailleur: (
    userId: string,
    identite: IdentiteBailleur,
  ) => Promise<IdentiteBailleur>;
  readonly emettreDocument: (userId: string, demande: DemandeDocument) => Promise<Emission>;
  readonly document: (userId: string, id: string) => Promise<DocumentComplet>;
  readonly documentsComplets: (userId: string) => Promise<DocumentComplet[]>;
}

/** Identité du bailleur, quittances et reçus figés (ADR-G8, G9). */
export function depotDocuments(outils: Outils): DepotDocuments {
  const { lier, maintenant, genererId } = outils;

  const emettreDocument = async (userId: string, demande: DemandeDocument): Promise<Emission> => {
    const cle = cleDocument(demande);
    const [existant] = await lignes(lier, SQL.documentParCle, userId, cle);
    if (existant !== undefined) return { document: versDocumentComplet(existant), nouveau: false };

    const locationId = await locationDeLaDemande(lier, userId, demande);
    const entrees = await entreesDe(outils, userId, locationId);
    const resultat =
      demande.type === 'quittance'
        ? contenuQuittance(entrees, demande.periode)
        : contenuRecu(entrees, demande.paiementId);
    if (!resultat.ok) throw new ErreurGestion(resultat.refus);

    const { contenu } = resultat;
    const document = DocumentCompletSchema.parse({
      id: genererId(),
      type: contenu.type,
      numero: contenu.numero,
      locationId,
      periode: contenu.periode,
      ...(demande.type === 'recu' ? { paiementId: demande.paiementId } : {}),
      emisLe: maintenant(),
      contenu,
    });
    const ecrit = await lier(
      SQL.insererDocument,
      document.id,
      userId,
      cle,
      document.type,
      document.numero,
      document.locationId,
      document.periode,
      document.paiementId,
      JSON.stringify(contenu),
      document.emisLe,
    ).run();
    if (ecrit.meta.changes > 0) return { document, nouveau: true };
    // Émis entre-temps (deux onglets, double clic) : le premier écrit fait foi, on le relit.
    return { document: (await emettreDocument(userId, demande)).document, nouveau: false };
  };

  return {
    bailleur: async (userId) => versBailleur((await lignes(lier, SQL.bailleur, userId))[0]),

    enregistrerBailleur: async (userId, identite) => {
      await lier(
        SQL.enregistrerBailleur,
        userId,
        identite.nom,
        identite.adresse,
        maintenant(),
      ).run();
      return identite;
    },

    emettreDocument,

    document: async (userId, id) => {
      const [ligne] = await lignes(lier, SQL.documentParId, userId, id);
      if (ligne === undefined) throw new ErreurGestion('INTROUVABLE');
      return versDocumentComplet(ligne);
    },

    documentsComplets: async (userId) =>
      (await lignes(lier, SQL.documentsComplets, userId)).map(versDocumentComplet),
  };
}
