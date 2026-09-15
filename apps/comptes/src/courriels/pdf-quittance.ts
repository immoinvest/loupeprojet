import type { ContenuDocument } from '@loupe/gestion';

import {
  declaration,
  faitLe,
  locatairesTitre,
  logementEnLettres,
  MENTIONS_DOCUMENT_TEXTES,
  numeroEnLettres,
  paiementEnLettres,
  periodeEnLettres,
  TEXTES_DOCUMENT as D,
  TITRES_DOCUMENT,
} from './document';
import { montant } from './format';
import { couperTexte, ecrirePdf, LARGEUR_A4, type TextePdf, type TraitPdf } from './pdf';

const MARGE = 60;
const DROITE = LARGEUR_A4 - MARGE;
const LARGEUR = DROITE - MARGE;
const HAUT = 780;
const CORPS = 11;
const INTERLIGNE = 1.45;

/** Le PDF d'une quittance ou d'un reçu, dans l'ordre de la page imprimable (`DocumentLoyer`). */
export function pdfDocument(contenu: ContenuDocument): string {
  const textes: TextePdf[] = [];
  const traits: TraitPdf[] = [];
  let y = HAUT;

  const paragraphe = (texte: string, taille = CORPS, gras = false): void => {
    for (const ligne of couperTexte(texte, taille, LARGEUR)) {
      textes.push({ texte: ligne, x: MARGE, y, taille, gras });
      y -= taille * INTERLIGNE;
    }
  };
  const bloc = (titre: string, lignes: readonly string[], grasPremiere = false): void => {
    textes.push({ texte: titre.toUpperCase(), x: MARGE, y, taille: 8, gras: true });
    y -= 14;
    lignes.forEach((ligne, rang) => {
      paragraphe(ligne, CORPS, grasPremiere && rang === 0);
    });
    y -= 8;
  };
  const ligneMontant = (libelle: string, centimes: number, fort = false): void => {
    traits.push({ x1: MARGE, y1: y + 13, x2: DROITE, y2: y + 13 });
    textes.push({ texte: libelle, x: MARGE, y, taille: CORPS, gras: fort });
    textes.push({
      texte: montant(centimes),
      x: DROITE,
      y,
      taille: CORPS,
      gras: fort,
      aDroite: true,
    });
    y -= 22;
  };

  textes.push({ texte: TITRES_DOCUMENT[contenu.type], x: MARGE, y, taille: 22, gras: true });
  textes.push({ texte: numeroEnLettres(contenu.numero), x: DROITE, y, taille: 10, aDroite: true });
  y -= 44;

  bloc(D.bailleur, [contenu.bailleur.nom, contenu.bailleur.adresse], true);
  bloc(
    locatairesTitre(contenu.locataires.length),
    contenu.locataires.map((l) => `${l.prenom} ${l.nom}`),
  );
  bloc(D.logement, [logementEnLettres(contenu.logement)]);
  bloc(D.periode, [periodeEnLettres(contenu.debut, contenu.fin)]);

  y -= 6;
  const quittance = contenu.type === 'quittance';
  ligneMontant(D.loyer, contenu.loyerHorsCharges);
  ligneMontant(D.charges, contenu.charges);
  ligneMontant(D.total, contenu.total, true);
  if (contenu.apl !== undefined) {
    ligneMontant(D.apl, contenu.apl);
    ligneMontant(D.partLocataire, contenu.total - contenu.apl);
  }
  if (!quittance) {
    ligneMontant(D.dejaRecu, contenu.dejaRecu);
    ligneMontant(D.resteDu, contenu.resteDu, true);
  }
  y -= 10;

  bloc(quittance ? D.paiements : D.paiementAtteste, contenu.paiements.map(paiementEnLettres));
  paragraphe(declaration(contenu));
  y -= 4;
  for (const mention of contenu.mentions)
    paragraphe(MENTIONS_DOCUMENT_TEXTES[mention], CORPS, true);
  y -= 12;
  paragraphe(faitLe(contenu.emisLe), 9);
  paragraphe(D.gratuit, 9);

  return ecrirePdf({ textes, traits });
}
