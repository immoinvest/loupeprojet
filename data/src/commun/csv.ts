/**
 * Lecture CSV en flux, sans dépendance : les fichiers DVF font des dizaines de Mo par département,
 * on les lit morceau par morceau. Conforme à la RFC 4180 : champs entre guillemets (contenant
 * séparateur, retour à la ligne ou guillemet doublé), fins de ligne LF ou CRLF, BOM UTF-8 ignoré.
 */

import { elementA } from './listes.ts';

const GUILLEMET = 0x22;
const RETOUR_CHARIOT = 0x0d;
const SAUT_DE_LIGNE = 0x0a;
const BOM = 0xfeff;

export type Separateur = ',' | ';';
export type EnregistrementCsv = Readonly<Record<string, string>>;

export class ErreurCsv extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErreurCsv';
  }
}

/** Analyseur incrémental : `alimenter` accepte le texte par morceaux et rend les lignes complètes, `terminer` vide le reste. */
export class AnalyseurCsv {
  private readonly codeSeparateur: number;
  private champ = '';
  private ligne: string[] = [];
  private entreGuillemets = false;
  private guillemetEnAttente = false;
  private premierMorceau = true;

  constructor(separateur: Separateur) {
    this.codeSeparateur = separateur.charCodeAt(0);
  }

  alimenter(texte: string): string[][] {
    const lignes: string[][] = [];
    const longueur = texte.length;
    let i = 0;
    if (this.premierMorceau && longueur > 0) {
      this.premierMorceau = false;
      if (texte.charCodeAt(0) === BOM) {
        i = 1;
      }
    }
    let debut = i;
    while (i < longueur) {
      const code = texte.charCodeAt(i);
      if (this.entreGuillemets) {
        if (this.guillemetEnAttente) {
          this.guillemetEnAttente = false;
          if (code === GUILLEMET) {
            // Guillemet doublé : un guillemet littéral dans le champ.
            this.champ += '"';
            i += 1;
            debut = i;
            continue;
          }
          // Le guillemet précédent fermait le champ : ce caractère est relu hors guillemets.
          this.entreGuillemets = false;
          debut = i;
          continue;
        }
        if (code === GUILLEMET) {
          this.champ += texte.slice(debut, i);
          this.guillemetEnAttente = true;
          debut = i + 1;
        }
        i += 1;
        continue;
      }
      if (code === GUILLEMET && this.champ === '' && debut === i) {
        this.entreGuillemets = true;
        i += 1;
        debut = i;
        continue;
      }
      if (code === this.codeSeparateur) {
        this.ligne.push(this.champ + texte.slice(debut, i));
        this.champ = '';
        i += 1;
        debut = i;
        continue;
      }
      if (code === SAUT_DE_LIGNE) {
        this.terminerLigne(this.champ + texte.slice(debut, i), lignes);
        i += 1;
        debut = i;
        continue;
      }
      if (code === RETOUR_CHARIOT) {
        this.champ += texte.slice(debut, i);
        i += 1;
        debut = i;
        continue;
      }
      i += 1;
    }
    this.champ += texte.slice(debut, longueur);
    return lignes;
  }

  terminer(): string[][] {
    if (this.entreGuillemets && !this.guillemetEnAttente) {
      throw new ErreurCsv('guillemet non fermé en fin de fichier');
    }
    this.entreGuillemets = false;
    this.guillemetEnAttente = false;
    const lignes: string[][] = [];
    this.terminerLigne(this.champ, lignes);
    return lignes;
  }

  private terminerLigne(dernierChamp: string, lignes: string[][]): void {
    this.champ = '';
    if (this.ligne.length === 0 && dernierChamp === '') {
      return; // ligne vide ignorée
    }
    this.ligne.push(dernierChamp);
    lignes.push(this.ligne);
    this.ligne = [];
  }
}

/** Associe une ligne à l'en-tête ; le nombre de champs doit correspondre. */
export function versEnregistrement(
  entete: readonly string[],
  ligne: readonly string[],
): EnregistrementCsv {
  if (ligne.length !== entete.length) {
    throw new ErreurCsv(
      `ligne de ${String(ligne.length)} champs pour un en-tête de ${String(entete.length)}`,
    );
  }
  const enregistrement: Record<string, string> = {};
  ligne.forEach((valeur, index) => {
    enregistrement[elementA(entete, index)] = valeur;
  });
  return enregistrement;
}

/** Valeur d'une colonne, chaîne vide si la colonne manque : évite de propager `undefined` dans les transformations. */
export function champ(enregistrement: EnregistrementCsv, nom: string): string {
  return enregistrement[nom] ?? '';
}

export interface OptionsCsv {
  readonly separateur: Separateur;
}

/** Lit un flux de texte CSV et rend un enregistrement (en-tête → valeur) par ligne de données. */
export async function* lireCsv(
  texte: AsyncIterable<string>,
  options: OptionsCsv,
): AsyncGenerator<EnregistrementCsv> {
  const analyseur = new AnalyseurCsv(options.separateur);
  let entete: readonly string[] | undefined;
  const convertir = (lignes: readonly (readonly string[])[]): EnregistrementCsv[] => {
    const enregistrements: EnregistrementCsv[] = [];
    for (const ligne of lignes) {
      if (entete === undefined) {
        entete = ligne;
      } else {
        enregistrements.push(versEnregistrement(entete, ligne));
      }
    }
    return enregistrements;
  };
  for await (const morceau of texte) {
    yield* convertir(analyseur.alimenter(morceau));
  }
  yield* convertir(analyseur.terminer());
}
