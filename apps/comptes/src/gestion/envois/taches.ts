import {
  accordValide,
  destinatairesQuittance,
  expirationJeton,
  invitationPossible,
  masquerEmail,
  REGLES_ENVOIS,
  renvoiPossible,
  statutAccord,
  type AccordLocataire,
  type Destinataire,
  type DocumentComplet,
  type Envoi,
  type EtatEnvois,
  type ModeEnvoi,
  type StatutAccordEffectif,
} from '@loupe/gestion';

import { ErreurCourriel, type Envoyeur, type Message } from '../../courriel';
import { messageInvitation, messageQuittance, nomFichierQuittance } from '../../courriels/gabarits';
import { pdfDocument } from '../../courriels/pdf-quittance';
import type { Dependances } from '../../dependances';
import { nouveauJeton } from '../../partage/jetons';
import { ErreurGestion } from '../depot';
import { ErreurEnvois, type AccordLigne, type LocataireContact } from './depot';
import type { SignatureJetons } from './jetons';
import { empreinteEmail } from './jetons';

/** Qui agit, et depuis quelle origine (celle du lien d'accord : jamais une adresse écrite en dur). */
export interface ContexteEnvois {
  readonly deps: Dependances;
  readonly userId: string;
  readonly origine: string;
}

function horodatage(deps: Pick<Dependances, 'maintenant'>): string {
  return new Date(deps.maintenant()).toISOString();
}

export function modeEnvoi(deps: Pick<Dependances, 'courriel'>): ModeEnvoi {
  if (deps.courriel === null) return 'inactif';
  return deps.courriel.mode === 'journal' ? 'journal' : 'reel';
}

interface Statut {
  readonly statut: StatutAccordEffectif;
  readonly accord: AccordLigne | undefined;
}

async function statutDe(
  locataire: LocataireContact,
  accords: readonly AccordLigne[],
): Promise<Statut> {
  const accord = accords.find((a) => a.locataireId === locataire.id);
  const empreinte =
    locataire.email === undefined ? undefined : await empreinteEmail(locataire.email);
  return { statut: statutAccord(accord, empreinte), accord };
}

function versAccordLocataire(locataireId: string, { statut, accord }: Statut): AccordLocataire {
  const connu = statut !== 'sans_email' && statut !== 'non_demande';
  return {
    locataireId,
    statut,
    ...(connu && accord?.le !== undefined ? { le: accord.le } : {}),
    ...(connu && accord?.invitationLe !== undefined ? { invitationLe: accord.invitationLe } : {}),
  };
}

/** `GET /api/gestion/envois` : tout ce que les écrans de Gérer montrent de ce module. */
export async function etatEnvois({ deps, userId }: ContexteEnvois): Promise<EtatEnvois> {
  const [locataires, accords, envois, contacts, bailleursBiens] = await Promise.all([
    deps.envois.locataires(userId),
    deps.envois.accords(userId),
    deps.envois.envois(userId),
    deps.envois.contacts(userId),
    deps.envois.bailleursBiens(userId),
  ]);
  const statuts = await Promise.all(locataires.map((l) => statutDe(l, accords)));
  return {
    mode: modeEnvoi(deps),
    invitations: deps.courriel !== null && deps.jetons !== null,
    accords: locataires.map((l, rang) => versAccordLocataire(l.id, statuts[rang] ?? statutVide)),
    envois,
    contacts,
    bailleursBiens,
  };
}

const statutVide: Statut = { statut: 'sans_email', accord: undefined };

/** Un premier essai et une nouvelle tentative ; l'échec est journalisé sans adresse ni contenu. */
async function envoyerAvecTentative(
  deps: Pick<Dependances, 'journal'>,
  courriel: Envoyeur,
  message: Message,
  type: 'invitation' | 'quittance',
): Promise<{ readonly ok: boolean; readonly tentatives: number }> {
  let statut = 0;
  for (let tentative = 1; tentative <= REGLES_ENVOIS.tentatives; tentative += 1) {
    try {
      await courriel.envoyer(message);
      return { ok: true, tentatives: tentative };
    } catch (erreur) {
      statut = erreur instanceof ErreurCourriel ? erreur.statut : 0;
    }
  }
  deps.journal.erreur('envoi.echec', { type, statut });
  return { ok: false, tentatives: REGLES_ENVOIS.tentatives };
}

async function envoyerInvitation(
  { deps, userId, origine }: ContexteEnvois,
  locataire: LocataireContact & { readonly email: string },
  empreinte: string,
  courriel: Envoyeur,
  jetons: SignatureJetons,
): Promise<boolean> {
  const maintenant = horodatage(deps);
  const expireLe = expirationJeton(maintenant);
  const jetonId = nouveauJeton();
  const jeton = await jetons.signer(jetonId, Date.parse(expireLe));
  const lieu = await deps.envois.contexteInvitation(userId, locataire.id);
  const message = messageInvitation({
    prenom: locataire.prenom,
    ...lieu,
    lien: `${origine}/accord#${jeton}`,
  });
  const envoi = await envoyerAvecTentative(
    deps,
    courriel,
    { a: locataire.email, ...message },
    'invitation',
  );
  if (envoi.ok) {
    await deps.envois.enregistrerInvitation(userId, {
      locataireId: locataire.id,
      emailEmpreinte: empreinte,
      jetonId,
      expireLe,
      maintenant,
    });
  }
  return envoi.ok;
}

function avecEmail(
  locataire: LocataireContact | null,
): (LocataireContact & { readonly email: string }) | null {
  return locataire?.email === undefined ? null : { ...locataire, email: locataire.email };
}

/**
 * G2-1 sans clic : invite chaque locataire qui a un e-mail et dont rien n'a été demandé pour cette
 * adresse. Les accords sont lus avant tout envoi : sans la migration 0009, rien ne part.
 */
export async function inviterLocataires(
  ctx: ContexteEnvois,
  ids: readonly string[],
): Promise<void> {
  const { deps, userId } = ctx;
  const { courriel, jetons } = deps;
  if (courriel === null || jetons === null) return;
  const accords = await deps.envois.accords(userId);
  for (const id of new Set(ids)) {
    const locataire = avecEmail(await deps.envois.locataire(userId, id));
    if (locataire === null) continue;
    const empreinte = await empreinteEmail(locataire.email);
    const accord = accords.find((a) => a.locataireId === id);
    if (statutAccord(accord, empreinte) !== 'non_demande') continue;
    await envoyerInvitation(ctx, locataire, empreinte, courriel, jetons);
  }
}

interface LocataireJoignable extends Statut {
  readonly locataire: LocataireContact & { readonly email: string };
  readonly empreinte: string;
}

async function locataireJoignable(
  ctx: ContexteEnvois,
  locataireId: string,
): Promise<LocataireJoignable> {
  const locataire = await ctx.deps.envois.locataire(ctx.userId, locataireId);
  if (locataire === null) throw new ErreurEnvois('INTROUVABLE');
  const joignable = avecEmail(locataire);
  if (joignable === null) throw new ErreurEnvois('SANS_EMAIL');
  const empreinte = await empreinteEmail(joignable.email);
  const accords = await ctx.deps.envois.accords(ctx.userId);
  const accord = accords.find((a) => a.locataireId === locataireId);
  return { locataire: joignable, empreinte, accord, statut: statutAccord(accord, empreinte) };
}

/** « Renvoyer la demande » : une invitation par 24 h ; un accord valide ne se redemande pas. */
export async function inviterDeNouveau(
  ctx: ContexteEnvois,
  locataireId: string,
): Promise<AccordLocataire> {
  const { courriel, jetons } = ctx.deps;
  if (courriel === null || jetons === null) throw new ErreurEnvois('ENVOIS_INACTIFS');
  const { locataire, empreinte, accord, statut } = await locataireJoignable(ctx, locataireId);
  if (accordValide(statut)) return versAccordLocataire(locataireId, { statut, accord });
  const invitationLe = statut === 'non_demande' ? undefined : accord?.invitationLe;
  if (!invitationPossible(invitationLe, horodatage(ctx.deps))) {
    throw new ErreurEnvois('INVITATION_RECENTE');
  }
  if (!(await envoyerInvitation(ctx, locataire, empreinte, courriel, jetons))) {
    throw new ErreurEnvois('ENVOI_ECHOUE');
  }
  return { locataireId, statut: 'en_attente', invitationLe: horodatage(ctx.deps) };
}

/** « Mon locataire m'a déjà donné son accord » (G2-1), pour son adresse actuelle. */
export async function declarerAccord(
  ctx: ContexteEnvois,
  locataireId: string,
): Promise<AccordLocataire> {
  const { empreinte } = await locataireJoignable(ctx, locataireId);
  const maintenant = horodatage(ctx.deps);
  await ctx.deps.envois.enregistrerAccord(
    ctx.userId,
    locataireId,
    'declare_par_bailleur',
    empreinte,
    maintenant,
  );
  return { locataireId, statut: 'declare_par_bailleur', le: maintenant };
}

type DestinataireNomme = Destinataire & { readonly prenom: string };

async function destinatairesValides(
  { deps, userId }: ContexteEnvois,
  locationId: string,
): Promise<DestinataireNomme[]> {
  const lieu = await deps.envois.locationEtLocataires(userId, locationId);
  if (lieu === null) return [];
  const accords = await deps.envois.accords(userId);
  const statuts = new Map<string, StatutAccordEffectif>();
  for (const locataire of lieu.locataires) {
    statuts.set(locataire.id, (await statutDe(locataire, accords)).statut);
  }
  return destinatairesQuittance(lieu.location, lieu.locataires, statuts).map((d) => ({
    ...d,
    prenom: lieu.locataires.find((l) => l.id === d.locataireId)?.prenom ?? '',
  }));
}

async function envoyerQuittance(
  { deps, userId }: ContexteEnvois,
  courriel: Envoyeur,
  document: DocumentComplet,
  destinataire: DestinataireNomme,
): Promise<void> {
  const repondreA = await deps.envois.emailCompte(userId);
  const message: Message = {
    a: destinataire.email,
    ...messageQuittance(destinataire.prenom, document.contenu),
    pieces: [
      {
        nom: nomFichierQuittance(document.contenu),
        type: 'application/pdf',
        base64: btoa(pdfDocument(document.contenu)),
      },
    ],
    ...(repondreA === null ? {} : { repondreA }),
  };
  const resultat = await envoyerAvecTentative(deps, courriel, message, 'quittance');
  await deps.envois.enregistrerEnvoi(userId, {
    documentId: document.id,
    locataireId: destinataire.locataireId,
    destinataire: masquerEmail(destinataire.email),
    statut: resultat.ok ? 'envoye' : 'echec',
    tentatives: resultat.tentatives,
    maintenant: horodatage(deps),
  });
}

/**
 * G2-2, confié à `waitUntil` après « Reçu » (ADR-G43) : attendre la fin de « Annuler », puis émettre
 * la quittance si le mois est toujours soldé et l'envoyer à chaque locataire qui l'a acceptée.
 */
export async function envoyerQuittanceDuMois(
  ctx: ContexteEnvois,
  locationId: string,
  periode: string,
): Promise<void> {
  const { deps, userId } = ctx;
  const { courriel } = deps;
  if (courriel === null) return;
  await deps.attendre(REGLES_ENVOIS.delaiQuittanceSecondes * 1000);
  const destinataires = await destinatairesValides(ctx, locationId);
  if (destinataires.length === 0) return;
  let document: DocumentComplet;
  try {
    ({ document } = await deps.gestion.emettreDocument(userId, {
      type: 'quittance',
      locationId,
      periode,
    }));
  } catch (erreur) {
    // Paiement annulé entre-temps, bailleur sans nom ni adresse, location supprimée : rien à envoyer.
    if (erreur instanceof ErreurGestion) {
      deps.journal.info('envoi.quittance_non_emise', { raison: erreur.code });
      return;
    }
    throw erreur;
  }
  const traces = await deps.envois.envoisDuDocument(userId, document.id);
  for (const destinataire of destinataires) {
    const dejaEnvoye = traces.some(
      (t) => t.locataireId === destinataire.locataireId && t.statut === 'envoye',
    );
    if (!dejaEnvoye) await envoyerQuittance(ctx, courriel, document, destinataire);
  }
}

/** « Renvoyer » : le même document (même numéro, même contenu), un envoi par minute au plus. */
export async function renvoyerDocument(ctx: ContexteEnvois, documentId: string): Promise<Envoi[]> {
  const { deps, userId } = ctx;
  const { courriel } = deps;
  if (courriel === null) throw new ErreurEnvois('ENVOIS_INACTIFS');
  const document = await deps.gestion.document(userId, documentId);
  if (document.type !== 'quittance') throw new ErreurEnvois('INTROUVABLE');
  const maintenant = horodatage(deps);
  const traces = await deps.envois.envoisDuDocument(userId, documentId);
  if (traces.some((t) => !renvoiPossible(t.dernierEssaiLe, maintenant))) {
    throw new ErreurEnvois('ENVOI_RECENT');
  }
  const destinataires = await destinatairesValides(ctx, document.locationId);
  if (destinataires.length === 0) throw new ErreurEnvois('SANS_ACCORD');
  for (const destinataire of destinataires) {
    await envoyerQuittance(ctx, courriel, document, destinataire);
  }
  return deps.envois.envoisDuDocument(userId, documentId);
}
