import type { CodeCritere, ComparaisonOffres, CritereCompare } from '@loupe/moteur';
import { offresIdentiques } from '@loupe/moteur';

import {
  dateCourte,
  euros,
  eurosCentimes,
  eurosSignes,
  nombre,
  pourcentage,
  pourcentageSigne,
} from '@/formatage/nombres';
import type { Descripteur } from '@/hypotheses';

/** Textes du simulateur de prêt ; les chiffres viennent toujours du moteur, jamais recopiés. */
export const TITRES_SIMULATEUR = {
  page: 'Comparer deux offres de prêt',
  chapo:
    "Saisissez le bien financé et une ou deux offres : tout se recalcule à chaque frappe, avec les formules du rapport d'un projet. Rien ne quitte votre navigateur.",
  projet: 'Le projet financé',
  resultats: 'Ce que coûte chaque offre',
  comparaison: 'Laquelle coûte le moins ?',
  tableaux: "Tableaux d'amortissement",
  document: 'Simulation de prêt',
  parametres: 'Les hypothèses',
} as const;

export const BOUTONS_SIMULATEUR = {
  copierLien: 'Copier le lien',
  lienCopie: 'Lien copié',
  imprimer: 'Imprimer',
  imprimerOuPdf: 'Imprimer ou enregistrer en PDF',
  retour: 'Retour au simulateur',
  retirerB: "Retirer l'offre B",
  ajouterB: 'Ajouter une offre B',
  reestimer: 'Ré-estimer',
  telecharger: 'Télécharger le tableau (CSV)',
  voirMois: 'Voir les mois',
  masquerMois: 'Masquer les mois',
} as const;

export const LIBELLES_CRITERES: Readonly<Record<CodeCritere, string>> = {
  mensualiteTotale: 'Mensualité, assurance comprise',
  coutTotalCredit: 'Coût total du crédit',
  totalInterets: 'Total des intérêts',
  totalAssurance: "Total de l'assurance",
  taegHorsAssurance: 'TAEG hors assurance',
  taegAvecAssurance: 'TAEG avec assurance',
  montantEmprunte: 'Montant emprunté',
  dureeAnnees: 'Durée',
  endettement: "Taux d'endettement",
};

/** Résultats d'une offre, dans l'ordre d'affichage. */
export const LIBELLES_RESULTATS = {
  montantEmprunte: 'Montant emprunté',
  mensualiteHorsAssurance: 'Mensualité hors assurance',
  assuranceMensuelle: 'Assurance par mois',
  taegHorsAssurance: 'TAEG hors assurance',
  taegAvecAssurance: 'TAEG avec assurance',
  totalInterets: 'Total des intérêts',
  totalAssurance: "Total de l'assurance",
  fraisBancaires: 'Frais de dossier et de garantie',
  coutTotalCredit: 'Coût total du crédit',
  endettement: "Taux d'endettement (mensualité ÷ revenus)",
  echeancier: 'Échéancier',
} as const;

export const PHRASES_SIMULATEUR = {
  rienAEmprunter: "Rien à emprunter : l'apport couvre tout.",
  corrigez: 'Corrigez les champs en rouge.',
  usure: (taux: number, dateReference: string): string =>
    `au-dessus du taux d'usure (${pourcentage(taux, 2)}, ${dateCourte(dateReference)})`,
  endettementEleve: (seuil: number): string => `au-delà de ${pourcentage(seuil, 0)} : surveiller`,
  lienIllisible: 'Lien illisible : simulation par défaut affichée.',
  identiques: 'Les deux offres sont identiques.',
  dureesDifferentes:
    "Une mensualité plus faible sur une durée plus longue coûte plus d'intérêts : comparez le coût total.",
  meilleure: 'meilleure',
  pasDeTableau: 'Pas de tableau : rien à emprunter.',
  sansComparaison: "Ajoutez une offre B pour comparer, ou corrigez l'offre en erreur.",
  fraisEstimes: 'estimé',
  fraisAToi: 'à toi',
  tauxDuMois: 'taux du mois',
  pied: "Deklic est un outil d'aide à la décision, pas un conseil en investissement ni un conseil financier. Tout est calculé dans le navigateur ; rien n'est envoyé à un serveur.",
} as const;

export const EXPLICATIONS_SIMULATEUR = {
  taeg: "Le TAEG est le taux qui égalise le capital réellement disponible (montant emprunté moins frais de dossier et de garantie) et toutes les mensualités, résolu numériquement. Avec assurance, il ajoute la cotisation mensuelle. C'est le chiffre à comparer entre banques.",
  endettement:
    "Mensualité totale divisée par vos revenus nets, comme le calcule l'ancien simulateur et l'Excel. Un projet locatif utilise un autre taux, l'effort HCSF, qui compte 70 % des loyers attendus : les deux ne sont pas comparables.",
  fraisFinances:
    "Payés à la signature, les frais de dossier et de garantie ne sont pas empruntés ; c'est le cas des offres réelles. « Financés par le prêt », ils s'ajoutent au montant emprunté, comme dans le rapport d'un projet Deklic. Dans les deux cas, le TAEG les compte.",
  assurance:
    "L'assurance est calculée sur le capital initial, chaque mois, pendant toute la durée : c'est la formule la plus courante des banques. Une assurance sur le capital restant dû coûterait moins.",
} as const;

/** Les critères par code : `comparerOffres` les rend toujours tous. */
export function criteresParCode(
  comparaison: ComparaisonOffres,
): Readonly<Record<CodeCritere, CritereCompare>> {
  return Object.fromEntries(comparaison.criteres.map((c) => [c.code, c])) as Record<
    CodeCritere,
    CritereCompare
  >;
}

function ecartAbsolu(c: CritereCompare): string {
  return euros(Math.abs(c.ecart ?? 0));
}

/**
 * La phrase de synthèse sous le tableau de comparaison. Les chiffres viennent de la
 * comparaison (écarts de coût total et de mensualité), les noms sont ceux des offres.
 */
export function phraseSynthese(
  comparaison: ComparaisonOffres,
  noms: readonly [string, string],
): string {
  if (offresIdentiques(comparaison)) return PHRASES_SIMULATEUR.identiques;
  const { coutTotalCredit: cout, mensualiteTotale: mensualite } = criteresParCode(comparaison);
  const nom = (cote: 'a' | 'b'): string => (cote === 'a' ? noms[0] : noms[1]);
  const moinsChere = cout.meilleure;
  const moinsLourde = mensualite.meilleure;

  if (moinsChere === null) {
    return moinsLourde === null
      ? 'Les deux offres se valent sur le coût total et la mensualité.'
      : `${nom(moinsLourde)} a la mensualité la plus basse (${ecartAbsolu(mensualite)} de moins par mois), pour le même coût total.`;
  }
  if (moinsLourde === null) {
    return `${nom(moinsChere)} coûte ${ecartAbsolu(cout)} de moins sur toute la durée, pour la même mensualité.`;
  }
  if (moinsChere !== moinsLourde) {
    return `${nom(moinsLourde)} a la mensualité la plus basse (${ecartAbsolu(mensualite)} de moins par mois), ${nom(moinsChere)} le coût total le plus bas (${ecartAbsolu(cout)} de moins).`;
  }
  return `${nom(moinsChere)} coûte ${ecartAbsolu(cout)} de moins sur toute la durée, pour une mensualité de ${ecartAbsolu(mensualite)} de moins.`;
}

/** Une valeur de critère formatée : euros, pourcentage à deux décimales, années ; « — » si absente. */
export function formaterCritere(code: CodeCritere, valeur: number | null): string {
  if (valeur === null) return '—';
  switch (code) {
    case 'taegHorsAssurance':
    case 'taegAvecAssurance':
      return pourcentage(valeur, 2);
    case 'endettement':
      return pourcentage(valeur, 1);
    case 'dureeAnnees':
      return `${nombre(valeur)} ans`;
    case 'mensualiteTotale':
      return `${eurosCentimes(valeur)}/mois`;
    case 'coutTotalCredit':
    case 'totalInterets':
    case 'totalAssurance':
    case 'montantEmprunte':
      return euros(valeur);
  }
}

/** L'écart a − b, signé ; « — » s'il manque une valeur. */
export function formaterEcart(code: CodeCritere, ecart: number | null): string {
  if (ecart === null) return '—';
  switch (code) {
    case 'taegHorsAssurance':
    case 'taegAvecAssurance':
      return pourcentageSigne(ecart, 2);
    case 'endettement':
      return pourcentageSigne(ecart, 1);
    case 'dureeAnnees':
      return `${ecart > 0 ? '+' : ecart < 0 ? '−' : ''}${nombre(Math.abs(ecart))} ans`;
    case 'mensualiteTotale':
      return `${eurosSignes(ecart)}/mois`;
    case 'coutTotalCredit':
    case 'totalInterets':
    case 'totalAssurance':
    case 'montantEmprunte':
      return eurosSignes(ecart);
  }
}

/** Une hypothèse du document imprimé, formatée d'après son descripteur. */
export function formaterValeur(d: Descripteur, valeur: unknown): string {
  if (valeur === undefined) return '—';
  switch (d.type) {
    case 'euros':
      return euros(Number(valeur));
    case 'pourcent':
      return pourcentage(Number(valeur), 2);
    case 'bool':
      return d.options?.find((o) => o.v === (valeur === true ? 'oui' : 'non'))?.l ?? '—';
    case 'entier':
    case 'nombre':
      return `${nombre(Number(valeur))}${d.unite === undefined ? '' : ` ${d.unite}`}`;
    case 'enum':
    case 'texte':
      return typeof valeur === 'string' ? valeur : '—';
  }
}
