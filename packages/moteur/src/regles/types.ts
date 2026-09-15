import type { ClasseEnergie, EtatBien, TypeBien } from '../schema/bien';
import type { ModeLocation } from '../schema/hypotheses';

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

/** Niveau de confiance de l'estimation du prix, lu sur une note de 0 à 100. */
export type NiveauConfiance = 'tres_faible' | 'faible' | 'moyenne' | 'bonne' | 'elevee';

/** Un point d'un barème : `points` à cette `valeur`, interpolés linéairement entre deux paliers. */
export interface Palier {
  readonly valeur: number;
  readonly points: number;
}

/** Points d'une localisation « quartier » selon le rayon du repère ; `null` = au-delà du dernier rayon. */
export interface PalierRayon {
  readonly jusquaMetres: number | null;
  readonly points: number;
}

/** Note minimale (incluse) d'un niveau de confiance. */
export interface SeuilNiveau {
  readonly des: number;
  readonly niveau: NiveauConfiance;
}

export interface EffetEtage {
  /** Rez-de-chaussée (ou en dessous), par rapport au 2e étage. */
  readonly rezDeChaussee: number;
  /** Premier étage à partir duquel `hauts` s'applique. */
  readonly hautsAPartirDe: number;
  readonly hauts: number;
}

/** Coût de travaux au m² de surface : bas et haut de la fourchette relevée, valeur estimée retenue. */
export interface FourchetteM2 {
  readonly bas: number;
  readonly estime: number;
  readonly haut: number;
}

/** Défauts communs aux locations à loyer mensuel. */
export interface DefautsLoyerMensuel {
  readonly vacanceSemaines: number;
  readonly gestionTaux: number;
}

/** Charges d'abonnement payées par le propriétaire quand les charges sont comprises. */
export interface DefautsChargesProprietaire {
  readonly energieMensuel: number;
  readonly internetMensuel: number;
}

export interface DefautsCourteDuree extends DefautsChargesProprietaire {
  readonly nuiteesParMois: number;
  readonly dureeSejourNuits: number;
  /** Ménage par séjour, facturé au voyageur et payé au prestataire. */
  readonly menageParSejour: number;
  readonly plateformeTaux: number;
  readonly conciergerieTaux: number;
  /** Nuitée de départ = loyer mensuel meublé ÷ 30 × ce coefficient. */
  readonly nuiteeEnLoyersJournaliers: number;
}

export interface DefautsMoyenneDuree extends DefautsLoyerMensuel, DefautsChargesProprietaire {
  readonly dureeSejourMois: number;
  readonly menageParSejour: number;
  readonly plateformeTaux: number;
}

/** Défauts par type d'exploitation, une entrée par `ModeLocation`. */
export type DefautsParType = {
  readonly [M in ModeLocation]: M extends 'colocation'
    ? DefautsLoyerMensuel & DefautsChargesProprietaire
    : M extends 'courte_duree'
      ? DefautsCourteDuree
      : M extends 'moyenne_duree'
        ? DefautsMoyenneDuree
        : DefautsLoyerMensuel;
};

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
    /** Supplément de loyer total attendu en colocation par rapport à une location meublée classique. */
    readonly primeColocation: number;
    readonly interdictionLocationDpe: Readonly<Record<'G' | 'F' | 'E', number>>;
    /** Valeurs de départ propres à chaque type d'exploitation (badgées « estimé » dans l'app). */
    readonly parType: DefautsParType;
    /** Décence d'une chambre louée par bail individuel en colocation. */
    readonly colocation: {
      readonly surfaceMinChambreM2: number;
      readonly volumeMinChambreM3: number;
    };
    /** Réglementation des meublés de tourisme (courte durée). */
    readonly meubleTourisme: {
      /** Classe DPE minimale pour une nouvelle autorisation de changement d'usage. */
      readonly dpeMinNouvelleAutorisation: ClasseEnergie;
      /** Classe DPE minimale de tous les meublés de tourisme à partir de `dpeMinTousDes`. */
      readonly dpeMinTous: ClasseEnergie;
      readonly dpeMinTousDes: number;
      /** Jours de location par an d'une résidence principale (les communes peuvent abaisser). */
      readonly joursMaxResidencePrincipale: number;
      /** Départements où l'autorisation de changement d'usage est obligatoire de plein droit. */
      readonly departementsChangementUsage: readonly string[];
    };
    /** Bail mobilité (moyenne durée). */
    readonly bailMobilite: {
      readonly dureeMinMois: number;
      readonly dureeMaxMois: number;
    };
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
    /** Mensualité assurance comprise ÷ loyer hors charges : le loyer porte-t-il le crédit ? */
    readonly couverture: { readonly bonJusqua: number; readonly surveillerJusqua: number };
  };

  /** Seuils qui décident des questions de la liste de visite. */
  readonly visite: {
    /** Permis de construire déposé avant cette année : diagnostic amiante obligatoire. */
    readonly amianteAvantAnnee: number;
    /** Logement construit avant cette année : constat de risque d'exposition au plomb. */
    readonly plombAvantAnnee: number;
    /** Installations électrique et gaz plus vieilles que ce nombre d'années : diagnostics obligatoires. */
    readonly installationsAnciennesAns: number;
    /** Premier étage à partir duquel l'absence d'ascenseur pèse sur la location. */
    readonly etageSansAscenseur: number;
    /** Surface minimale d'une chambre en colocation (décence). */
    readonly chambreColocationM2: number;
  };

  readonly estimation: {
    /** Quantile des ventes comparables où se place un bien selon son état (0,25 = premier quartile). */
    readonly positionsEtat: Readonly<Record<EtatBien, number>>;
    /** Écart de prix à la classe D ; `null` = écart non publié, aucune correction. */
    readonly dpe: Readonly<Record<TypeBien, Readonly<Record<ClasseEnergie, number | null>>>>;
    readonly etage: {
      readonly avecAscenseur: EffetEtage;
      readonly sansAscenseur: EffetEtage;
    };
    /** Prime d'un balcon ou d'une terrasse. */
    readonly exterieur: number;
    /** Décote d'un bien vendu loué, par rapport à un bien libre (négative). */
    readonly occupation: number;
    readonly charges: {
      /** Charges de copropriété courantes, en € par m² et par an. */
      readonly repereM2An: number;
      /** Effet maximal des charges sur le prix, en proportion. */
      readonly borne: number;
    };
    /** Note de confiance sur 100 : quatre composantes, chacune avec son barème (le maximum d'un barème = ses points les plus hauts). */
    readonly confiance: {
      readonly localisation: {
        readonly immeuble: number;
        /** Ventes de la même rue : `points` tant qu'elles tiennent dans `jusquaMetres`, au-delà les points du quartier pour leur étendue. */
        readonly rue: { readonly points: number; readonly jusquaMetres: number };
        /** Par rayon croissant, le dernier avec `jusquaMetres: null`. */
        readonly quartier: readonly PalierRayon[];
        readonly commune: number;
      };
      /** Nombre de ventes comparables → points (paliers croissants). */
      readonly comparables: readonly Palier[];
      /** Écart interquartile ÷ médiane → points (paliers croissants en valeur, décroissants en points). */
      readonly dispersion: readonly Palier[];
      /** Ancienneté médiane des ventes en mois → points. */
      readonly anciennete: readonly Palier[];
      /** Ancienneté retenue quand elle est inconnue (milieu de la fenêtre de deux ans des ventes publiées). */
      readonly ancienneteSupposeeMois: number;
      /** Par note décroissante, le dernier à 0. */
      readonly niveaux: readonly SeuilNiveau[];
    };
    /** Demi-largeur de la fourchette d'estimation selon le niveau de confiance. */
    readonly marges: Readonly<Record<NiveauConfiance, number>>;
  };

  /** Travaux estimés selon l'état du bien, TTC et hors aides, en € par m² de surface. */
  readonly travaux: {
    readonly parEtat: Readonly<Record<EtatBien, FourchetteM2>>;
    /** Supplément de rénovation énergétique pour les classes listées (isolation, chauffage, ventilation). */
    readonly renovationEnergetique: FourchetteM2 & {
      readonly classes: readonly ClasseEnergie[];
      /** Part du supplément comptée pour un bien à rénover (la rénovation complète en couvre une partie). */
      readonly partSiARenover: number;
    };
    /** Les montants sont arrondis à ce multiple d'euros. */
    readonly arrondi: number;
  };

  /** Chemins (notation pointée) des valeurs sans source officielle consolidée. */
  readonly aConfirmer: readonly string[];
  /** Simplifications assumées par cette version, affichées dans les résultats. */
  readonly simplifications: readonly string[];
}
