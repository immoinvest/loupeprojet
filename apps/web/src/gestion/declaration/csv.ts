import type { EtatGestion, LigneExport } from '@loupe/gestion';

import { moisEnLettres } from '@/gestion/format';
import { CATEGORIES_TEXTE } from '@/textes/gerer-argent';
import {
  EN_TETE_EXPORT,
  libelleEcheance,
  libelleLoyer,
  TEXTES_EXPORT_ANNEE as T,
} from '@/textes/gerer-declaration';

/**
 * Les mouvements d'une année en CSV « à la française », comme le tableau d'amortissement du
 * simulateur : UTF-8 avec BOM, séparateur « ; », virgule décimale, fins de ligne CRLF (ADR-G38).
 */

const BOM = String.fromCharCode(0xfeff);
const SEPARATEUR = ';';
const FIN_DE_LIGNE = '\r\n';

/** −84 050 centimes → « -840,50 » : pas d'espace de milliers, le tableur lit un nombre. */
export function montantCsv(centimes: number): string {
  const absolu = Math.abs(centimes);
  const signe = centimes < 0 ? '-' : '';
  return `${signe}${String(Math.floor(absolu / 100))},${String(absolu % 100).padStart(2, '0')}`;
}

/** « 2026-03-05 » → « 05/03/2026 ». */
export function dateCsv(jour: string): string {
  return `${jour.slice(8, 10)}/${jour.slice(5, 7)}/${jour.slice(0, 4)}`;
}

/**
 * Une cellule de texte saisi : neutralisée si le tableur pourrait la lire comme une formule
 * (`=`, `+`, `-`, `@`, tabulation, retour chariot en tête), entre guillemets si elle contient le
 * séparateur, un guillemet ou un saut de ligne.
 */
export function celluleTexte(texte: string): string {
  const neutre = /^[=+\-@\t\r]/.test(texte) ? `'${texte}` : texte;
  return /[;"\r\n]/.test(neutre) ? `"${neutre.replace(/"/g, '""')}"` : neutre;
}

type Donnees = Pick<EtatGestion, 'biens' | 'locations' | 'locataires'>;

/** Bien, catégorie, libellé et source d'une ligne, en texte : le CSV et le récapitulatif imprimable. */
export function champsDeLigne(
  ligne: LigneExport,
  donnees: Donnees,
): readonly [bien: string, categorie: string, libelle: string, source: string] {
  const bien =
    ligne.bienId === null
      ? T.tousLesBiens
      : (donnees.biens.find((b) => b.id === ligne.bienId)?.nom ?? '');
  switch (ligne.type) {
    case 'loyer': {
      const location = donnees.locations.find((l) => l.id === ligne.locationId);
      const locataire = donnees.locataires.find((l) => l.id === location?.locataireId);
      const nom = locataire === undefined ? null : `${locataire.prenom} ${locataire.nom}`;
      return [bien, T.loyer, libelleLoyer(moisEnLettres(ligne.periode), nom), T.sourceLoyer];
    }
    case 'depense': {
      const { depense } = ligne;
      const libelle = [depense.libelle, depense.recuperable ? T.recuperable : undefined]
        .filter((x) => x !== undefined)
        .join(' · ');
      return [bien, CATEGORIES_TEXTE[depense.categorie], libelle, T.sourceDepense];
    }
    case 'pret_interets':
    case 'pret_capital':
    case 'pret_assurance': {
      const categorie =
        ligne.type === 'pret_interets'
          ? T.interets
          : ligne.type === 'pret_capital'
            ? T.capital
            : T.assurance;
      return [bien, categorie, libelleEcheance(moisEnLettres(ligne.periode)), T.sourcePret];
    }
  }
}

/** Le texte du fichier : en-tête, puis une ligne par mouvement. */
export function csvDeLAnnee(lignes: readonly LigneExport[], donnees: Donnees): string {
  const corps = lignes.map((ligne) => {
    const [bien, categorie, libelle, source] = champsDeLigne(ligne, donnees);
    return [
      dateCsv(ligne.date),
      celluleTexte(bien),
      categorie,
      celluleTexte(libelle),
      montantCsv(ligne.montant),
      source,
    ].join(SEPARATEUR);
  });
  return `${BOM}${[EN_TETE_EXPORT.join(SEPARATEUR), ...corps].join(FIN_DE_LIGNE)}${FIN_DE_LIGNE}`;
}
