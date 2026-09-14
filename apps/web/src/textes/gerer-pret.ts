import type { ChampPret } from '@/gestion/depuis-projet';
import { montant } from '@/gestion/format';

/** Textes de la porte « J'ai acheté ce bien » (tutoiement). */
export const TEXTES_PRET = {
  jaiAchete: 'J’ai acheté ce bien',
  titre: 'Prêt à gérer',
  leBien: 'Le bien',
  laLocation: 'La location',
  tonLocataire: 'Ton locataire',
  adresse: 'Adresse du bien',
  locataire: 'Prénom et nom',
  email: 'E-mail',
  aideLocataire: 'Personne n’habite encore le bien ? Choisis « Pas encore loué ».',
  analyse: 'analyse',
  parDefaut: 'par défaut',
  type: 'Type',
  surface: 'Surface',
  dpe: 'DPE',
  loyer: 'Loyer',
  loyerInconnu: 'À indiquer dans ton analyse',
  loyerManquant: 'Ton analyse n’a pas encore de loyer.',
  ajouterLoyer: 'Ajouter le loyer dans Hypothèses',
  loyerAttendu: 'Loyer attendu',
  depot: 'Dépôt de garantie',
  entree: 'Entrée du locataire',
  ensuite: 'Ensuite, on suit tes loyers.',
  pasEncoreLoue: 'Pas encore loué',
  cestParti: 'C’est parti',
  introuvable: 'Projet introuvable',
  retourProjets: 'Retour à mes projets',
} as const;

export function sousTitrePret(nomDuProjet: string): string {
  return `${nomDuProjet} · tout vient de ton analyse. Tu pourras tout changer ensuite.`;
}

/** « Meublée · 650 € + 50 € de charges » ; sans charges, « Vide · 650 € ». */
export function locationEnLettres(meuble: boolean, loyer: number, charges: number): string {
  const mode = meuble ? 'Meublée' : 'Vide';
  const detail =
    charges === 0 ? montant(loyer) : `${montant(loyer)} + ${montant(charges)} de charges`;
  return `${mode} · ${detail}`;
}

export const ERREURS_PRET: Readonly<Record<ChampPret, string>> = {
  adresse: 'Indique l’adresse du bien.',
  loyer: 'Indique d’abord le loyer dans ton analyse, ou choisis « Pas encore loué ».',
  locataire: 'Indique le prénom et le nom, par exemple Julie Martin.',
  email: 'Cette adresse e-mail ne semble pas valide.',
};
