import {
  changementRefuse,
  chevauche,
  tropDeChangements,
  type Locataire,
  type LocationGeree,
  type ModificationLocation,
  type NouveauLocataire,
} from '@loupe/gestion';

import { ErreurGestion } from './depot';
import type { OutilsBaux } from './depot-baux';
import { lignes, lireLocation } from './lecture';
import { versLocataire, versPeriode } from './lignes';

const SQL = {
  // Insertion conditionnelle (ADR-G15) : aucun paiement pour ce mois ni après, sinon rien n'est écrit.
  // Un changement du même mois remplace le précédent.
  changement:
    'insert into gestion_changement (locationId, userId, aPartirDe, loyerHorsCharges, charges, apl, modifieLe) select ?, ?, ?, ?, ?, ?, ? where not exists (select 1 from gestion_paiement where userId = ? and locationId = ? and periode >= ?) on conflict (locationId, aPartirDe) do update set loyerHorsCharges = excluded.loyerHorsCharges, charges = excluded.charges, apl = excluded.apl, modifieLe = excluded.modifieLe',
  location:
    'update gestion_location set jourLoyer = ?, depot = ?, libelle = ? where userId = ? and id = ?',
  autresLocationsDuBien:
    'select debut, fin, libelle from gestion_location where userId = ? and bienId = ? and id <> ?',
  bien: 'select id from gestion_bien where userId = ? and id = ?',
  locataire: 'select * from gestion_locataire where userId = ? and id = ?',
  modifierLocataire:
    'update gestion_locataire set prenom = ?, nom = ?, email = ? where userId = ? and id = ?',
  // Les clés étrangères suppriment en cascade locations, changements, colocataires, paiements et documents.
  supprimerBien: 'delete from gestion_bien where userId = ? and id = ?',
  // Un locataire n'existe que par ses locations : sans aucune, il part avec le bien (minimisation, G1-9).
  supprimerLocatairesSansLocation:
    'delete from gestion_locataire where userId = ? and id not in (select locataireId from gestion_location where userId = ?) and id not in (select locataireId from gestion_colocataire where userId = ?)',
} as const;

export interface DepotModifications {
  readonly modifierLocation: (
    userId: string,
    locationId: string,
    modification: ModificationLocation,
  ) => Promise<LocationGeree>;
  readonly supprimerBien: (userId: string, bienId: string) => Promise<void>;
  readonly modifierLocataire: (
    userId: string,
    locataireId: string,
    locataire: NouveauLocataire,
  ) => Promise<Locataire>;
}

/** « Modifier » une location (montants à partir d'un mois, jour, dépôt, libellé) et supprimer un bien. */
export function depotModifications(outils: OutilsBaux): DepotModifications {
  const { lier, maintenant, ensemble } = outils;

  /** Un libellé ne doit pas faire chevaucher une autre location du bien au même libellé (ADR-G13). */
  const verifierLibelle = async (
    userId: string,
    location: LocationGeree,
    libelle: string | null,
  ): Promise<void> => {
    const autres = await lignes(
      lier,
      SQL.autresLocationsDuBien,
      userId,
      location.bienId,
      location.id,
    );
    const nouvelle = {
      debut: location.debut,
      ...(location.fin === undefined ? {} : { fin: location.fin }),
      ...(libelle === null ? {} : { libelle }),
    };
    if (chevauche(autres.map(versPeriode), nouvelle)) throw new ErreurGestion('BIEN_OCCUPE');
  };

  return {
    modifierLocation: async (userId, locationId, modification) => {
      const location = await lireLocation(lier, userId, locationId);
      const { montants, jourLoyer, depot, libelle } = modification;
      if (montants !== undefined) {
        // Les bornes seulement : le mois déjà payé se décide à l'écriture, sans course possible.
        const hors = changementRefuse(location, [], montants.aPartirDe, maintenant().slice(0, 10));
        if (hors !== null) throw new ErreurGestion(hors);
        // Borne contre l'abus du quota D1 ; remplacer le changement d'un mois reste permis.
        if (tropDeChangements(location, montants.aPartirDe)) {
          throw new ErreurGestion('LIMITE_ATTEINTE');
        }
      }
      if (libelle !== undefined) await verifierLibelle(userId, location, libelle);

      if (montants !== undefined) {
        const ecrit = await lier(
          SQL.changement,
          locationId,
          userId,
          montants.aPartirDe,
          montants.loyerHorsCharges,
          montants.charges,
          montants.apl,
          maintenant(),
          userId,
          locationId,
          montants.aPartirDe,
        ).run();
        if (ecrit.meta.changes === 0) throw new ErreurGestion('PERIODE_PAYEE');
      }
      if (jourLoyer !== undefined || depot !== undefined || libelle !== undefined) {
        await lier(
          SQL.location,
          jourLoyer ?? location.jourLoyer,
          depot ?? location.depot,
          libelle === undefined ? location.libelle : (libelle ?? undefined),
          userId,
          locationId,
        ).run();
      }
      return lireLocation(lier, userId, locationId);
    },

    supprimerBien: async (userId, bienId) => {
      const [bien] = await lignes(lier, SQL.bien, userId, bienId);
      if (bien === undefined) throw new ErreurGestion('INTROUVABLE');
      // Un lot D1 (ADR-G17) : tout ou rien.
      await ensemble([
        lier(SQL.supprimerBien, userId, bienId),
        lier(SQL.supprimerLocatairesSansLocation, userId, userId, userId),
      ]);
    },

    modifierLocataire: async (userId, locataireId, locataire) => {
      const [ligne] = await lignes(lier, SQL.locataire, userId, locataireId);
      if (ligne === undefined) throw new ErreurGestion('INTROUVABLE');
      const { prenom, nom, email } = locataire;
      await lier(SQL.modifierLocataire, prenom, nom, email, userId, locataireId).run();
      // Les quittances et reçus déjà émis gardent l'ancien nom : leur contenu est figé (ADR-G8).
      return versLocataire({ ...ligne, prenom, nom, email: email ?? null });
    },
  };
}
