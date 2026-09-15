import {
  CAPITAL_MAX_CENTIMES,
  DUREE_PRET_MAX_MOIS,
  MONTANT_MAX_CENTIMES,
  TAUX_PRET_MAX,
  type PretBien,
} from '@loupe/gestion';

import { texteDeCentimes } from './saisie-depense';

/** Le formulaire du prêt d'un bien, en texte : euros, pourcentage, années, « 11/2026 ». */
export interface SaisiePret {
  readonly capital: string;
  readonly taux: string;
  readonly duree: string;
  readonly premiereEcheance: string;
  readonly assurance: string;
}

export type ChampPretBien = 'capital' | 'taux' | 'duree' | 'premiereEcheance' | 'assurance';

export type LecturePret =
  | { readonly ok: true; readonly pret: PretBien }
  | { readonly ok: false; readonly erreurs: readonly ChampPretBien[] };

/** « 150 000 », « 3,35 % », « 17,5 » → nombre ; `null` si illisible ou trop de décimales. */
function nombreDepuisTexte(texte: string, decimales: number): number | null {
  const nettoye = texte.replace(/[\s€%]/g, '').replace(',', '.');
  const format = new RegExp(`^\\d+(\\.\\d{1,${String(decimales)}})?$`);
  return format.test(nettoye) ? Number(nettoye) : null;
}

/** « 11/2026 », « 11-2026 » ou « 2026-11 » → « 2026-11 » ; `null` sinon. */
export function periodeDepuisTexte(texte: string): string | null {
  const nettoye = texte.trim();
  const francais = /^(\d{1,2})\s*[/.-]\s*(\d{4})$/.exec(nettoye);
  const iso = /^(\d{4})-(\d{2})$/.exec(nettoye);
  const [mois, annee] = francais === null ? [iso?.[2], iso?.[1]] : [francais[1], francais[2]];
  const numero = Number(mois);
  if (annee === undefined || !(numero >= 1 && numero <= 12)) return null;
  return `${annee}-${String(numero).padStart(2, '0')}`;
}

/** « 2026-11 » → « 11/2026 ». */
export function texteDePeriode(periode: string): string {
  return `${periode.slice(5, 7)}/${periode.slice(0, 4)}`;
}

/** Un formulaire vide ; la première échéance proposée est le mois en cours. */
export function saisiePretVide(periode: string): SaisiePret {
  return {
    capital: '',
    taux: '',
    duree: '',
    premiereEcheance: texteDePeriode(periode),
    assurance: '',
  };
}

/** Le formulaire d'un prêt enregistré, ou proposé par l'analyse. */
export function saisieDepuisPret(pret: PretBien): SaisiePret {
  return {
    capital: texteDeCentimes(pret.capital),
    taux: String(Number((pret.tauxAnnuel * 100).toFixed(3))).replace('.', ','),
    duree: String(Number((pret.dureeMois / 12).toFixed(2))).replace('.', ','),
    premiereEcheance: texteDePeriode(pret.debut),
    assurance: texteDeCentimes(pret.assuranceMensuelle),
  };
}

/** Des euros entre `min` et `max` centimes, ou `null`. */
function centimesBornes(texte: string, min: number, max: number): number | null {
  const euros = nombreDepuisTexte(texte, 2);
  const centimes = euros === null ? -1 : Math.round(euros * 100);
  return centimes >= min && centimes <= max ? centimes : null;
}

/** Le prêt à enregistrer, ou les champs à corriger dans l'ordre de l'écran. */
export function lirePret(saisie: SaisiePret): LecturePret {
  const erreurs: ChampPretBien[] = [];
  const capital = centimesBornes(saisie.capital, 1, CAPITAL_MAX_CENTIMES);
  if (capital === null) erreurs.push('capital');
  const pourcentage = nombreDepuisTexte(saisie.taux, 3) ?? -1;
  const taux = Number((pourcentage / 100).toFixed(5));
  if (taux < 0 || taux > TAUX_PRET_MAX) erreurs.push('taux');
  const annees = nombreDepuisTexte(saisie.duree, 2) ?? 0;
  const dureeMois = Math.round(annees * 12);
  if (dureeMois < 1 || dureeMois > DUREE_PRET_MAX_MOIS) erreurs.push('duree');
  const debut = periodeDepuisTexte(saisie.premiereEcheance);
  if (debut === null) erreurs.push('premiereEcheance');
  const assurance =
    saisie.assurance.trim() === '' ? 0 : centimesBornes(saisie.assurance, 0, MONTANT_MAX_CENTIMES);
  if (assurance === null) erreurs.push('assurance');
  if (capital === null || debut === null || assurance === null || erreurs.length > 0) {
    return { ok: false, erreurs };
  }
  return {
    ok: true,
    pret: { capital, tauxAnnuel: taux, dureeMois, debut, assuranceMensuelle: assurance },
  };
}
