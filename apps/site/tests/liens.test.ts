import { describe, expect, it } from 'vitest';

import { PARAMETRE_TEXTE, lienAnalyse, liensApplication } from '../src/lib/liens';

describe('liensApplication', () => {
  it('vise l’adresse historique tant que DEKLIC_ORIGINE est absente', () => {
    const liens = liensApplication(undefined);
    expect(liens.origine).toBe('https://loupeprojet.pages.dev');
    expect(liens.connexion).toBe('https://loupeprojet.pages.dev/connexion');
    expect(liens.nouveauProjet).toBe('https://loupeprojet.pages.dev/projets/nouveau');
    expect(liens.gerer).toBe('https://loupeprojet.pages.dev/gerer');
    expect(liens.extension).toBe('https://loupeprojet.pages.dev/extension');
    expect(liens.simulateurPret).toBe('https://loupeprojet.pages.dev/simulateur-pret');
  });

  it('vise app.deklic.pro quand DEKLIC_ORIGINE le dit', () => {
    const liens = liensApplication('https://app.deklic.pro');
    expect(liens.connexion).toBe('https://app.deklic.pro/connexion');
  });

  it.each(['http://app.deklic.pro', 'https://app.deklic.pro/chemin', 'pas une adresse', ''])(
    'ignore une valeur invalide (« %s ») au profit de l’adresse historique',
    (valeur) => {
      expect(liensApplication(valeur).origine).toBe('https://loupeprojet.pages.dev');
    },
  );
});

describe('lienAnalyse', () => {
  it('envoie le texte collé dans le paramètre lu par Nouveau projet, encodé', () => {
    const liens = liensApplication('https://app.deklic.pro');
    const lien = lienAnalyse(
      liens,
      'Regarde https://www.leboncoin.fr/ad/ventes_immobilieres/123 !',
    );
    const url = new URL(lien);
    expect(url.origin + url.pathname).toBe('https://app.deklic.pro/projets/nouveau');
    expect(url.searchParams.get(PARAMETRE_TEXTE)).toBe(
      'Regarde https://www.leboncoin.fr/ad/ventes_immobilieres/123 !',
    );
  });
});
