import {
  arrondirCentime,
  type OffrePret,
  type PhaseCredit,
  type ResultatPret,
} from '@loupe/moteur';

/**
 * Le tableau d'amortissement mensuel d'une offre en CSV « à la française » : UTF-8 avec BOM,
 * séparateur « ; », virgule décimale, fins de ligne CRLF. Excel, Numbers et Google Sheets
 * l'ouvrent en colonnes sans assistant.
 */

const BOM = String.fromCharCode(0xfeff);
const SEPARATEUR = ';';
const FIN_DE_LIGNE = '\r\n';

export const EN_TETE_CSV: readonly string[] = [
  'Mois',
  'Année',
  'Phase',
  'Capital restant dû début',
  'Intérêts',
  'Capital remboursé',
  'Mensualité hors assurance',
  'Assurance',
  'Mensualité totale',
  'Capital restant dû fin',
];

/** Libellés fixes : aucun ne contient le séparateur. */
export const LIBELLES_PHASES: Readonly<Record<PhaseCredit, string>> = {
  differe_total: 'Différé total',
  differe_partiel: 'Différé partiel',
  amortissement: 'Amortissement',
};

/** 1234.5 → « 1234,50 » ; −0,001 → « 0,00 ». */
export function centimes(valeur: number): string {
  return arrondirCentime(valeur).toFixed(2).replace('.', ',');
}

export function csvAmortissement(resultat: ResultatPret): string {
  const lignes = resultat.tableau.map((l) =>
    [
      String(l.mois),
      String(l.annee),
      LIBELLES_PHASES[l.phase],
      centimes(l.crdDebut),
      centimes(l.interets),
      centimes(l.capital),
      centimes(l.mensualite),
      centimes(l.assurance),
      centimes(l.mensualite + l.assurance),
      centimes(l.crdFin),
    ].join(SEPARATEUR),
  );
  const capitalRembourse = resultat.tableau.reduce((acc, l) => acc + l.capital, 0);
  const mensualites = resultat.tableau.reduce((acc, l) => acc + l.mensualite, 0);
  const totaux = [
    'Totaux',
    '',
    '',
    '',
    centimes(resultat.totalInterets),
    centimes(capitalRembourse),
    centimes(mensualites),
    centimes(resultat.totalAssurance),
    centimes(resultat.totalMensualites),
    centimes(resultat.tableau.at(-1)?.crdFin ?? 0),
  ].join(SEPARATEUR);
  return `${BOM}${[EN_TETE_CSV.join(SEPARATEUR), ...lignes, totaux].join(FIN_DE_LIGNE)}${FIN_DE_LIGNE}`;
}

/** « Crédit Agricole d'Île-de-France » → « credit-agricole-d-ile-de-france ». */
export function slug(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** « deklic-amortissement-lcl-25-ans-3-30.csv » ; « offre » quand le nom ne donne rien. */
export function nomFichierCsv(offre: OffrePret): string {
  const banque = slug(offre.nom) || 'offre';
  const taux = (offre.tauxNominal * 100).toFixed(2).replace('.', '-');
  return `deklic-amortissement-${banque}-${String(offre.dureeAnnees)}-ans-${taux}.csv`;
}
