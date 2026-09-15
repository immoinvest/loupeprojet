import type { D1Database } from '@cloudflare/workers-types';
import {
  BailleurBienSchema,
  EnvoiSchema,
  StatutAccordSchema,
  type BailleurBien,
  type Envoi,
} from '@loupe/gestion';

import { valeurSql, type Ligne, type Lier } from '../lignes';
import {
  ErreurEnvois,
  type AccordLigne,
  type BailleurDuBien,
  type DepotEnvois,
  type JetonValide,
  type LocataireContact,
} from './depot';

const SQL = {
  locataires:
    'select id, prenom, nom, email from gestion_locataire where userId = ? order by creeLe, id',
  locataire: 'select id, prenom, nom, email from gestion_locataire where userId = ? and id = ?',
  location: 'select id, locataireId from gestion_location where userId = ? and id = ?',
  colocataires:
    'select t.id, t.prenom, t.nom, t.email from gestion_colocataire c join gestion_locataire t on t.id = c.locataireId where c.userId = ? and c.locationId = ? order by c.ordre',
  accords:
    'select locataireId, statut, emailEmpreinte, le, invitationLe from gestion_accord where userId = ?',
  envois:
    'select id, documentId, locataireId, destinataire, statut, tentatives, dernierEssaiLe, envoyeLe from gestion_envoi where userId = ? order by dernierEssaiLe, id',
  envoisDuDocument:
    'select id, documentId, locataireId, destinataire, statut, tentatives, dernierEssaiLe, envoyeLe from gestion_envoi where userId = ? and documentId = ? order by dernierEssaiLe, id',
  contacts:
    'select locataireId, telephone from gestion_locataire_contact where userId = ? order by locataireId',
  bailleursBiens:
    'select bienId, type, nom, adresse from gestion_bien_bailleur where userId = ? order by bienId',
  // Le logement le plus récent du locataire, en titre ou en colocation.
  logement:
    'select l.bienId, l.libelle, b.nom, b.adresse from gestion_location l join gestion_bien b on b.id = l.bienId where l.userId = ? and (l.locataireId = ? or l.id in (select locationId from gestion_colocataire where userId = ? and locataireId = ?)) order by l.debut desc, l.id limit 1',
  bailleurBien: 'select nom from gestion_bien_bailleur where userId = ? and bienId = ?',
  bailleurCompte: 'select nom from gestion_bailleur where userId = ?',
  emailCompte: 'select email from "user" where id = ?',
  insererJeton:
    'insert into gestion_jeton (id, userId, locataireId, type, emailEmpreinte, expireLe, creeLe) values (?, ?, ?, ?, ?, ?, ?)',
  inviter:
    "insert into gestion_accord (locataireId, userId, statut, emailEmpreinte, le, invitationLe, modifieLe) values (?, ?, 'en_attente', ?, null, ?, ?) on conflict (locataireId) do update set statut = excluded.statut, emailEmpreinte = excluded.emailEmpreinte, le = null, invitationLe = excluded.invitationLe, modifieLe = excluded.modifieLe",
  accorder:
    'insert into gestion_accord (locataireId, userId, statut, emailEmpreinte, le, modifieLe) values (?, ?, ?, ?, ?, ?) on conflict (locataireId) do update set statut = excluded.statut, emailEmpreinte = excluded.emailEmpreinte, le = excluded.le, modifieLe = excluded.modifieLe',
  jeton:
    'select id, userId, locataireId, emailEmpreinte from gestion_jeton where id = ? and utiliseLe is null and expireLe > ?',
  consommer:
    'update gestion_jeton set utiliseLe = ? where id = ? and utiliseLe is null and expireLe > ?',
  bien: 'select id from gestion_bien where userId = ? and id = ?',
  contact:
    'insert into gestion_locataire_contact (locataireId, userId, telephone, modifieLe) values (?, ?, ?, ?) on conflict (locataireId) do update set telephone = excluded.telephone, modifieLe = excluded.modifieLe',
  retirerContact: 'delete from gestion_locataire_contact where userId = ? and locataireId = ?',
  bailleur:
    'insert into gestion_bien_bailleur (bienId, userId, type, nom, adresse, modifieLe) values (?, ?, ?, ?, ?, ?) on conflict (bienId) do update set type = excluded.type, nom = excluded.nom, adresse = excluded.adresse, modifieLe = excluded.modifieLe',
  retirerBailleur: 'delete from gestion_bien_bailleur where userId = ? and bienId = ?',
  // Une trace par (document, locataire) : un nouvel essai l'actualise et cumule les tentatives.
  envoi:
    'insert into gestion_envoi (id, userId, documentId, locataireId, destinataire, statut, tentatives, dernierEssaiLe, envoyeLe) values (?, ?, ?, ?, ?, ?, ?, ?, ?) on conflict (documentId, locataireId) do update set destinataire = excluded.destinataire, statut = excluded.statut, tentatives = gestion_envoi.tentatives + excluded.tentatives, dernierEssaiLe = excluded.dernierEssaiLe, envoyeLe = coalesce(excluded.envoyeLe, gestion_envoi.envoyeLe)',
} as const;

function texte(valeur: unknown): string | undefined {
  return typeof valeur === 'string' ? valeur : undefined;
}

function versLocataire(ligne: Ligne): LocataireContact {
  const email = texte(ligne.email);
  return {
    id: String(ligne.id),
    prenom: String(ligne.prenom),
    nom: String(ligne.nom),
    ...(email === undefined ? {} : { email }),
  };
}

function versAccord(ligne: Ligne): AccordLigne {
  const le = texte(ligne.le);
  const invitationLe = texte(ligne.invitationLe);
  return {
    locataireId: String(ligne.locataireId),
    statut: StatutAccordSchema.parse(ligne.statut),
    emailEmpreinte: String(ligne.emailEmpreinte),
    ...(le === undefined ? {} : { le }),
    ...(invitationLe === undefined ? {} : { invitationLe }),
  };
}

function versEnvoi(ligne: Ligne): Envoi {
  const envoyeLe = texte(ligne.envoyeLe);
  return EnvoiSchema.parse({
    id: ligne.id,
    documentId: ligne.documentId,
    locataireId: ligne.locataireId,
    destinataire: ligne.destinataire,
    statut: ligne.statut,
    tentatives: ligne.tentatives,
    dernierEssaiLe: ligne.dernierEssaiLe,
    ...(envoyeLe === undefined ? {} : { envoyeLe }),
  });
}

function versJeton(ligne: Ligne): JetonValide {
  return {
    id: String(ligne.id),
    userId: String(ligne.userId),
    locataireId: String(ligne.locataireId),
    emailEmpreinte: String(ligne.emailEmpreinte),
  };
}

export interface OptionsDepotEnvois {
  readonly genererId?: () => string;
}

/** Le dépôt de production : les tables de la migration 0009 dans la base D1 des comptes. */
export function depotEnvoisD1(base: D1Database, options: OptionsDepotEnvois = {}): DepotEnvois {
  const genererId = options.genererId ?? ((): string => crypto.randomUUID());
  const lier: Lier = (sql, ...valeurs) => base.prepare(sql).bind(...valeurs.map(valeurSql));
  const lire = async (sql: string, ...valeurs: string[]): Promise<Ligne[]> =>
    (await lier(sql, ...valeurs).all<Ligne>()).results;

  const jetonValide = async (id: string, maintenant: string): Promise<JetonValide | null> => {
    const [ligne] = await lire(SQL.jeton, id, maintenant);
    return ligne === undefined ? null : versJeton(ligne);
  };

  return {
    locataires: async (userId) => (await lire(SQL.locataires, userId)).map(versLocataire),

    locataire: async (userId, id) => {
      const [ligne] = await lire(SQL.locataire, userId, id);
      return ligne === undefined ? null : versLocataire(ligne);
    },

    locationEtLocataires: async (userId, locationId) => {
      const [location] = await lire(SQL.location, userId, locationId);
      if (location === undefined) return null;
      const locataireId = String(location.locataireId);
      const [titre, colocataires] = await Promise.all([
        lire(SQL.locataire, userId, locataireId),
        lire(SQL.colocataires, userId, locationId),
      ]);
      const locataires = [...titre, ...colocataires].map(versLocataire);
      return {
        location: {
          id: locationId,
          locataireId,
          colocataireIds: colocataires.map((c) => String(c.id)),
        },
        locataires,
      };
    },

    accords: async (userId) => (await lire(SQL.accords, userId)).map(versAccord),
    envois: async (userId) => (await lire(SQL.envois, userId)).map(versEnvoi),
    envoisDuDocument: async (userId, documentId) =>
      (await lire(SQL.envoisDuDocument, userId, documentId)).map(versEnvoi),

    contacts: async (userId) =>
      (await lire(SQL.contacts, userId)).map((l) => ({
        locataireId: String(l.locataireId),
        telephone: String(l.telephone),
      })),

    bailleursBiens: async (userId) =>
      (await lire(SQL.bailleursBiens, userId)).map((l): BailleurDuBien => ({
        bienId: String(l.bienId),
        ...BailleurBienSchema.parse({ type: l.type, nom: l.nom, adresse: l.adresse }),
      })),

    contexteInvitation: async (userId, locataireId) => {
      const [logement] = await lire(SQL.logement, userId, locataireId, userId, locataireId);
      const [duBien, duCompte] = await Promise.all([
        logement === undefined ? [] : lire(SQL.bailleurBien, userId, String(logement.bienId)),
        lire(SQL.bailleurCompte, userId),
      ]);
      const libelle = texte(logement?.libelle);
      const nom = logement === undefined ? '' : String(logement.nom);
      const bailleur = texte((duBien[0] ?? duCompte[0])?.nom) ?? null;
      return {
        bailleur,
        logement:
          logement === undefined
            ? null
            : `${libelle === undefined ? nom : `${nom} · ${libelle}`}, ${String(logement.adresse)}`,
      };
    },

    emailCompte: async (userId) => texte((await lire(SQL.emailCompte, userId))[0]?.email) ?? null,

    enregistrerInvitation: async (userId, i) => {
      await base.batch([
        lier(
          SQL.insererJeton,
          i.jetonId,
          userId,
          i.locataireId,
          'accord',
          i.emailEmpreinte,
          i.expireLe,
          i.maintenant,
        ),
        lier(SQL.inviter, i.locataireId, userId, i.emailEmpreinte, i.maintenant, i.maintenant),
      ]);
    },

    enregistrerAccord: async (userId, locataireId, statut, emailEmpreinte, maintenant) => {
      await lier(
        SQL.accorder,
        locataireId,
        userId,
        statut,
        emailEmpreinte,
        maintenant,
        maintenant,
      ).run();
    },

    jetonValide,

    consommerJeton: async (id, maintenant) => {
      const jeton = await jetonValide(id, maintenant);
      if (jeton === null) return null;
      const ecrit = await lier(SQL.consommer, maintenant, id, maintenant).run();
      return ecrit.meta.changes > 0 ? jeton : null;
    },

    enregistrerContact: async (userId, locataireId, telephone, maintenant) => {
      if ((await lire(SQL.locataire, userId, locataireId)).length === 0) {
        throw new ErreurEnvois('INTROUVABLE');
      }
      await (
        telephone === null
          ? lier(SQL.retirerContact, userId, locataireId)
          : lier(SQL.contact, locataireId, userId, telephone, maintenant)
      ).run();
    },

    enregistrerBailleurBien: async (userId, bienId, bailleur: BailleurBien | null, maintenant) => {
      if ((await lire(SQL.bien, userId, bienId)).length === 0)
        throw new ErreurEnvois('INTROUVABLE');
      await (
        bailleur === null
          ? lier(SQL.retirerBailleur, userId, bienId)
          : lier(
              SQL.bailleur,
              bienId,
              userId,
              bailleur.type,
              bailleur.nom,
              bailleur.adresse,
              maintenant,
            )
      ).run();
    },

    enregistrerEnvoi: async (userId, r) => {
      await lier(
        SQL.envoi,
        genererId(),
        userId,
        r.documentId,
        r.locataireId,
        r.destinataire,
        r.statut,
        r.tentatives,
        r.maintenant,
        r.statut === 'envoye' ? r.maintenant : undefined,
      ).run();
    },
  };
}
