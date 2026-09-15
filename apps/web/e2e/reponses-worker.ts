import type { Page, Route } from '@playwright/test';

/*
 * Réponses simulées du Worker d'enrichissement pour l'onglet Estimation d'un projet dont l'adresse est
 * connue : ventes autour de l'adresse (tendance, ventes proches), loyer de marché, DPE et risques.
 * Libellés longs et tableaux remplis : l'écran est mesuré dans son état le plus chargé.
 */

const LICENCE = 'Licence Ouverte 2.0';

const STATISTIQUES = {
  ventes: 18,
  medianeM2: 3_640,
  q1M2: 3_310,
  q3M2: 3_980,
  minM2: 2_850,
  maxM2: 4_720,
};

const PERIODES = [
  '2021-S2',
  '2022-S1',
  '2022-S2',
  '2023-S1',
  '2023-S2',
  '2024-S1',
  '2024-S2',
  '2025-S1',
];

/**
 * 24 ventes à moins de 300 m, en spirale autour du bien, prix de part et d'autre des quartiles ; les trois premières
 * dans l'immeuble du bien, aux mêmes coordonnées (une pastille chiffrée sur la carte). Sept à 100 m au plus.
 */
const VENTES = Array.from({ length: 24 }, (_, i) => {
  const tour = i < 3 ? 0 : i;
  return {
    lat: Math.round((43.294813 + Math.cos(tour) * (0.0003 + tour * 0.0001)) * 1e6) / 1e6,
    lon: Math.round((5.393807 + Math.sin(tour) * (0.0004 + tour * 0.00012)) * 1e6) / 1e6,
    date: `2025-0${String(1 + (i % 9))}-15`,
    prix: 170_000 + i * 4_000,
    surface: 50 + (i % 20),
    prixM2Corrige: 3_150 + i * 40,
    distanceMetres: 30 + i * 11,
    groupes: i < 3 ? ['meme_parcelle', 'rayon_100'] : ['rayon_300'],
  };
});

const ANALYSE = {
  codeInsee: '13205',
  millesime: '2025',
  parcelle: '13205000AB0144',
  parcellesVoisines: ['13205000AB0143', '13205000AB0145'],
  cadastre: 'ok',
  ventesCommune: 1_284,
  groupes: [
    { code: 'meme_parcelle', ventes: 2, comparables: 1, statistiques: null, distanceMaxMetres: 0 },
    {
      code: 'rayon_100',
      ventes: 9,
      comparables: 7,
      statistiques: { ...STATISTIQUES, ventes: 7 },
      distanceMaxMetres: 96,
    },
    {
      code: 'rayon_200',
      ventes: 21,
      comparables: 18,
      statistiques: STATISTIQUES,
      distanceMaxMetres: 198,
    },
    {
      code: 'rayon_300',
      ventes: 44,
      comparables: 37,
      statistiques: { ...STATISTIQUES, ventes: 37, medianeM2: 3_590 },
      distanceMaxMetres: 297,
    },
  ],
  reference: {
    code: 'rayon_200',
    rayonMetres: 198,
    statistiques: STATISTIQUES,
    dateMediane: '2025-04-15',
    periode: { debut: '2025-01-15', fin: '2025-08-15' },
    ancienneteMedianeMois: 17,
  },
  ventesProches: VENTES.map((v, i) => ({
    date: v.date,
    prix: v.prix,
    surface: v.surface,
    prixM2: Math.round(v.prix / v.surface),
    prixM2Actualise: v.prixM2Corrige,
    coefficient: 1.017,
    prixM2Corrige: v.prixM2Corrige,
    correctionSurface: 1,
    pieces: 2 + (i % 3),
    type: 'appartement',
    adresse:
      i < 3
        ? "144 rue de l'Olivier, résidence Les Jardins des Cinq-Avenues"
        : `${String(120 + i * 2)} rue de l'Olivier, résidence Les Jardins des Cinq-Avenues`,
    distanceMetres: v.distanceMetres,
    groupes: v.groupes,
    carrez: v.surface - 1.5,
    parcelle: '13205000AB0144',
    dependances: i % 5 === 0 ? 1 : 0,
    terrain: null,
    lots: 2,
    dpe:
      i % 4 === 0
        ? {
            etiquetteDpe: i % 8 === 0 ? 'D' : 'F',
            etiquetteGes: 'C',
            consommationM2: 240,
            periodeConstruction: '1948-1974',
            energieChauffage: 'Gaz naturel',
            date: '2024-11-02',
            surface: v.surface,
          }
        : null,
  })),
  ventesProchesTotal: 24,
  ventesProchesTronquees: false,
  dpeVentes: 'ok',
  // Les mêmes ventes sur la carte (même clé date · prix · surface · distance).
  ventesCarte: VENTES,
  tendance: {
    zone: 'commune',
    periodeReference: '2025-S1',
    evolution1an: 0.021,
    evolution2ans: -0.034,
    points: PERIODES.map((periode, i) => ({
      periode,
      ventes: 610 + i * 12,
      medianeM2: 3_420 + i * 35,
      indice: 96 + i * 1.1,
    })),
  },
  communesVoisines: [
    { codeInsee: '13204', ventes: 12 },
    { codeInsee: '13206', ventes: 9 },
  ],
  sources: [
    {
      nom: 'Demandes de valeurs foncières (DGFiP)',
      url: 'https://www.data.gouv.fr',
      licence: LICENCE,
    },
    { nom: 'Cadastre (IGN)', url: 'https://cadastre.data.gouv.fr', licence: LICENCE },
  ],
};

const MARCHE = {
  codeInsee: '13205',
  commune: 'Marseille 5e Arrondissement',
  dvf: {
    ventes: 1_284,
    medianeM2: 3_520,
    q1M2: 3_050,
    q3M2: 4_010,
    fenetre: { debut: '2024-01-01', fin: '2025-12-31' },
    dateMediane: '2025-01-13',
    ancienneteMedianeMois: 20,
  },
  loyer: { loyerM2: 14.6, basM2: 11.9, hautM2: 18.2, observations: 347 },
  zone: 'A',
  sources: [
    {
      nom: 'Carte des loyers',
      url: 'https://www.ecologie.gouv.fr/carte-des-loyers',
      licence: 'CC-BY',
      mention: 'Estimations ANIL, à partir des annonces du Groupe SeLoger et de leboncoin.',
    },
  ],
};

const DPE = [
  {
    numero: '2513E0123456A',
    date: '2025-03-12',
    finValidite: '2035-03-11',
    etiquetteDpe: 'D',
    etiquetteGes: 'B',
    typeBatiment: 'appartement',
    surface: 64.8,
    etage: 3,
    complement: 'Bâtiment B, 3e étage, porte gauche',
    cleBan: '13205_6659_00144',
    anneeConstruction: 1968,
    distanceMetres: 0,
  },
  {
    numero: '2413E0987654B',
    date: '2024-06-02',
    finValidite: '2034-06-01',
    etiquetteDpe: 'E',
    etiquetteGes: 'C',
    typeBatiment: 'appartement',
    surface: 71.2,
    etage: 4,
    complement: 'Bâtiment B, 4e étage',
    cleBan: '13205_6659_00144',
    anneeConstruction: 1968,
    distanceMetres: 0,
  },
  {
    numero: '2113E0555555C',
    date: '2021-01-20',
    finValidite: '2024-12-31',
    etiquetteDpe: 'F',
    etiquetteGes: null,
    typeBatiment: 'appartement',
    surface: 48.5,
    etage: 1,
    complement: null,
    cleBan: '13205_6659_00146',
    anneeConstruction: null,
    distanceMetres: 18,
  },
];

const RISQUES = {
  url: 'https://www.georisques.gouv.fr/mes-risques/connaitre-les-risques-pres-de-chez-moi',
  risques: [
    {
      code: 'retraitGonflementArgile',
      famille: 'naturel',
      libelle: 'Retrait-gonflement des sols argileux',
      adresse: 'moyen',
      commune: 'fort',
    },
    { code: 'seisme', famille: 'naturel', libelle: 'Séisme', adresse: 'faible', commune: 'faible' },
    {
      code: 'inondation',
      famille: 'naturel',
      libelle: 'Inondation par ruissellement et coulée de boue',
      adresse: 'inconnu',
      commune: 'moyen',
    },
    { code: 'radon', famille: 'naturel', libelle: 'Radon', adresse: 'faible', commune: 'faible' },
    {
      code: 'icpe',
      famille: 'technologique',
      libelle: 'Installations industrielles classées (ICPE)',
      adresse: 'absent',
      commune: 'moyen',
    },
    {
      code: 'tmd',
      famille: 'technologique',
      libelle: 'Transport de marchandises dangereuses',
      adresse: 'absent',
      commune: 'fort',
    },
  ],
};

/** Chemin du Worker → corps de la réponse (mêmes formes que `enrichissement/contrat.ts`). */
const REPONSES = new Map<string, unknown>([
  ['/marche/adresse', ANALYSE],
  ['/marche', MARCHE],
  ['/proxy/dpe', { donnees: { dpe: DPE } }],
  ['/proxy/risques', { donnees: RISQUES }],
]);

/** L'adresse du projet copié par la spec des formats : l'onglet Estimation l'analyse à l'ouverture. */
export const ADRESSE_SIMULEE = {
  libelle: "144 Rue de l'Olivier 13005 Marseille",
  lat: 43.294813,
  lon: 5.393807,
  codeInsee: '13205',
  codeVoie: '6659',
  numero: 144,
  codePostal: '13005',
};

/** Répond à la place du Worker ; l'application l'appelle depuis une autre origine (CORS). */
/** Une tuile PNG transparente de 1 × 1 px : les tuiles IGN ne sont jamais demandées au vrai service en test. */
export const TUILE_VIDE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
  'base64',
);

export const HOTE_TUILES_IGN = 'data.geopf.fr';

export async function simulerWorker(page: Page): Promise<void> {
  await page.route(
    (url) => url.hostname === HOTE_TUILES_IGN,
    (route: Route) => route.fulfill({ contentType: 'image/png', body: TUILE_VIDE }),
  );
  await page.route(
    (url) => REPONSES.has(url.pathname),
    (route: Route) =>
      route.fulfill({
        json: REPONSES.get(new URL(route.request().url()).pathname),
        headers: { 'access-control-allow-origin': '*' },
      }),
  );
}
