import { AchatSchema, fraisAcquisition, rendements } from '@loupe/moteur';

import { REGLES } from './regles';

/** Les champs du simulateur de rentabilité, tels que tapés. */
export interface SaisieSimulateur {
  readonly prix: string;
  readonly departement: string;
  readonly travaux: string;
  readonly loyer: string;
  readonly charges: string;
}

export type ChampSimulateur = keyof SaisieSimulateur;

export interface ResultatSimulateur {
  readonly fraisAcquisition: number;
  readonly coutTotal: number;
  readonly brut: number;
  readonly net: number;
}

export type CalculSimulateur =
  | { readonly ok: true; readonly resultat: ResultatSimulateur }
  | { readonly ok: false; readonly erreurs: Readonly<Partial<Record<ChampSimulateur, string>>> };

/** « 150 000 € », « 1 900,50 » → nombre ; vide ou illisible → `null`. */
export function lireMontant(texte: string): number | null {
  const propre = texte.replace(/[\s€]/g, '').replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(propre) ? Number(propre) : null;
}

/** Montant facultatif : vide vaut zéro. */
function lireFacultatif(texte: string): number | null {
  return texte.trim() === '' ? 0 : lireMontant(texte);
}

const FORMAT_DEPARTEMENT = /^(0[1-9]|[1-8]\d|9[0-5]|2A|2B|97[1-6])$/;

/**
 * Rentabilité brute et nette d'un bien, par le moteur de l'application : frais d'acquisition du
 * département (droits, émoluments, contribution de sécurité immobilière, débours), coût total, puis
 * rendements avant crédit et impôt, sans vacance locative.
 */
export function calculerRentabilite(saisie: SaisieSimulateur): CalculSimulateur {
  const prix = lireMontant(saisie.prix);
  const travaux = lireFacultatif(saisie.travaux);
  const loyer = lireMontant(saisie.loyer);
  const charges = lireFacultatif(saisie.charges);
  const departement = saisie.departement.trim().toUpperCase();

  const erreurs: Partial<Record<ChampSimulateur, string>> = {};
  if (prix === null || prix <= 0) erreurs.prix = 'Indiquez le prix du bien, en euros.';
  if (!FORMAT_DEPARTEMENT.test(departement)) {
    erreurs.departement = 'Indiquez le numéro du département : 13, 69, 2A…';
  }
  if (travaux === null || travaux < 0) erreurs.travaux = 'Indiquez un montant positif, ou rien.';
  if (loyer === null || loyer <= 0) erreurs.loyer = 'Indiquez le loyer mensuel hors charges.';
  if (charges === null || charges < 0)
    erreurs.charges = 'Indiquez un montant annuel positif, ou rien.';
  if (prix === null || travaux === null || loyer === null || charges === null)
    return { ok: false, erreurs };
  if (Object.keys(erreurs).length > 0) return { ok: false, erreurs };

  const achat = AchatSchema.parse({ prix, travaux });
  const frais = fraisAcquisition(achat, departement, REGLES).total;
  const coutTotal = prix + travaux + frais;
  const loyersAnnuels = loyer * 12;
  const { brut, net } = rendements({
    coutTotal,
    loyersBruts: loyersAnnuels,
    loyersNets: loyersAnnuels,
    chargesAnnuelles: charges,
    interetsAnnee1: 0,
    assuranceAnnee1: 0,
    impotAnnee1: 0,
  });
  return { ok: true, resultat: { fraisAcquisition: frais, coutTotal, brut, net } };
}
