/**
 * Toutes les constantes datées du moteur (barèmes, taux, seuils).
 * Une version = un fichier. Un projet porte la version qui l'a calculé.
 */
export type VersionRegles = '2026-09';

export interface Tranche {
  /** Borne haute incluse de la tranche ; `null` = dernière tranche, sans plafond. */
  readonly jusqua: number | null;
  readonly taux: number;
}

export interface PeriodeAbattement {
  /** Première année de détention concernée (incluse). */
  readonly deAnnee: number;
  /** Dernière année concernée (incluse). */
  readonly aAnnee: number;
  readonly tauxParAn: number;
}

export interface ComposantAmortissement {
  readonly code: 'grosOeuvre' | 'secondOeuvre';
  /** Part de la base amortissable (hors terrain). */
  readonly part: number;
  readonly dureeAnnees: number;
}

export interface Regles {
  readonly version: VersionRegles;
  readonly dateReference: string;

  readonly acquisition: {
    /** Droits départementaux (DMTO) par défaut. */
    readonly dmtoDefaut: number;
    /** Départements à taux réduit, par numéro. */
    readonly dmtoParDepartement: Readonly<Record<string, number>>;
    readonly taxeCommunale: number;
    /** Frais d'assiette et de recouvrement, en proportion du DMTO. */
    readonly fraisAssiette: number;
    readonly emoluments: readonly Tranche[];
    readonly tva: number;
    readonly contributionSecuriteImmobiliere: number;
    readonly debours: number;
  };

  readonly credit: {
    /** Taux nominaux moyens du mois, par durée en années. */
    readonly tauxMoyens: Readonly<Record<'15' | '20' | '25', number>>;
    readonly tauxUsure: number;
    readonly hcsf: {
      readonly seuilEffort: number;
      readonly partLoyers: number;
      readonly dureeMaxAnnees: number;
      readonly dureeMaxTravauxAnnees: number;
      readonly seuilTravauxPourDureeMax: number;
    };
    readonly ira: {
      readonly moisInterets: number;
      readonly plafondCapital: number;
    };
  };

  readonly exploitation: {
    /** Écart de loyer meublé / nu utilisé pour déduire le loyer nu par défaut. */
    readonly primeMeuble: number;
    /** Supplément de loyer total attendu en colocation par rapport à une location classique. */
    readonly primeColocation: number;
    readonly vacanceSemainesColocation: number;
    readonly interdictionLocationDpe: Readonly<Record<'G' | 'F' | 'E', number>>;
  };

  readonly fiscalite: {
    readonly prelevementsSociaux: {
      readonly bic: number;
      readonly foncier: number;
      readonly plusValue: number;
    };
    readonly microBic: {
      readonly abattement: number;
      readonly abattementTourismeNonClasse: number;
      readonly plafond: number;
      readonly plafondTourismeNonClasse: number;
    };
    readonly microFoncier: {
      readonly abattement: number;
      readonly plafond: number;
    };
    readonly deficitFoncier: {
      readonly plafondRevenuGlobal: number;
      readonly plafondRenovationEnergetique: number;
      readonly reportAnnees: number;
    };
    readonly deficitBic: {
      readonly reportAnnees: number;
    };
    readonly amortissement: {
      readonly partTerrain: number;
      readonly composants: readonly ComposantAmortissement[];
      readonly travauxDureeAnnees: number;
      readonly mobilierDureeAnnees: number;
    };
    readonly plusValue: {
      readonly tauxIr: number;
      readonly forfaitFrais: number;
      readonly forfaitTravaux: number;
      readonly forfaitTravauxDesAnnee: number;
      readonly abattementIr: readonly PeriodeAbattement[];
      readonly abattementPs: readonly PeriodeAbattement[];
      readonly surtaxeSeuil: number;
      readonly surtaxe: readonly Tranche[];
    };
  };

  readonly verdict: {
    readonly prix: { readonly bonJusqua: number; readonly surveillerJusqua: number };
    readonly rendementNet: { readonly bonDes: number; readonly surveillerDes: number };
    readonly cashflowMensuel: { readonly bonDes: number; readonly surveillerDes: number };
    readonly effort: { readonly bonJusqua: number; readonly surveillerJusqua: number };
  };

  /** Chemins (notation pointée) des valeurs sans source officielle consolidée. */
  readonly aConfirmer: readonly string[];
  /** Simplifications assumées par cette version, affichées dans les résultats. */
  readonly simplifications: readonly string[];
}
