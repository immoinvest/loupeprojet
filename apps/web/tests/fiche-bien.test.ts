import { describe, expect, it } from 'vitest';

import { surUnPortail } from '@/annonces/fiche';
import { libelleChauffage, pastillesFiche, TEXTES_FICHE } from '@/textes/fiche-bien';

describe('libelleChauffage', () => {
  it.each([
    [{ chauffageCollectif: true, chauffageEnergie: 'gaz' as const }, 'Chauffage collectif · gaz'],
    [{ chauffageCollectif: false }, 'Chauffage individuel'],
    [{ chauffageEnergie: 'pompe_a_chaleur' as const }, 'Chauffage pompe à chaleur'],
    [{}, null],
  ])('%o → %s', (fiche, attendu) => {
    expect(libelleChauffage(fiche)).toBe(attendu);
  });
});

describe('pastillesFiche', () => {
  it('une phrase par caractéristique, dans un ordre stable ; seuls les équipements présents', () => {
    const pastilles = pastillesFiche({
      etat: 'bon_etat',
      chauffageCollectif: true,
      chauffageEnergie: 'electricite',
      etagesImmeuble: 7,
      sallesEau: 2,
      balcon: true,
      cave: true,
      interphone: true,
      digicode: false,
      accessiblePmr: true,
      budgetEnergieMin: 941,
      budgetEnergieMax: 1_273,
      consommationEnergie: 245,
      dateDpe: '2022-07-08',
      honorairesACharge: 'vendeur',
      vendeur: 'pro',
      quartier: 'Saint-Roch',
      publieeLe: '2026-08-28',
    });
    expect(pastilles.slice(0, 8)).toEqual([
      'Bon état',
      'Chauffage collectif · électrique',
      'Immeuble de 7 étages',
      "2 salles d'eau",
      'Balcon',
      'Cave',
      'Interphone',
      'Accessible aux personnes à mobilité réduite',
    ]);
    expect(pastilles[8]).toMatch(/^Énergie : 941\s€ à 1\s273\s€ par an$/u);
    expect(pastilles.slice(9, 10)).toEqual(['245 kWh/m²/an']);
    expect(pastilles[10]).toMatch(/^DPE du 8 juil\.? 2022$/);
    expect(pastilles.slice(11, 14)).toEqual([
      'Honoraires à la charge du vendeur',
      'Vendu par un professionnel',
      'Quartier Saint-Roch',
    ]);
    expect(pastilles[14]).toMatch(/^Annonce publiée le 28 août 2026$/);
    expect(pastilles).not.toContain('Digicode');
  });

  it('variantes : un seul budget, honoraires chiffrés ou non, particulier, immeuble et salles d’eau', () => {
    expect(pastillesFiche({ budgetEnergieMin: 900 })[0]).toMatch(
      /^Énergie : environ 900\s€ par an$/u,
    );
    expect(pastillesFiche({ budgetEnergieMax: 1_200 })[0]).toMatch(/environ 1\s200\s€/u);
    expect(pastillesFiche({ honorairesACharge: 'acquereur', honoraires: 6_000 })[0]).toMatch(
      /^Honoraires 6\s000\s€ à la charge de l'acquéreur$/u,
    );
    expect(pastillesFiche({ honorairesACharge: 'acquereur' })).toEqual([
      "Honoraires à la charge de l'acquéreur",
    ]);
    expect(pastillesFiche({ honoraires: 6_000 })).toEqual([]);
    expect(pastillesFiche({ vendeur: 'particulier' })).toEqual(['Vendu par un particulier']);
    expect(pastillesFiche({ etagesImmeuble: 0 })).toEqual(['Immeuble de plain-pied']);
    expect(pastillesFiche({ etagesImmeuble: 1 })).toEqual(['Immeuble de 1 étage']);
    expect(pastillesFiche({ sallesEau: 1 })).toEqual(["1 salle d'eau"]);
    expect(pastillesFiche({ sallesEau: 0 })).toEqual([]);
    expect(pastillesFiche({ etat: 'renove' })).toEqual(['Rénové ou comme neuf']);
    expect(pastillesFiche({})).toEqual([]);
  });

  it('libellés de la carte', () => {
    expect(TEXTES_FICHE.photo(2, 10)).toBe("Photo 2 sur 10 de l'annonce");
    expect(TEXTES_FICHE.voir('pap.fr')).toBe("Voir l'annonce sur pap.fr");
  });
});

describe('surUnPortail', () => {
  it.each<[string, boolean]>([
    ['https://img.leboncoin.fr/api/v1/lbcpb1/images/54/6c/1c.jpg?rule=ad-large', true],
    ['https://mms.seloger.com/2/1/6/b/216b.jpg', true],
    ['https://mms.logic-immo.com/0/3/a/b/03ab.jpg', true],
    ['https://cdn.pap.fr/photos/pap/c9/13/c913-p1.jpg', true],
    ['https://file.bienici.com/photo/hektor-just-immo-8332.jpg', true],
    ['https://www.pap.fr/annonces/appartement-nice-06000-r463902045', true],
    ['http://img.leboncoin.fr/x.jpg', false],
    ['https://traceur.exemple.fr/pixel.gif', false],
    ['https://leboncoin.fr.traceur.exemple/x.jpg', false],
    ['https://faux-leboncoin.fr/x.jpg', false],
    ['javascript:alert(1)', false],
    ['pas une adresse', false],
  ])('%s → %s', (adresse, attendu) => {
    expect(surUnPortail(adresse)).toBe(attendu);
  });
});
