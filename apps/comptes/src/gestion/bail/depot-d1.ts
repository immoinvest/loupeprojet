import type { D1Database } from '@cloudflare/workers-types';
import {
  changementRefuse,
  classeDpeDuProjet,
  cleLettre,
  contenuLettreRevision,
  LegalBienSchema,
  LettreRevisionCompleteSchema,
  montantsDuMois,
  propositionRevision,
  revisionParDefaut,
  tropDeChangements,
  type LocationGeree,
  type RevisionLocation,
} from '@loupe/gestion';

import { lignes, lireLocation, lirePaiements } from '../lecture';
import { valeurSql, versBailleur, type Ligne, type Lier } from '../lignes';
import { ErreurBail, type DepotBail } from './depot';
import { lireInstantane, versLegal, versLettre, versLettreComplete, versRevision } from './lignes';

export interface OptionsDepotBail {
  /** Horodatage ISO des écritures et date du jour de la proposition ; l'horloge réelle par défaut. */
  readonly maintenant?: () => string;
  readonly genererId?: () => string;
}

// Garde commune du lot « Appliquer » (ADR-G26) : aucun paiement pour le mois d'effet ni après.
const SANS_PAIEMENT =
  'where not exists (select 1 from gestion_paiement where userId = ? and locationId = ? and periode >= ?)';

const SQL = {
  legaux: 'select * from gestion_bien_legal where userId = ? order by bienId',
  revisions: 'select * from gestion_location_revision where userId = ? order by locationId',
  lettres:
    'select id, locationId, numero, anniversaire, emisLe from gestion_bail_lettre where userId = ? order by emisLe, id',
  bien: 'select id from gestion_bien where userId = ? and id = ?',
  legal: 'select * from gestion_bien_legal where userId = ? and bienId = ?',
  revision: 'select * from gestion_location_revision where userId = ? and locationId = ?',
  enregistrerLegal:
    'insert into gestion_bien_legal (bienId, userId, dpeClasse, dpeDate, zoneTendue, modifieLe) values (?, ?, ?, ?, ?, ?) on conflict (bienId) do update set dpeClasse = excluded.dpeClasse, dpeDate = excluded.dpeDate, zoneTendue = excluded.zoneTendue, modifieLe = excluded.modifieLe',
  enregistrerRevision:
    'insert into gestion_location_revision (locationId, userId, active, anniversaire, trimestre, formeBail, derniereRevision, modifieLe) values (?, ?, ?, ?, ?, ?, null, ?) on conflict (locationId) do update set active = excluded.active, anniversaire = excluded.anniversaire, trimestre = excluded.trimestre, formeBail = excluded.formeBail, modifieLe = excluded.modifieLe',
  lettreParCle: 'select * from gestion_bail_lettre where userId = ? and cle = ?',
  lettreParId: 'select * from gestion_bail_lettre where userId = ? and id = ?',
  // Le bien et le locataire en titre de la location (clés étrangères : toujours présents).
  occupation:
    'select b.nom as bienNom, b.adresse as bienAdresse, b.projet, t.prenom, t.nom as locataireNom from gestion_location l join gestion_bien b on b.id = l.bienId join gestion_locataire t on t.id = l.locataireId where l.userId = ? and l.id = ?',
  colocataires:
    'select t.prenom, t.nom from gestion_colocataire c join gestion_locataire t on t.id = c.locataireId where c.userId = ? and c.locationId = ? order by c.ordre',
  bailleur: 'select nom, adresse from gestion_bailleur where userId = ?',
  changement: `insert into gestion_changement (locationId, userId, aPartirDe, loyerHorsCharges, charges, apl, modifieLe) select ?, ?, ?, ?, ?, ?, ? ${SANS_PAIEMENT} on conflict (locationId, aPartirDe) do update set loyerHorsCharges = excluded.loyerHorsCharges, charges = excluded.charges, apl = excluded.apl, modifieLe = excluded.modifieLe`,
  lettre: `insert into gestion_bail_lettre (id, userId, locationId, cle, numero, anniversaire, contenu, emisLe) select ?, ?, ?, ?, ?, ?, ?, ? ${SANS_PAIEMENT} on conflict (userId, cle) do nothing`,
  revisionAppliquee: `insert into gestion_location_revision (locationId, userId, active, anniversaire, trimestre, formeBail, derniereRevision, modifieLe) select ?, ?, ?, ?, ?, ?, ?, ? ${SANS_PAIEMENT} on conflict (locationId) do update set active = excluded.active, anniversaire = excluded.anniversaire, trimestre = excluded.trimestre, formeBail = excluded.formeBail, derniereRevision = excluded.derniereRevision, modifieLe = excluded.modifieLe`,
} as const;

/** La première ligne, ou INTROUVABLE. */
function premiere(resultat: readonly Ligne[]): Ligne {
  const [ligne] = resultat;
  if (ligne === undefined) throw new ErreurBail('INTROUVABLE');
  return ligne;
}

/** Le dépôt de production : tables de la migration 0008 de la base D1 des comptes. */
export function depotBailD1(base: D1Database, options: OptionsDepotBail = {}): DepotBail {
  const maintenant = options.maintenant ?? ((): string => new Date().toISOString());
  const genererId = options.genererId ?? ((): string => crypto.randomUUID());
  const lier: Lier = (sql, ...valeurs) => base.prepare(sql).bind(...valeurs.map(valeurSql));

  /** Les réglages enregistrés, sinon ceux par défaut (ADR-G28). */
  const revisionDe = async (
    userId: string,
    location: LocationGeree,
    aujourdhui: string,
  ): Promise<RevisionLocation> => {
    const [ligne] = await lignes(lier, SQL.revision, userId, location.id);
    if (ligne !== undefined) return versRevision(ligne);
    return {
      locationId: location.id,
      ...revisionParDefaut(location, aujourdhui),
      derniereRevision: null,
      modifieLe: maintenant(),
    };
  };

  const lettreParCle = (
    userId: string,
    locationId: string,
    anniversaire: string,
  ): Promise<Ligne[]> =>
    lignes(lier, SQL.lettreParCle, userId, cleLettre(locationId, anniversaire));

  return {
    etat: async (userId) => {
      const [legaux, revisions, lettres] = await Promise.all([
        lignes(lier, SQL.legaux, userId),
        lignes(lier, SQL.revisions, userId),
        lignes(lier, SQL.lettres, userId),
      ]);
      return {
        biens: legaux.map(versLegal),
        revisions: revisions.map(versRevision),
        lettres: lettres.map(versLettre),
      };
    },

    enregistrerBien: async (userId, bienId, saisie) => {
      premiere(await lignes(lier, SQL.bien, userId, bienId));
      const { dpeClasse, dpeDate, zoneTendue } = saisie;
      const modifieLe = maintenant();
      await lier(
        SQL.enregistrerLegal,
        bienId,
        userId,
        dpeClasse ?? undefined,
        dpeDate ?? undefined,
        zoneTendue ?? undefined,
        modifieLe,
      ).run();
      return LegalBienSchema.parse({ bienId, dpeClasse, dpeDate, zoneTendue, modifieLe });
    },

    enregistrerRevision: async (userId, locationId, saisie) => {
      await lireLocation(lier, userId, locationId);
      const [avant] = await lignes(lier, SQL.revision, userId, locationId);
      const { active, anniversaire, trimestre, formeBail } = saisie;
      const modifieLe = maintenant();
      await lier(
        SQL.enregistrerRevision,
        locationId,
        userId,
        active,
        anniversaire,
        trimestre,
        formeBail,
        modifieLe,
      ).run();
      // La dernière révision appliquée reste : changer les réglages ne l'efface pas.
      const derniereRevision = avant === undefined ? null : versRevision(avant).derniereRevision;
      return { locationId, ...saisie, derniereRevision, modifieLe };
    },

    appliquerRevision: async (userId, locationId, anniversaire) => {
      const location = await lireLocation(lier, userId, locationId);
      const aujourdhui = maintenant().slice(0, 10);
      const [deja] = await lettreParCle(userId, locationId, anniversaire);
      if (deja !== undefined) {
        const revision = await revisionDe(userId, location, aujourdhui);
        return {
          resultat: { lettre: versLettreComplete(deja), revision, location },
          nouvelle: false,
        };
      }

      const [occupations, paiements, colocataires, bailleurs, [legal], revision] =
        await Promise.all([
          lignes(lier, SQL.occupation, userId, locationId),
          lirePaiements(lier, userId, locationId),
          lignes(lier, SQL.colocataires, userId, locationId),
          lignes(lier, SQL.bailleur, userId),
          lignes(lier, SQL.legal, userId, location.bienId),
          revisionDe(userId, location, aujourdhui),
        ]);
      const occupation = premiere(occupations);
      const classeDpe =
        legal === undefined
          ? classeDpeDuProjet(lireInstantane(occupation.projet))
          : versLegal(legal).dpeClasse;
      // Recalculée ici avec la date du serveur : le navigateur n'a envoyé que l'anniversaire.
      const proposition = propositionRevision({
        location,
        paiements,
        revision,
        classeDpe,
        aujourdhui,
      });
      if (proposition.statut !== 'proposee' || proposition.anniversaire !== anniversaire) {
        throw new ErreurBail('REVISION_IMPOSSIBLE');
      }
      const bailleur = versBailleur(bailleurs[0]);
      if (bailleur === null) throw new ErreurBail('BAILLEUR_MANQUANT');
      const { aPartirDe } = proposition;
      const refus = changementRefuse(location, [], aPartirDe, aujourdhui);
      if (refus !== null) throw new ErreurBail(refus);
      if (tropDeChangements(location, aPartirDe)) throw new ErreurBail('LIMITE_ATTEINTE');

      const horodatage = maintenant();
      const contenu = contenuLettreRevision({
        locationId,
        bailleur,
        locataires: [
          { prenom: String(occupation.prenom), nom: String(occupation.locataireNom) },
          ...colocataires.map((c) => ({ prenom: String(c.prenom), nom: String(c.nom) })),
        ],
        logement: {
          nom: String(occupation.bienNom),
          adresse: String(occupation.bienAdresse),
          ...(location.libelle === undefined ? {} : { libelle: location.libelle }),
        },
        proposition,
        emisLe: aujourdhui,
      });
      const lettre = LettreRevisionCompleteSchema.parse({
        id: genererId(),
        locationId,
        numero: contenu.numero,
        anniversaire,
        emisLe: horodatage,
        contenu,
      });
      const appliquee: RevisionLocation = {
        ...revision,
        active: true,
        trimestre: proposition.indiceNouveau.trimestre,
        derniereRevision: anniversaire,
        modifieLe: horodatage,
      };
      const garde = [userId, locationId, aPartirDe] as const;
      const ecrits = (
        await base.batch([
          lier(
            SQL.changement,
            locationId,
            userId,
            aPartirDe,
            proposition.nouveauLoyer,
            proposition.charges,
            // L'aide au logement du mois d'effet ne change pas avec la révision (ADR-G16).
            montantsDuMois(location, aPartirDe).apl,
            horodatage,
            ...garde,
          ),
          lier(
            SQL.lettre,
            lettre.id,
            userId,
            locationId,
            cleLettre(locationId, anniversaire),
            lettre.numero,
            anniversaire,
            JSON.stringify(contenu),
            horodatage,
            ...garde,
          ),
          lier(
            SQL.revisionAppliquee,
            locationId,
            userId,
            true,
            appliquee.anniversaire,
            appliquee.trimestre,
            appliquee.formeBail,
            anniversaire,
            horodatage,
            ...garde,
          ),
        ])
      ).map((r) => r.meta.changes);
      if (ecrits[0] === 0) throw new ErreurBail('PERIODE_PAYEE');
      const relue = await lireLocation(lier, userId, locationId);
      if (ecrits[1] === 0) {
        // Un autre onglet l'a émise entre-temps : sa lettre fait foi.
        const premiereLettre = versLettreComplete(
          premiere(await lettreParCle(userId, locationId, anniversaire)),
        );
        return {
          resultat: { lettre: premiereLettre, revision: appliquee, location: relue },
          nouvelle: false,
        };
      }
      return { resultat: { lettre, revision: appliquee, location: relue }, nouvelle: true };
    },

    lettre: async (userId, id) =>
      versLettreComplete(premiere(await lignes(lier, SQL.lettreParId, userId, id))),
  };
}
