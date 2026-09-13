import { describe, expect, it } from 'vitest';

import { MOTIFS_PORTAILS, PORTAILS, PortailSchema, resoudreAnnonce } from '../src';

describe('resoudreAnnonce', () => {
  it('reconnaît les cinq portails et retire les paramètres de suivi et le fragment', () => {
    expect(
      resoudreAnnonce(
        'https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851?utm_source=partage#photos',
      ),
    ).toEqual({
      portail: 'leboncoin',
      id: '2214738851',
      urlCanonique: 'https://www.leboncoin.fr/ad/ventes_immobilieres/2214738851',
    });
    expect(
      resoudreAnnonce('https://www.pap.fr/annonces/appartement-marseille-13005-r456789012'),
    ).toMatchObject({ portail: 'pap', id: '456789012' });
  });

  it('SeLoger et Logic-Immo : identifiants alphanumériques relevés le 13/09/2026, et anciennes adresses', () => {
    expect(
      resoudreAnnonce(
        'https://www.seloger.com/annonce/achat/provence-alpes-cote-d-azur/bouches-du-rhone-13/marseille-13000/26FZC3J4KETZ?tracking=1',
      ),
    ).toEqual({
      portail: 'seloger',
      id: '26FZC3J4KETZ',
      urlCanonique:
        'https://www.seloger.com/annonce/achat/provence-alpes-cote-d-azur/bouches-du-rhone-13/marseille-13000/26FZC3J4KETZ',
    });
    expect(resoudreAnnonce('https://www.seloger.com/annonce/269JP5VJH16J')).toMatchObject({
      portail: 'seloger',
      id: '269JP5VJH16J',
    });
    expect(
      resoudreAnnonce(
        'https://www.seloger.com/annonces/achat/appartement/marseille-13/baille/234567890.htm',
      ),
    ).toMatchObject({ portail: 'seloger', id: '234567890' });
    expect(
      resoudreAnnonce(
        'https://www.logic-immo.com/detail-annonce/vente/provence-alpes-cote-d-azur/bouches-du-rhone-13/marseille-13000/262H71INQG69',
      ),
    ).toMatchObject({ portail: 'logicimmo', id: '262H71INQG69' });
    expect(resoudreAnnonce('https://www.logic-immo.com/detail-vente-1234567.htm')).toMatchObject({
      portail: 'logicimmo',
      id: '1234567',
    });
  });

  it('Bien’ici : identifiants avec tirets, points ou soulignés', () => {
    expect(
      resoudreAnnonce(
        'https://www.bienici.com/annonce/vente/marseille-5e/appartement/3pieces/ag13-123456',
      ),
    ).toMatchObject({ portail: 'bienici', id: 'ag13-123456' });
    expect(
      resoudreAnnonce(
        'https://www.bienici.com/annonce/vente/troyes/appartement/3pieces/visiteonline-p_6307171',
      ),
    ).toMatchObject({ portail: 'bienici', id: 'visiteonline-p_6307171' });
  });

  it('accepte les espaces autour de l’URL et les sous-domaines', () => {
    expect(resoudreAnnonce('  https://m.leboncoin.fr/ad/ventes_immobilieres/2214738851  ')).toEqual(
      {
        portail: 'leboncoin',
        id: '2214738851',
        urlCanonique: 'https://m.leboncoin.fr/ad/ventes_immobilieres/2214738851',
      },
    );
  });

  it('rend null pour un texte qui n’est pas une URL, un site inconnu, un domaine sosie ou une page sans identifiant', () => {
    expect(resoudreAnnonce('pas une url')).toBeNull();
    expect(resoudreAnnonce('')).toBeNull();
    expect(resoudreAnnonce('https://www.exemple.fr/annonce/123456')).toBeNull();
    expect(resoudreAnnonce('https://www.leboncoin.fr.exemple.fr/ad/123456789')).toBeNull();
    expect(resoudreAnnonce('https://www.leboncoin.fr/recherche?category=9')).toBeNull();
    expect(resoudreAnnonce('https://www.seloger.com/annonces/achat/liste.htm')).toBeNull();
    expect(
      resoudreAnnonce(
        'https://www.seloger.com/recherche/achat/appartement/provence-alpes-cote-d-azur/marseille-13000/ad08fr4491',
      ),
    ).toBeNull();
    expect(resoudreAnnonce('https://www.bienici.com/annonce/vente')).toBeNull();
    expect(resoudreAnnonce('https://www.logic-immo.com/classified-search')).toBeNull();
  });
});

describe('PortailSchema, PORTAILS, MOTIFS_PORTAILS', () => {
  it('énumère exactement les portails pris en charge, chacun avec son domaine et son motif d’hôte', () => {
    expect(PortailSchema.options).toEqual(['leboncoin', 'seloger', 'bienici', 'pap', 'logicimmo']);
    expect(Object.keys(PORTAILS)).toEqual(PortailSchema.options);
    expect(Object.keys(MOTIFS_PORTAILS)).toEqual(PortailSchema.options);
    expect(PORTAILS.logicimmo).toBe('logic-immo.com');
    expect(MOTIFS_PORTAILS.bienici).toBe('*://*.bienici.com/*');
    expect(PortailSchema.safeParse('figaroimmo').success).toBe(false);
  });
});
