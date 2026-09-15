import { VERSION_REGLES_COURANTE, obtenirRegles } from '@loupe/moteur';

import { PART_APPORT_DEFAUT } from '@/annonces/apport';
import { euros, pourcentage } from '@/formatage/nombres';

/** Les termes expliqués par une icône ⓘ : un code par terme, la même explication partout. */
export type CodeTerme =
  | 'anneeConstruction'
  | 'apport'
  | 'assuranceEmprunteur'
  | 'cfe'
  | 'chargesCopro'
  | 'chargesRefacturees'
  | 'comptable'
  | 'conciergerie'
  | 'coproEnProcedure'
  | 'differePartiel'
  | 'differeTotal'
  | 'dpe'
  | 'entretien'
  | 'evolutionPrix'
  | 'forfaitCharges'
  | 'fraisDossier'
  | 'garantie'
  | 'gestionDeleguee'
  | 'ges'
  | 'honorairesAcquereur'
  | 'loyerHc'
  | 'lotsCopro'
  | 'meubleTourismeClasse'
  | 'mobilier'
  | 'negociation'
  | 'plafondEncadrement'
  | 'plateforme'
  | 'pno'
  | 'prelevementsSociaux'
  | 'regimeFiscal'
  | 'renovationEnergetique'
  | 'tauxNominal'
  | 'tmi'
  | 'vacance'
  | 'venduLoue';

export interface SourceTerme {
  readonly nom: string;
  readonly url: string;
}

export interface EntreeGlossaire {
  /** Le terme tel qu'il s'écrit dans l'application. */
  readonly terme: string;
  /** Deux ou trois phrases : ce que c'est, qui paie ou quand, la règle utile. */
  readonly definition: string;
  readonly source?: SourceTerme;
}

const SERVICE_PUBLIC: SourceTerme = {
  nom: 'service-public.fr',
  url: 'https://www.service-public.fr',
};
const IMPOTS: SourceTerme = { nom: 'impots.gouv.fr', url: 'https://www.impots.gouv.fr' };
const ANIL: SourceTerme = { nom: 'ANIL', url: 'https://www.anil.org' };
const BANQUE_DE_FRANCE: SourceTerme = {
  nom: 'Banque de France',
  url: 'https://www.banque-france.fr',
};
const ECOLOGIE: SourceTerme = { nom: 'ecologie.gouv.fr', url: 'https://www.ecologie.gouv.fr' };

// Tout chiffre d'une définition vient des règles du moteur : le glossaire ne diverge jamais du calcul.
const R = obtenirRegles(VERSION_REGLES_COURANTE);

/** « 50 % », « 17,2 % » : une décimale seulement quand le taux en a une. */
export function pct(taux: number): string {
  return pourcentage(taux, Math.round(taux * 1000) % 10 === 0 ? 0 : 1);
}

/** « (taux à confirmer) » quand les règles marquent cette valeur comme en attente de source. */
export function mentionAConfirmer(
  regles: { readonly aConfirmer: readonly string[] },
  chemin: string,
): string {
  return regles.aConfirmer.includes(chemin) ? ' (taux à confirmer)' : '';
}

const PS = R.fiscalite.prelevementsSociaux;
const MICRO_BIC = R.fiscalite.microBic;
const DPE_INTERDIT = R.exploitation.interdictionLocationDpe;
const DEFICIT = R.fiscalite.deficitFoncier;

export const GLOSSAIRE: Readonly<Record<CodeTerme, EntreeGlossaire>> = {
  anneeConstruction: {
    terme: 'Année de construction',
    definition: `Elle décide des diagnostics à demander au vendeur : constat plomb pour un logement construit avant ${String(R.visite.plombAvantAnnee)}, diagnostic amiante pour un permis de construire d'avant ${String(R.visite.amianteAvantAnnee)}.`,
    source: SERVICE_PUBLIC,
  },
  apport: {
    terme: 'Apport',
    definition: `La somme que vous mettez vous-même dans l'achat, sans l'emprunter. Les banques en demandent souvent ${pct(PART_APPORT_DEFAUT)} du coût total, de quoi payer les frais de notaire.`,
    source: ANIL,
  },
  assuranceEmprunteur: {
    terme: 'Assurance emprunteur',
    definition:
      "Elle rembourse le prêt à votre place en cas de décès ou d'invalidité. Indiquée ici en pourcentage du capital emprunté par an ; vous pouvez choisir un autre assureur que votre banque.",
    source: SERVICE_PUBLIC,
  },
  cfe: {
    terme: 'CFE',
    definition:
      "Cotisation foncière des entreprises : un impôt local dû par les loueurs en meublé, comme pour toute activité. Elle n'est pas due l'année où la location commence ; son montant dépend de la commune.",
    source: IMPOTS,
  },
  chargesCopro: {
    terme: 'Charges de copropriété',
    definition:
      "Les dépenses de l'immeuble partagées entre copropriétaires : syndic, entretien, ascenseur, chauffage collectif… Une partie peut être refacturée au locataire.",
    source: ANIL,
  },
  chargesRefacturees: {
    terme: 'Charges refacturées',
    definition:
      "La part des charges (entretien des parties communes, eau, taxe d'ordures ménagères) que vous pouvez faire payer au locataire en plus du loyer.",
    source: ANIL,
  },
  comptable: {
    terme: 'Comptable',
    definition:
      "Honoraires d'un expert-comptable ou d'un organisme de gestion agréé. Surtout utile au régime réel du meublé (LMNP), dont la déclaration est technique ; ces frais se déduisent des loyers.",
    source: IMPOTS,
  },
  conciergerie: {
    terme: 'Conciergerie',
    definition:
      'Une société qui gère la location courte durée à votre place (annonces, clés, ménage, voyageurs) contre une part des recettes.',
  },
  coproEnProcedure: {
    terme: 'Copropriété en procédure',
    definition:
      "Copropriété en difficulté (procédure d'alerte, administrateur provisoire) parce qu'elle n'arrive plus à payer ses dépenses : charges et travaux risquent d'augmenter.",
    source: ANIL,
  },
  differePartiel: {
    terme: 'Différé partiel',
    definition:
      "Une période au début du prêt où vous ne payez que les intérêts et l'assurance, sans rembourser le capital.",
    source: BANQUE_DE_FRANCE,
  },
  differeTotal: {
    terme: 'Différé total',
    definition:
      "Une période au début du prêt où vous ne remboursez rien : les intérêts s'ajoutent à la somme due. Pratique pendant des travaux, mais le prêt coûte plus cher.",
    source: BANQUE_DE_FRANCE,
  },
  dpe: {
    terme: 'DPE',
    definition: `Diagnostic de performance énergétique : une étiquette de A (économe) à G (énergivore). Un logement classé G ne peut plus être mis en location depuis ${String(DPE_INTERDIT.G)}, F à partir de ${String(DPE_INTERDIT.F)} et E à partir de ${String(DPE_INTERDIT.E)}.`,
    source: SERVICE_PUBLIC,
  },
  entretien: {
    terme: 'Provision entretien',
    definition:
      'Une somme mise de côté chaque année pour les réparations et le remplacement des équipements (chaudière, peintures, électroménager), en pourcentage du prix du bien.',
  },
  evolutionPrix: {
    terme: 'Évolution du prix',
    definition:
      "La hausse (ou la baisse) moyenne du prix du bien chaque année jusqu'à la revente. C'est une hypothèse : personne ne connaît les prix futurs.",
  },
  forfaitCharges: {
    terme: 'Forfait de charges',
    definition:
      "Un montant fixe de charges payé chaque mois par le locataire, sans régularisation en fin d'année. Possible en meublé, en colocation et en bail mobilité.",
    source: ANIL,
  },
  fraisDossier: {
    terme: 'Frais de dossier',
    definition:
      'La somme que demande la banque pour étudier et monter le prêt, payée une fois à la signature.',
    source: BANQUE_DE_FRANCE,
  },
  garantie: {
    terme: 'Garantie',
    definition:
      "Caution (Crédit Logement…) ou hypothèque qui protège la banque si le prêt n'est plus remboursé. Payée une fois à la signature ; une partie de la caution est souvent rendue à la fin du prêt.",
    source: ANIL,
  },
  gestionDeleguee: {
    terme: 'Gestion déléguée',
    definition:
      'La part des loyers payée à une agence qui trouve les locataires, encaisse les loyers et règle les problèmes. 0 % si vous gérez vous-même.',
  },
  ges: {
    terme: 'GES',
    definition:
      "L'étiquette de A à G des émissions de gaz à effet de serre du logement (chauffage, eau chaude). La classe du DPE retient la plus mauvaise des deux étiquettes, énergie et GES.",
    source: ECOLOGIE,
  },
  honorairesAcquereur: {
    terme: "Honoraires d'agence",
    definition:
      "Les frais d'agence payés par l'acheteur en plus du prix net vendeur. Quand l'acheteur les paie, ils ne comptent pas dans la base des frais de notaire.",
    source: ANIL,
  },
  loyerHc: {
    terme: 'Loyer hors charges',
    definition:
      'Le loyer mensuel sans les charges récupérables (eau, entretien des parties communes, ordures ménagères), que le locataire paie en plus.',
    source: ANIL,
  },
  lotsCopro: {
    terme: 'Lots de copropriété',
    definition:
      "Le nombre de parts de l'immeuble : logements, commerces, caves, parkings. Il donne la taille de la copropriété.",
    source: ANIL,
  },
  meubleTourismeClasse: {
    terme: 'Meublé de tourisme classé',
    definition: `Un meublé de tourisme qui a obtenu un classement officiel en étoiles. Au micro-BIC, il garde un abattement de ${pct(MICRO_BIC.abattement)} jusqu'à ${euros(MICRO_BIC.plafond)} de recettes par an ; non classé, ${pct(MICRO_BIC.abattementTourismeNonClasse)} jusqu'à ${euros(MICRO_BIC.plafondTourismeNonClasse)}.`,
    source: IMPOTS,
  },
  mobilier: {
    terme: 'Mobilier',
    definition: `Les meubles et équipements qu'un logement meublé doit fournir (literie, plaques, réfrigérateur, vaisselle…). Au régime réel, ils s'amortissent sur ${String(R.fiscalite.amortissement.mobilierDureeAnnees)} ans.`,
    source: SERVICE_PUBLIC,
  },
  negociation: {
    terme: 'Négociation',
    definition:
      'La remise obtenue sur le prix affiché. Tout le calcul (frais de notaire, prêt, rendement) se fait sur le prix après négociation.',
  },
  plafondEncadrement: {
    terme: "Plafond d'encadrement",
    definition:
      'Dans les villes où les loyers sont encadrés (Paris, Lyon, Lille, Bordeaux…), le loyer maximum fixé par arrêté selon le quartier, le nombre de pièces et l’époque de construction.',
    source: SERVICE_PUBLIC,
  },
  plateforme: {
    terme: 'Commission de la plateforme',
    definition:
      'Les frais que prélèvent Airbnb, Booking ou Abritel sur chaque réservation, en pourcentage des recettes.',
  },
  pno: {
    terme: 'Assurance propriétaire',
    definition:
      "L'assurance « propriétaire non occupant » : elle couvre le logement quand il est vide ou quand l'assurance du locataire ne joue pas. Obligatoire en copropriété.",
    source: SERVICE_PUBLIC,
  },
  prelevementsSociaux: {
    terme: 'Prélèvements sociaux',
    definition: `CSG, CRDS et autres contributions prélevées en plus de l'impôt sur le revenu : ${pct(PS.foncier)} sur les loyers d'une location nue, ${pct(PS.bic)} sur ceux d'un meublé${mentionAConfirmer(R, 'fiscalite.prelevementsSociaux.bic')}.`,
    source: IMPOTS,
  },
  regimeFiscal: {
    terme: 'Régime fiscal',
    definition: `La façon de déclarer les loyers. Au micro (micro-BIC en meublé, micro-foncier en nu), un abattement forfaitaire de ${pct(MICRO_BIC.abattement)} ou ${pct(R.fiscalite.microFoncier.abattement)}. Au réel, vous déduisez les vraies charges, les intérêts et, en meublé (LMNP), l'amortissement du bien.`,
    source: IMPOTS,
  },
  renovationEnergetique: {
    terme: 'Rénovation énergétique',
    definition: `Des travaux qui font sortir le logement des classes E, F ou G. En location nue au réel, le déficit foncier déductible de vos revenus passe de ${euros(DEFICIT.plafondRevenuGlobal)} à ${euros(DEFICIT.plafondRenovationEnergetique)} par an.`,
    source: IMPOTS,
  },
  tauxNominal: {
    terme: 'Taux nominal',
    definition:
      "Le taux d'intérêt du prêt seul, sans l'assurance ni les frais. Le TAEG, lui, les inclut : c'est lui qui permet de comparer deux offres.",
    source: BANQUE_DE_FRANCE,
  },
  tmi: {
    terme: "Tranche d'imposition",
    definition:
      "Le taux d'impôt appliqué à la partie la plus haute de vos revenus. Il figure sur votre avis d'impôt sur le revenu, sous le nom « taux marginal d'imposition ».",
    source: IMPOTS,
  },
  vacance: {
    terme: 'Vacance',
    definition: `Le temps pendant lequel le logement n'est pas loué, entre deux locataires ; compté ici en semaines par an (${String(R.exploitation.parType.nu.vacanceSemaines)} semaines par défaut en location nue).`,
  },
  venduLoue: {
    terme: 'Vendu loué',
    definition: `Le logement est vendu avec son locataire : le bail continue et les loyers arrivent tout de suite, mais vous ne choisissez ni le locataire ni le loyer. Deklic retire ${pct(-R.estimation.occupation)} à l'estimation du prix.`,
    source: SERVICE_PUBLIC,
  },
};

/** Le texte de la bulle : la définition, puis sa source. */
export function texteDuTerme(code: CodeTerme): string {
  const { definition, source } = GLOSSAIRE[code];
  return source === undefined ? definition : `${definition} Source : ${source.nom}.`;
}
