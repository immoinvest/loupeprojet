import { describe, expect, it } from 'vitest';

import {
  cleVente,
  COUCHE_PARCELLES,
  COUCHES_FOND,
  dansLeRayon,
  donneesCarte,
  ETAT_LIAISON_INITIAL,
  eventail,
  filtresActifs,
  glisserActif,
  grouperPoints,
  joursEntre,
  liaisonVentes,
  messageGeste,
  modesCouleur,
  niveauAnciennete,
  niveauDpe,
  niveauPoint,
  pageDeLaVente,
  pointsVisibles,
  RAYON_EVENTAIL_MIN_PX,
  SANS_FILTRE,
  URL_TUILES_IGN,
  ventesVisibles,
  type EtatLiaison,
  type PointCarte,
  type ReponseAdresse,
  type VenteCarte,
  type VenteProcheAdresse,
} from '@/enrichissement';
import {
  ficheVente,
  legendeCouleurs,
  libelleCercle,
  libelleGroupe,
  MESSAGES_GESTES,
} from '@/textes/carte';

const n = (s: string): string => s.replace(/\s/g, ' ');

function proche(i: number, surcharge: Partial<VenteProcheAdresse> = {}): VenteProcheAdresse {
  return {
    date: `2025-0${String((i % 9) + 1)}-15`,
    prix: 200_000 + i * 1_000,
    surface: 50 + i,
    prixM2: 4_000,
    prixM2Corrige: 3_900 + i,
    pieces: 3,
    type: 'appartement',
    adresse: `${String(i)} RUE TEST`,
    distanceMetres: 40 * i,
    groupes: i === 0 ? ['meme_parcelle', 'rayon_100'] : ['rayon_300'],
    ...surcharge,
  };
}

function surCarte(v: VenteProcheAdresse, lat = 43.29, lon = 5.39): VenteCarte {
  return {
    lat,
    lon,
    date: v.date,
    prix: v.prix,
    surface: v.surface,
    prixM2Corrige: v.prixM2Corrige ?? v.prixM2,
    distanceMetres: v.distanceMetres ?? 0,
    groupes: v.groupes,
  };
}

const DPE = {
  etiquetteDpe: 'F',
  etiquetteGes: 'E',
  consommationM2: 300,
  periodeConstruction: null,
  energieChauffage: null,
  date: '2024-01-01',
  surface: 50,
} as const;

const PROCHES = [
  proche(0, { dpe: DPE, carrez: 49.5, dependances: 1, lots: 2 }),
  proche(1),
  proche(2, { dpe: { ...DPE, etiquetteDpe: 'B', etiquetteGes: null } }),
];

const ANALYSE: ReponseAdresse = {
  codeInsee: '13205',
  millesime: '2025',
  parcelle: null,
  parcellesVoisines: [],
  cadastre: 'ok',
  ventesCommune: 10,
  groupes: [],
  reference: null,
  ventesProches: [...PROCHES, PROCHES[0]!],
  sources: [],
  ventesCarte: [
    ...PROCHES.map((v, i) => surCarte(v, 43.29, i === 2 ? 5.39 : 5.3901)),
    // Une vente de la carte absente du tableau.
    { ...surCarte(proche(7)), prix: 1 },
  ],
};

function points(): readonly PointCarte[] {
  const donnees = donneesCarte(ANALYSE);
  if (donnees === null) throw new Error('pas de carte');
  return donnees.points;
}

describe('fonds de carte IGN', () => {
  it('plan, photo aérienne et parcelles cadastrales sur la Géoplateforme, sans clé', () => {
    expect(COUCHES_FOND.plan.url).toBe(URL_TUILES_IGN);
    expect(COUCHES_FOND.photo.url).toContain('LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal');
    expect(COUCHES_FOND.photo.url).toContain('FORMAT=image/jpeg');
    expect(COUCHE_PARCELLES.url).toContain(
      'LAYER=CADASTRALPARCELS.PARCELLAIRE_EXPRESS&STYLE=PCI%20vecteur',
    );
    for (const couche of [COUCHES_FOND.plan, COUCHES_FOND.photo, COUCHE_PARCELLES]) {
      expect(couche.url.startsWith('https://data.geopf.fr/wmts?')).toBe(true);
      expect(couche.url).not.toMatch(/apikey/i);
      expect(couche.attribution).toContain('IGN');
    }
  });
});

describe('rapprochement carte ↔ tableau', () => {
  it('clé : date, prix, surface, distance (vide si inconnue)', () => {
    expect(cleVente(proche(1))).toBe('2025-02-15|201000|51|40');
    expect(cleVente({ ...proche(1), distanceMetres: null })).toBe('2025-02-15|201000|51|');
  });

  it('chaque point porte sa clé et sa ligne du tableau, ou null', () => {
    const [p0, p1, , absente] = points();
    expect(p0?.cle).toBe(cleVente(PROCHES[0]!));
    expect(p0?.vente?.carrez).toBe(49.5);
    expect(p1?.vente?.adresse).toBe('1 RUE TEST');
    expect(absente?.vente).toBeNull();
  });
});

describe('couleurs des pastilles', () => {
  it('ancienneté : moins d’un an, 1 à 3 ans, plus de 3 ans, illisible', () => {
    expect(joursEntre('2025-01-01', '2025-01-31')).toBe(30);
    expect(niveauAnciennete('2024-09-16', '2025-09-15')).toBe('bas');
    expect(niveauAnciennete('2024-09-15', '2025-09-15')).toBe('milieu');
    expect(niveauAnciennete('2022-09-15', '2025-09-14')).toBe('milieu');
    expect(niveauAnciennete('2022-09-14', '2025-09-15')).toBe('haut');
    expect(niveauAnciennete('pas une date', '2025-09-15')).toBe('inconnu');
  });

  it('DPE : A à C, D ou E, F ou G, inconnu', () => {
    expect(['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((e) => niveauDpe(e as 'A'))).toEqual([
      'bas',
      'bas',
      'bas',
      'milieu',
      'milieu',
      'haut',
      'haut',
    ]);
    expect(niveauDpe(null)).toBe('inconnu');
  });

  it('selon le mode, et DPE proposé seulement si une vente en a un', () => {
    const [p0, p1] = points();
    if (p0 === undefined || p1 === undefined) throw new Error('points');
    expect(niveauPoint(p0, 'prix', '2025-09-15')).toBe(p0.classe);
    expect(niveauPoint(p0, 'anciennete', '2025-09-15')).toBe('bas');
    expect(niveauPoint(p0, 'dpe', '2025-09-15')).toBe('haut');
    expect(niveauPoint(p1, 'dpe', '2025-09-15')).toBe('inconnu');
    expect(modesCouleur(points())).toEqual(['prix', 'anciennete', 'dpe']);
    expect(modesCouleur(points().filter((p) => p.vente?.dpe == null))).toEqual([
      'prix',
      'anciennete',
    ]);
  });

  it('légendes', () => {
    expect(legendeCouleurs('prix', { q1M2: 3440, q3M2: 3750 }).map((e) => n(e.libelle))).toEqual([
      'Moins de 3 440 €/m²',
      'Entre 3 440 €/m² et 3 750 €/m²',
      'Plus de 3 750 €/m²',
    ]);
    expect(legendeCouleurs('prix', null)).toEqual([
      { niveau: 'milieu', libelle: 'Ventes comparables' },
    ]);
    expect(legendeCouleurs('anciennete', null).map((e) => e.libelle)).toEqual([
      'Moins d’un an',
      '1 à 3 ans',
      'Plus de 3 ans',
    ]);
    expect(legendeCouleurs('dpe', null).map((e) => e.niveau)).toEqual([
      'bas',
      'milieu',
      'haut',
      'inconnu',
    ]);
  });
});

describe('regroupement au même point', () => {
  it('groupe les coordonnées identiques dans l’ordre d’apparition', () => {
    const groupes = grouperPoints(points());
    expect(groupes.map((g) => [g.cle, g.points.length])).toEqual([
      ['43.29,5.3901', 2],
      ['43.29,5.39', 2],
    ]);
    expect(groupes[0]?.lat).toBe(43.29);
  });

  it('éventail : première pastille en haut, rayon qui grandit avec le nombre', () => {
    const trois = eventail(3);
    expect(trois).toHaveLength(3);
    expect(trois[0]?.x).toBeCloseTo(0);
    expect(trois[0]?.y).toBeCloseTo(-RAYON_EVENTAIL_MIN_PX);
    const trente = eventail(30);
    const rayon = Math.hypot(trente[0]?.x ?? 0, trente[0]?.y ?? 0);
    expect(rayon).toBeGreaterThan(RAYON_EVENTAIL_MIN_PX);
    expect(eventail(0)).toEqual([]);
  });
});

describe('fiche d’une vente', () => {
  it('détails de la ligne du tableau : Carrez, pièces, place, DPE, dépendances', () => {
    const [p0] = points();
    if (p0 === undefined) throw new Error('point');
    const fiche = ficheVente(p0);
    expect(fiche.titre).toBe('Vente du 15 janv. 2025');
    expect(fiche.lignes.map((l) => [l.libelle, n(l.valeur)])).toEqual([
      ['Prix', '200 000 €'],
      ['Surface', '50 m², dont 49,5 m² Carrez · 3 pièces'],
      ['Prix au m²', '4 000 €/m² à la signature'],
      ['Au prix d’aujourd’hui', '3 900 €/m²'],
      ['Distance', '0 m du bien'],
      ['Place', 'Même immeuble'],
      ['DPE probable', 'DPE F, GES E'],
      ['Vendu avec', '1 dépendance vendue avec (cave, parking…) · 2 lots de copropriété'],
    ]);
  });

  it('sans ligne du tableau ni place : jamais de case vide', () => {
    const fiche = ficheVente(points()[3]!);
    expect(fiche.lignes.map((l) => l.libelle)).toEqual([
      'Prix',
      'Surface',
      'Au prix d’aujourd’hui',
      'Distance',
    ]);
    const deuxieme = ficheVente(points()[2]!);
    expect(deuxieme.lignes.find((l) => l.libelle === 'DPE probable')?.valeur).toBe('DPE B');
  });

  it('libellés du regroupement et des cercles', () => {
    expect(libelleGroupe(4)).toBe('4 ventes à cette adresse');
    expect(libelleCercle(100, false)).toBe('Filtrer le tableau à moins de 100 m');
    expect(libelleCercle(300, true)).toBe('Retirer le filtre à moins de 300 m');
  });
});

describe('liaison carte ↔ tableau', () => {
  it('sélection, demandes, filtres, rayon qui se retire au deuxième clic, remise à zéro', () => {
    let etat: EtatLiaison = liaisonVentes(ETAT_LIAISON_INITIAL, {
      type: 'selectionner',
      cle: 'a',
    });
    expect(etat).toMatchObject({ selection: 'a', afficher: null, demande: 0 });
    etat = liaisonVentes(etat, { type: 'voir', cle: 'b', dans: 'tableau' });
    expect(etat).toMatchObject({ selection: 'b', afficher: 'tableau', demande: 1 });
    etat = liaisonVentes(etat, { type: 'voir', cle: 'b', dans: 'carte' });
    expect(etat).toMatchObject({ afficher: 'carte', demande: 2 });
    etat = liaisonVentes(etat, { type: 'filtres', filtres: { ...SANS_FILTRE, recentes: true } });
    expect(etat.filtres.recentes).toBe(true);
    etat = liaisonVentes(etat, { type: 'rayon', rayon: 100 });
    expect(etat.rayon).toBe(100);
    etat = liaisonVentes(etat, { type: 'rayon', rayon: 200 });
    expect(etat.rayon).toBe(200);
    etat = liaisonVentes(etat, { type: 'rayon', rayon: 200 });
    expect(etat.rayon).toBeNull();
    expect(liaisonVentes(etat, { type: 'reinitialiser' })).toBe(ETAT_LIAISON_INITIAL);
  });

  it('rayon : distance au plus, inconnue exclue', () => {
    expect(dansLeRayon(null, null)).toBe(true);
    expect(dansLeRayon(100, 100)).toBe(true);
    expect(dansLeRayon(101, 100)).toBe(false);
    expect(dansLeRayon(null, 300)).toBe(false);
  });

  it('les filtres et le rayon du tableau s’appliquent aux pastilles', () => {
    expect(filtresActifs(ETAT_LIAISON_INITIAL)).toBe(false);
    expect(pointsVisibles(points(), ANALYSE.ventesProches, ETAT_LIAISON_INITIAL, 3)).toHaveLength(
      4,
    );
    const immeuble = { ...ETAT_LIAISON_INITIAL, filtres: { ...SANS_FILTRE, memeImmeuble: true } };
    expect(filtresActifs(immeuble)).toBe(true);
    expect(
      pointsVisibles(points(), ANALYSE.ventesProches, immeuble, 3).map((p) => p.vente?.adresse),
    ).toEqual(['0 RUE TEST']);
    const rayon = { ...ETAT_LIAISON_INITIAL, rayon: 100 as const };
    expect(ventesVisibles([...PROCHES, proche(3)], rayon, 3).map((v) => v.distanceMetres)).toEqual([
      0, 40, 80,
    ]);
    // La vente absente du tableau disparaît dès qu'un filtre est actif.
    expect(pointsVisibles(points(), ANALYSE.ventesProches, rayon, 3)).toHaveLength(3);
  });

  it('page du tableau où se trouve la vente', () => {
    const liste = Array.from({ length: 45 }, (_, i) => proche(i));
    expect(pageDeLaVente(liste, cleVente(proche(0)))).toBe(1);
    expect(pageDeLaVente(liste, cleVente(proche(20)))).toBe(2);
    expect(pageDeLaVente(liste, cleVente(proche(44)), 20)).toBe(3);
    expect(pageDeLaVente(liste, 'absente')).toBeNull();
  });
});

describe('gestes', () => {
  it('molette sans Ctrl, un doigt : message ; Ctrl, deux doigts ou plein écran : la carte les prend', () => {
    expect(messageGeste({ type: 'molette', ctrl: false }, false)).toBe('ctrl');
    expect(messageGeste({ type: 'molette', ctrl: true }, false)).toBeNull();
    expect(messageGeste({ type: 'toucher', doigts: 1 }, false)).toBe('doigts');
    expect(messageGeste({ type: 'toucher', doigts: 2 }, false)).toBeNull();
    expect(messageGeste({ type: 'molette', ctrl: false }, true)).toBeNull();
    expect(messageGeste({ type: 'toucher', doigts: 1 }, true)).toBeNull();
    expect(MESSAGES_GESTES.ctrl).toBe('Ctrl + molette pour zoomer');
  });

  it('glisser : toujours à la souris, au doigt seulement en plein écran', () => {
    expect(glisserActif(false, false)).toBe(true);
    expect(glisserActif(true, false)).toBe(false);
    expect(glisserActif(true, true)).toBe(true);
  });
});
