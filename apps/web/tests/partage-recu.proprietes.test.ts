import { describe, expect, it } from 'vitest';

import {
  LONGUEUR_MAX_TEXTE_PARTAGE,
  PARAMETRES_PARTAGE,
  annoncePartagee,
  lirePartageRecu,
  resoudreAnnonce,
} from '@/annonces';

import { assemblage, tirage } from './tirage';

/** Morceaux d'annonces, de liens, d'encodages et de ponctuation, assemblés au hasard. */
const MORCEAUX = [
  'https://',
  'http://',
  'www.leboncoin.fr/ad/ventes_immobilieres/',
  'www.seloger.com/annonces/achat/appartement/lyon-3eme-69/',
  '2214738851',
  '123456789.htm',
  'exemple.fr/annonce/42',
  ' ',
  '.',
  ',',
  ';',
  ':',
  ')',
  '(',
  '»',
  '!',
  '?',
  '%',
  '%E9',
  '%C3%A9',
  '&',
  '=',
  '#',
  '+',
  'é',
  '€',
  'T3 lumineux',
  '<b>',
  '"',
  "'",
];

const PONCTUATION_FINALE: ReadonlySet<string> = new Set([
  '.',
  ',',
  ';',
  ':',
  '!',
  '?',
  ')',
  ']',
  '}',
  '»',
]);
const NB_CAS = 500;

/** Une adresse brute (parfois mal encodée) ou des paramètres de partage bien formés. */
function rechercheAuHasard(hasard: () => number): string {
  if (hasard() < 0.3) return `?${assemblage(hasard, MORCEAUX, 16)}`;
  const parametres = new URLSearchParams();
  for (const nom of Object.values(PARAMETRES_PARTAGE)) {
    if (hasard() < 0.6) parametres.set(nom, assemblage(hasard, MORCEAUX, 16));
  }
  return `?${parametres.toString()}`;
}

function lienPropre(url: string): boolean {
  return /^https?:\/\/\S+$/.test(url) && !PONCTUATION_FINALE.has(url.slice(-1));
}

describe('partages tirés au hasard', () => {
  it('jamais d’exception ; un lien propre, ou un texte non vide et borné', () => {
    const hasard = tirage(20_260_914);
    const ecarts: string[] = [];
    for (let i = 0; i < NB_CAS; i += 1) {
      const entree = rechercheAuHasard(hasard);
      const recu = lirePartageRecu(entree);
      if (recu.statut === 'recu' && 'url' in recu && !lienPropre(recu.url)) {
        ecarts.push(`lien « ${recu.url} » pour ${entree}`);
      }
      if (
        recu.statut === 'recu' &&
        'texte' in recu &&
        (recu.texte === '' || recu.texte.length > LONGUEUR_MAX_TEXTE_PARTAGE)
      ) {
        ecarts.push(`texte de ${String(recu.texte.length)} caractères pour ${entree}`);
      }
    }
    expect(ecarts).toEqual([]);
  });

  it('Nouveau projet s’ouvre sur le texte seulement avec un lien reconnu ou un texte à lire', () => {
    const hasard = tirage(14_092_026);
    const ecarts: string[] = [];
    for (let i = 0; i < NB_CAS; i += 1) {
      const entree = rechercheAuHasard(hasard);
      const annonce = annoncePartagee(false, entree);
      const lienReconnu = annonce.lien !== null && resoudreAnnonce(annonce.lien) !== null;
      if ((annonce.etape === 'texte') !== (lienReconnu || annonce.texte !== '')) {
        ecarts.push(`étape « ${annonce.etape} » pour ${entree}`);
      }
      if (annoncePartagee(true, entree).recue) ecarts.push(`capture ignorée pour ${entree}`);
    }
    expect(ecarts).toEqual([]);
  });
});
