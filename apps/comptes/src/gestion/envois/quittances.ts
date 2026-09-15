import {
  destinatairesQuittance,
  masquerEmail,
  REGLES_ENVOIS,
  renvoiPossible,
  type Destinataire,
  type DocumentComplet,
  type Envoi,
  type StatutAccordEffectif,
} from '@loupe/gestion';

import type { Envoyeur, Message } from '../../courriel';
import { messageQuittance, nomFichierQuittance } from '../../courriels/gabarits';
import { pdfDocument } from '../../courriels/pdf-quittance';
import { ErreurGestion } from '../depot';
import { ErreurEnvois } from './depot';
import { envoyerAvecTentative, horodatage, statutDe, type ContexteEnvois } from './taches';

/** La quittance envoyée par e-mail (G2-2) : au paiement qui solde le mois, et « Renvoyer ». */

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
