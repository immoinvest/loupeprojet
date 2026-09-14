import type { CodeManque, Manque } from '@loupe/moteur';

/** Les phrases d'une donnée absente : le moteur ne rend que des codes. */
export interface TexteManque {
  readonly titre: string;
  readonly phrase: string;
  /** Complément d'un feu inconnu : « Cash-flow : loyer à indiquer ». */
  readonly feu: string;
  /** Vrai quand l'absence rend le rapport partiel (bandeau en tête d'onglet). */
  readonly bloque: boolean;
}

export const MANQUES: Readonly<Record<CodeManque, TexteManque>> = {
  LOYER_ABSENT: {
    titre: 'Il manque le loyer visé pour cette analyse',
    phrase:
      'Cash-flow, impôts, revente et rendement se calculent à partir du loyer. Indiquez-le, ou prenez le loyer de marché de la commune.',
    feu: 'loyer à indiquer',
    bloque: true,
  },
  REVENUS_ABSENTS: {
    titre: 'Il manque vos revenus nets',
    phrase:
      "Indiquez vos revenus nets pour vérifier l'effort bancaire : mensualité divisée par vos revenus et 70 % des loyers.",
    feu: 'revenus à indiquer',
    bloque: false,
  },
};

/** Les manques qui bloquent des analyses, dans l'ordre du moteur. */
export function manquesBloquants(manques: readonly Manque[]): Manque[] {
  return manques.filter((m) => MANQUES[m.code].bloque);
}

export const TEXTES_A_COMPLETER = {
  titre: 'À compléter',
  phrase: 'Indiquez le loyer visé pour voir ce chiffre.',
  verdictCashflow: 'Le loyer reste à indiquer.',
  sousTitreSeul: 'Indiquez le loyer visé pour connaître le cash-flow.',
  boutonLoyerMarche: 'Utiliser le loyer de marché :',
  appliquer: 'Appliquer',
} as const;
