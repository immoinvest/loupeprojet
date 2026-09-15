import {
  cleDocument,
  contenuQuittance,
  contenuRecu,
  DocumentCompletSchema,
  locatairesDuMois,
  type DemandeDocument,
  type DocumentComplet,
  type EntreesDocument,
  type IdentiteBailleur,
} from '@loupe/gestion';

import { ErreurGestion, type Emission } from './depot';
import { estTableEnvoisAbsente } from './envois/depot';
import { mouvementsSiDisponibles } from './fin-bail/lecture';
import { lignes, lireChangements } from './lecture';
import { versBailleur, versDocumentComplet, versPaiement, type Lier } from './lignes';

/** Horloge, identifiants et requêtes du dépôt, partagés avec `depotD1`. */
export interface Outils {
  readonly lier: Lier;
  readonly maintenant: () => string;
  readonly genererId: () => string;
}

const SQL = {
  bailleur: 'select nom, adresse from gestion_bailleur where userId = ?',
  // L'identité propre au bien (SCI…), migration 0009 ; sans elle, celle du compte (ADR-G46).
  bailleurDuBien: 'select nom, adresse from gestion_bien_bailleur where userId = ? and bienId = ?',
  enregistrerBailleur:
    'insert into gestion_bailleur (userId, nom, adresse, modifieLe) values (?, ?, ?, ?) on conflict (userId) do update set nom = excluded.nom, adresse = excluded.adresse, modifieLe = excluded.modifieLe',
  documentParCle: 'select * from gestion_document where userId = ? and cle = ?',
  documentParId: 'select * from gestion_document where userId = ? and id = ?',
  documentsComplets: 'select * from gestion_document where userId = ? order by emisLe, id',
  paiementDuCompte: 'select locationId, periode from gestion_paiement where userId = ? and id = ?',
  // Une seule lecture : la location du compte avec son bien et son locataire en titre (clés étrangères).
  occupation:
    'select l.id, l.bienId, l.libelle, l.debut, l.fin, l.jourLoyer, l.loyerHorsCharges, l.charges, l.apl, l.locataireId, b.nom as bienNom, b.adresse as bienAdresse, t.prenom, t.nom as locataireNom from gestion_location l join gestion_bien b on b.id = l.bienId join gestion_locataire t on t.id = l.locataireId where l.userId = ? and l.id = ?',
  colocataires:
    'select c.locataireId, t.prenom, t.nom from gestion_colocataire c join gestion_locataire t on t.id = c.locataireId where c.userId = ? and c.locationId = ? order by c.ordre',
  paiementsDeLaLocation: 'select * from gestion_paiement where userId = ? and locationId = ?',
  insererDocument:
    'insert into gestion_document (id, userId, cle, type, numero, locationId, periode, paiementId, contenu, emisLe) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) on conflict (userId, cle) do nothing',
} as const;

/** La location et le mois d'où part la demande : directs (quittance) ou ceux du paiement (reçu). */
async function termeDeLaDemande(
  lier: Lier,
  userId: string,
  demande: DemandeDocument,
): Promise<{ readonly locationId: string; readonly periode: string }> {
  if (demande.type === 'quittance') return demande;
  const [paiement] = await lignes(lier, SQL.paiementDuCompte, userId, demande.paiementId);
  if (paiement === undefined) throw new ErreurGestion('INTROUVABLE');
  return { locationId: String(paiement.locationId), periode: String(paiement.periode) };
}

interface Nom {
  readonly prenom: string;
  readonly nom: string;
}

async function entreesDe(
  outils: Outils,
  userId: string,
  locationId: string,
  periode: string,
): Promise<EntreesDocument> {
  const { lier, maintenant } = outils;
  const [occupation] = await lignes(lier, SQL.occupation, userId, locationId);
  if (occupation === undefined) throw new ErreurGestion('INTROUVABLE');
  const [bailleur, paiements, colocataires, changements, bailleurDuBien, mouvements] =
    await Promise.all([
      lignes(lier, SQL.bailleur, userId),
      lignes(lier, SQL.paiementsDeLaLocation, userId, locationId),
      lignes(lier, SQL.colocataires, userId, locationId),
      lireChangements(lier, userId, locationId),
      // Sans la migration 0009, les quittances restent émises avec l'identité du compte.
      lignes(lier, SQL.bailleurDuBien, userId, String(occupation.bienId)).catch(
        (erreur: unknown) => {
          if (estTableEnvoisAbsente(erreur)) return [];
          throw erreur;
        },
      ),
      // Sans la migration 0011 : aucun mouvement, tous les locataires du bail sont nommés (ADR-G38).
      mouvementsSiDisponibles(lier, userId, locationId),
    ]);
  const { fin, libelle } = occupation;
  const debut = String(occupation.debut);
  const noms = new Map<string, Nom>([
    [
      String(occupation.locataireId),
      { prenom: String(occupation.prenom), nom: String(occupation.locataireNom) },
    ],
    ...colocataires.map((c): [string, Nom] => [
      String(c.locataireId),
      { prenom: String(c.prenom), nom: String(c.nom) },
    ]),
  ]);
  const bail = {
    id: String(occupation.id),
    debut,
    ...(typeof fin === 'string' ? { fin } : {}),
    locataireId: String(occupation.locataireId),
    colocataireIds: colocataires.map((c) => String(c.locataireId)),
  };
  // Les documents d'un mois nomment les locataires présents ce mois-là (changement de colocataire).
  const presents = locatairesDuMois(bail, mouvements, periode)
    .map((id) => noms.get(id))
    .filter((nom) => nom !== undefined);
  return {
    bailleur: versBailleur(bailleurDuBien[0] ?? bailleur[0]),
    bien: { nom: String(occupation.bienNom), adresse: String(occupation.bienAdresse) },
    locataires: presents.length > 0 ? presents : [...noms.values()],
    location: {
      id: String(occupation.id),
      ...(typeof libelle === 'string' ? { libelle } : {}),
      debut,
      ...(typeof fin === 'string' ? { fin } : {}),
      jourLoyer: Number(occupation.jourLoyer),
      loyerHorsCharges: Number(occupation.loyerHorsCharges),
      charges: Number(occupation.charges),
      apl: Number(occupation.apl),
      changements,
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

    const { locationId, periode } = await termeDeLaDemande(lier, userId, demande);
    const entrees = await entreesDe(outils, userId, locationId, periode);
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
