import type { Bien, CodeCorrection, Correction, EstimationPrix, EtatBien } from '@loupe/moteur';

import type { TendanceAdresse } from '@/enrichissement';
import { euros, pourcentage, pourcentageSigne } from '@/formatage/nombres';

export { LIBELLES_CONFIANCE, niveauEnPhrase, TON_CONFIANCE } from './confiance';

export const LIBELLES_ETATS: Readonly<Record<EtatBien, string>> = {
  a_renover: 'À rénover',
  a_rafraichir: 'À rafraîchir',
  bon_etat: 'Bon état',
  renove: 'Rénové',
};

export const LIBELLES_CORRECTIONS: Readonly<Record<CodeCorrection, string>> = {
  dpe: 'Étiquette énergie',
  etage: 'Étage et ascenseur',
  exterieur: 'Balcon ou terrasse',
  charges: 'Charges de copropriété',
};

export const SOURCES_CORRECTIONS: Readonly<Record<CodeCorrection, string>> = {
  dpe: 'Notaires de France, « La valeur verte des logements », ventes 2024 (janvier 2026)',
  etage: 'MeilleursAgents, prix selon l’étage, grandes villes de province (juin 2017)',
  exterieur: 'MeilleursAgents, balcons et terrasses, onze plus grandes villes (mai 2020)',
  charges: 'Observatoire des charges de copropriété ARC/UNARC (2024)',
};

export const PHRASES_ESTIMATION = {
  etatSuppose: 'État non renseigné : bon état supposé. Indiquez-le ci-dessous.',
  sansVentes:
    'Pas encore de ventes réelles pour ce projet : analysez l’adresse pour obtenir une estimation.',
  aucuneCorrection:
    'Aucune correction : renseignez le DPE, l’étage, l’ascenseur, le balcon et les charges dans Hypothèses.',
  prixDesActes: 'Prix des actes, sans actualisation : la tendance locale n’est pas encore publiée.',
  limites:
    'Les ventes DVF ne disent rien de l’état, de l’étage, de l’ascenseur ni du DPE : ces effets viennent d’études publiées, affichées avec leur source.',
} as const;

/** Arrondi au millier d'euros : une estimation n'a pas la précision de l'euro. */
export function eurosArrondis(montant: number): string {
  return euros(Math.round(montant / 1000) * 1000);
}

/** « 2025-S1 » → « 1er semestre 2025 ». */
export function libelleSemestre(periode: string): string {
  const annee = periode.slice(0, 4);
  return periode.endsWith('S1') ? `1er semestre ${annee}` : `2e semestre ${annee}`;
}

/** Pourquoi une correction s'applique, avec les chiffres du bien. */
export function raisonCorrection(
  correction: Correction,
  bien: Bien,
  estimation: EstimationPrix,
): string {
  switch (correction.code) {
    case 'dpe':
      return `DPE ${bien.dpe ?? '?'}, comparé à un DPE D.`;
    case 'etage':
      if (bien.etage === undefined || bien.etage <= 0) return 'Rez-de-chaussée.';
      return `${String(bien.etage)}e étage ${bien.ascenseur === true ? 'avec' : 'sans'} ascenseur, comparé à un 2e étage.`;
    case 'exterieur':
      return 'Balcon ou terrasse.';
    case 'charges': {
      const c = estimation.charges;
      if (c === null) return '';
      const sens = c.excedentAnnuel > 0 ? 'au-dessus' : 'en dessous';
      const plafond = c.borneAtteinte ? ' Effet plafonné.' : '';
      return `${euros(c.repereAnnuel + c.excedentAnnuel)} par an, ${euros(Math.abs(c.excedentAnnuel))} ${sens} du repère de ${euros(c.repereAnnuel)}, capitalisés au rendement local de ${pourcentage(c.rendementLocal)}.${plafond}`;
    }
  }
}

/** « Estimé entre 190 000 € et 223 000 €. Le prix affiché est à −25 % de l'estimation. » */
export function phraseEstimation(estimation: EstimationPrix): string {
  return `Estimé entre ${eurosArrondis(estimation.bas)} et ${eurosArrondis(estimation.haut)}. Le prix affiché est à ${pourcentageSigne(estimation.ecartPrix)} de l’estimation.`;
}

/** « Prix ramenés au 1er semestre 2025 par l'évolution de la commune : +5 % sur un an, +12,5 % sur deux ans. » */
export function phraseTendance(tendance: TendanceAdresse): string {
  const zone = tendance.zone === 'commune' ? 'de la commune' : 'du département';
  const evolutions = [
    tendance.evolution1an === null
      ? null
      : `${pourcentageSigne(tendance.evolution1an, 1)} sur un an`,
    tendance.evolution2ans === null
      ? null
      : `${pourcentageSigne(tendance.evolution2ans, 1)} sur deux ans`,
  ].filter((e): e is string => e !== null);
  const suite = evolutions.length === 0 ? '' : ` : ${evolutions.join(', ')}`;
  return `Prix ramenés au ${libelleSemestre(tendance.periodeReference)} par l’évolution ${zone}${suite}.`;
}
