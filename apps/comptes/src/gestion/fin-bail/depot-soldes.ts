import type { D1PreparedStatement } from '@cloudflare/workers-types';
import {
  anneesARegulariser,
  cleRegularisation,
  cleRestitution,
  contenuRegularisation,
  contenuRestitution,
  dateLimiteRestitution,
  DecompteCompletSchema,
  echeanceRegularisation,
  periodeDe,
  refusRestitution,
  RegularisationSchema,
  regularisationDeLAnnee,
  RestitutionSchema,
  type ContenuDecompte,
  type DecompteComplet,
} from '@loupe/gestion';

import { versDepense } from '../argent/lignes';
import { lignes, lireLocation } from '../lecture';
import { versPeriode, type Lier } from '../lignes';
import { ErreurFinBail, type DepotFinBail } from './depot';
import { identitesDecompte, premiere } from './lecture';
import { versModeCharges, versRegularisation, versRestitution } from './lignes';

/** Horloge, identifiants, requêtes et lot atomique, fournis par `depotFinBailD1`. */
export interface OutilsSoldes {
  readonly lier: Lier;
  readonly maintenant: () => string;
  readonly genererId: () => string;
  readonly ensemble: (
    instructions: D1PreparedStatement[],
  ) => Promise<readonly { readonly meta: { readonly changes: number } }[]>;
}

const INSERER_DECOMPTE =
  'insert into gestion_decompte (id, userId, locationId, cle, type, numero, contenu, emisLe) select ?, ?, ?, ?, ?, ?, ?, ?';

const SQL = {
  // Le décompte n'est écrit que si rien n'est déjà enregistré : le lot reste idempotent (ADR-G39).
  decompteRestitution: `${INSERER_DECOMPTE} where not exists (select 1 from gestion_depot_restitution where userId = ? and locationId = ?) on conflict (userId, cle) do nothing`,
  decompteRegularisation: `${INSERER_DECOMPTE} where not exists (select 1 from gestion_regularisation where userId = ? and locationId = ? and annee = ?) on conflict (userId, cle) do nothing`,
  insererRestitution:
    'insert into gestion_depot_restitution (locationId, userId, clesLe, conforme, retenues, depot, aRendre, dateLimite, decompteId, rendueLe, modifieLe) values (?, ?, ?, ?, ?, ?, ?, ?, ?, null, ?) on conflict (locationId) do nothing',
  insererRegularisation:
    'insert into gestion_regularisation (id, userId, locationId, annee, solde, aPartirDe, decompteId, regleeLe, creeLe) values (?, ?, ?, ?, ?, ?, ?, null, ?) on conflict (locationId, annee) do nothing',
  restitution: 'select * from gestion_depot_restitution where userId = ? and locationId = ?',
  rendre:
    'update gestion_depot_restitution set rendueLe = ?, modifieLe = ? where userId = ? and locationId = ?',
  supprimerDecompte: 'delete from gestion_decompte where userId = ? and id = ?',
  supprimerRestitution: 'delete from gestion_depot_restitution where userId = ? and locationId = ?',
  mode: 'select * from gestion_location_charges where userId = ? and locationId = ?',
  locationsDuBien:
    'select debut, fin, libelle from gestion_location where userId = ? and bienId = ?',
  depenses: 'select * from gestion_depense where userId = ? and bienId = ?',
  regularisation: 'select * from gestion_regularisation where userId = ? and id = ?',
  regler: 'update gestion_regularisation set regleeLe = ? where userId = ? and id = ?',
} as const;

export type DepotSoldes = Pick<
  DepotFinBail,
  'restituer' | 'rendreDepot' | 'annulerRestitution' | 'regulariser' | 'reglerRegularisation'
>;

/** Restitution du dépôt et régularisation des charges : un lot par validation, décompte figé compris. */
export function depotSoldes(outils: OutilsSoldes): DepotSoldes {
  const { lier, maintenant, genererId, ensemble } = outils;
  const aujourdhui = (): string => maintenant().slice(0, 10);

  const decompteDe = (
    locationId: string,
    contenu: ContenuDecompte,
    emisLe: string,
  ): DecompteComplet =>
    DecompteCompletSchema.parse({
      id: genererId(),
      type: contenu.type,
      locationId,
      numero: contenu.numero,
      emisLe,
      contenu,
    });

  const champsDecompte = (userId: string, decompte: DecompteComplet, cle: string): string[] => [
    decompte.id,
    userId,
    decompte.locationId,
    cle,
    decompte.type,
    decompte.numero,
    JSON.stringify(decompte.contenu),
    decompte.emisLe,
  ];

  return {
    restituer: async (userId, locationId, saisie) => {
      const location = await lireLocation(lier, userId, locationId);
      const jour = aujourdhui();
      const refus = refusRestitution(location, saisie, jour);
      if (refus !== null) throw new ErreurFinBail(refus);
      const identites = await identitesDecompte(
        lier,
        userId,
        location,
        periodeDe(saisie.clesLe),
        jour,
      );
      const horodatage = maintenant();
      const dateLimite = dateLimiteRestitution(saisie.clesLe, saisie.conforme);
      const contenu = contenuRestitution(identites, location, { ...saisie, dateLimite });
      const decompte = decompteDe(locationId, contenu, horodatage);
      const restitution = RestitutionSchema.parse({
        locationId,
        ...saisie,
        depot: location.depot,
        aRendre: contenu.aRendre,
        dateLimite,
        decompteId: decompte.id,
        rendueLe: null,
        modifieLe: horodatage,
      });
      const ecrits = (
        await ensemble([
          lier(
            SQL.decompteRestitution,
            ...champsDecompte(userId, decompte, cleRestitution(locationId)),
            userId,
            locationId,
          ),
          lier(
            SQL.insererRestitution,
            locationId,
            userId,
            saisie.clesLe,
            saisie.conforme,
            JSON.stringify(saisie.retenues),
            location.depot,
            restitution.aRendre,
            dateLimite,
            decompte.id,
            horodatage,
          ),
        ])
      ).map((r) => r.meta.changes);
      if (ecrits[0] === 0) throw new ErreurFinBail('DEJA_ENREGISTRE');
      return { restitution, decompte };
    },

    rendreDepot: async (userId, locationId, rendueLe) => {
      const restitution = versRestitution(
        premiere(await lignes(lier, SQL.restitution, userId, locationId)),
      );
      if (rendueLe > aujourdhui() || rendueLe < restitution.clesLe) {
        throw new ErreurFinBail('DATE_INVALIDE');
      }
      const modifieLe = maintenant();
      await lier(SQL.rendre, rendueLe, modifieLe, userId, locationId).run();
      return RestitutionSchema.parse({ ...restitution, rendueLe, modifieLe });
    },

    annulerRestitution: async (userId, locationId) => {
      const restitution = versRestitution(
        premiere(await lignes(lier, SQL.restitution, userId, locationId)),
      );
      if (restitution.rendueLe !== null) throw new ErreurFinBail('DEPOT_RENDU');
      await ensemble([
        lier(SQL.supprimerDecompte, userId, restitution.decompteId),
        lier(SQL.supprimerRestitution, userId, locationId),
      ]);
    },

    regulariser: async (userId, locationId, annee) => {
      const location = await lireLocation(lier, userId, locationId);
      const jour = aujourdhui();
      if (!anneesARegulariser(location, jour).includes(annee)) {
        throw new ErreurFinBail('REGULARISATION_IMPOSSIBLE');
      }
      const [modes, autres, depenses] = await Promise.all([
        lignes(lier, SQL.mode, userId, locationId),
        lignes(lier, SQL.locationsDuBien, userId, location.bienId),
        lignes(lier, SQL.depenses, userId, location.bienId),
      ]);
      const proposition = regularisationDeLAnnee({
        location,
        locationsDuBien: autres.map(versPeriode),
        depenses: depenses.map(versDepense),
        annee,
        mode: modes.map((m) => versModeCharges(m).mode)[0] ?? 'provision',
      });
      if (proposition.statut !== 'proposee') throw new ErreurFinBail('REGULARISATION_IMPOSSIBLE');
      const identites = await identitesDecompte(
        lier,
        userId,
        location,
        periodeDe(proposition.fin),
        jour,
      );
      const aPartirDe = echeanceRegularisation(jour);
      const horodatage = maintenant();
      const contenu = contenuRegularisation(identites, locationId, proposition, aPartirDe);
      const decompte = decompteDe(locationId, contenu, horodatage);
      const regularisation = RegularisationSchema.parse({
        id: genererId(),
        locationId,
        annee,
        solde: proposition.solde,
        aPartirDe,
        decompteId: decompte.id,
        regleeLe: null,
        creeLe: horodatage,
      });
      const ecrits = (
        await ensemble([
          lier(
            SQL.decompteRegularisation,
            ...champsDecompte(userId, decompte, cleRegularisation(locationId, annee)),
            userId,
            locationId,
            annee,
          ),
          lier(
            SQL.insererRegularisation,
            regularisation.id,
            userId,
            locationId,
            annee,
            regularisation.solde,
            aPartirDe,
            decompte.id,
            horodatage,
          ),
        ])
      ).map((r) => r.meta.changes);
      if (ecrits[0] === 0) throw new ErreurFinBail('DEJA_ENREGISTRE');
      return { regularisation, decompte };
    },

    reglerRegularisation: async (userId, id, regleeLe) => {
      const regularisation = versRegularisation(
        premiere(await lignes(lier, SQL.regularisation, userId, id)),
      );
      if (regleeLe > aujourdhui()) throw new ErreurFinBail('DATE_INVALIDE');
      await lier(SQL.regler, regleeLe, userId, id).run();
      return RegularisationSchema.parse({ ...regularisation, regleeLe });
    },
  };
}
