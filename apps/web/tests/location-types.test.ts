import { ProjetSchema, projetExemple, type ProjetEntree } from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import { construireProjet, extraireChamps, type SaisieProjet } from '@/annonces';
import { valider, valeursDepuisChamps, versSaisie } from '@/ecrans/formulaire/valeurs';
import {
  appliquerLoyerVise,
  fusionnerChamps,
  loyerParChambre,
  loyerPourBien,
  type ChampsIa,
} from '@/enrichissement';
import { appliquerSaisie, descripteurParChemin } from '@/hypotheses';

/** Une réponse du modèle qui n'a rien trouvé. */
const CHAMPS_IA_VIDES: ChampsIa = {
  prix: null,
  surface: null,
  pieces: null,
  chambres: null,
  etage: null,
  ascenseur: null,
  dpe: null,
  codePostal: null,
  ville: null,
  annee: null,
  chargesCoproMois: null,
  taxeFonciere: null,
  honorairesAgence: null,
  meuble: null,
};
import { decoderPartage, encoderPartage } from '@/stockage/partage';
import {
  CLE_STOCKAGE,
  creerProjet,
  lireProjets,
  migrerEnregistre,
  type ProjetEnregistre,
} from '@/stockage/projets';

const DATE = '2026-09-13T10:00:00.000Z';

/** Un projet tel que l'application l'enregistrait avant les cinq types (format figé). */
function ancienEnregistre(location: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'ancien',
    nom: 'T3 · 65 m² · Marseille 5e',
    statut: 'visite',
    creeLe: DATE,
    modifieLe: DATE,
    projet: {
      ...projetExemple,
      id: 'ancien',
      hypotheses: { ...projetExemple.hypotheses, location },
    },
  };
}

const ANCIEN_MEUBLE = ancienEnregistre({
  mode: 'meuble_lld',
  loyerHc: 980,
  loyerHcNu: 850,
  chargesLocataire: 60,
  vacanceSemaines: 3,
  gestionTaux: 0,
});

const ANCIENNE_COURTE_DUREE = ancienEnregistre({
  mode: 'courte_duree',
  loyerHc: 0,
  vacanceSemaines: 3,
  gestionTaux: 0,
  courteDuree: { nuitee: 75, tauxOccupation: 0.6, fraisMenageParNuit: 15, conciergerieTaux: 0.2 },
});

function stockage(): Storage {
  window.localStorage.clear();
  return window.localStorage;
}

describe('migration des projets enregistrés', () => {
  it('lit une liste enregistrée avant les cinq types : « meuble_lld » et l’ancienne courte durée', () => {
    const s = stockage();
    s.setItem(CLE_STOCKAGE, JSON.stringify([ANCIEN_MEUBLE, ANCIENNE_COURTE_DUREE]));
    const lus = lireProjets(s);
    expect(lus).toHaveLength(2);
    expect(lus[0]?.projet.hypotheses.location).toMatchObject({ mode: 'meuble', loyerHc: 980 });
    expect(lus[1]?.projet.hypotheses.location).toMatchObject({
      mode: 'courte_duree',
      nuitee: 75,
      nuiteesParMois: 18.3,
      menageCoutParSejour: 60,
      conciergerieTaux: 0.2,
    });
  });

  it('lit un lien de partage émis avant les cinq types', () => {
    const texte = encoderPartage(ANCIEN_MEUBLE as unknown as ProjetEnregistre);
    const retour = decoderPartage(texte);
    expect(retour.ok).toBe(true);
    if (retour.ok) {
      expect(retour.enregistre.projet.hypotheses.location).toMatchObject({ mode: 'meuble' });
    }
  });

  it('migrerEnregistre laisse passer ce qui n’est pas un projet enregistré', () => {
    expect(migrerEnregistre(null)).toBeNull();
    expect(migrerEnregistre([1])).toEqual([1]);
    expect(migrerEnregistre({ id: 'x' })).toEqual({ id: 'x' });
    const courant = creerProjet({ genererId: () => 'c', maintenant: () => DATE });
    expect(migrerEnregistre(courant)).toEqual(courant);
  });
});

describe('loyer de marché par type', () => {
  // ANIL 15 €/m² charges comprises → 13,80 €/m² hors charges × 65 m² = 897 € ; meublé +15 % = 1 032 €.
  const loyer = loyerPourBien({ loyerM2: 15, basM2: 12, hautM2: 19, observations: 100 }, 65, 0.15);
  const avec = (
    location: (typeof projetExemple)['hypotheses']['location'],
  ): ReturnType<typeof ProjetSchema.parse> =>
    ProjetSchema.parse({
      ...projetExemple,
      hypotheses: { ...projetExemple.hypotheses, location },
    });

  it('en colocation : loyer meublé × (1 + prime colocation) ÷ chambres, provenance ANIL', () => {
    expect(loyerParChambre(loyer, 3, 0.35)).toBe(Math.round((1032 * 1.35) / 3));
    expect(loyerParChambre(loyer, 0, 0.35)).toBe(Math.round(1032 * 1.35));
    const coloc = appliquerLoyerVise(
      avec({ mode: 'colocation', chambres: 3, loyerChambre: 400 }),
      loyer,
    );
    expect(coloc.hypotheses.location).toMatchObject({ chambres: 3, loyerChambre: 464 });
    expect(coloc.provenance['location.loyerChambre']).toBe('anil');
  });

  it('en moyenne durée : le loyer meublé ; en courte durée : rien à appliquer', () => {
    const md = appliquerLoyerVise(avec({ mode: 'moyenne_duree', loyerHc: 700 }), loyer);
    expect(md.hypotheses.location).toMatchObject({ mode: 'moyenne_duree', loyerHc: 1032 });
    const cd = avec({ mode: 'courte_duree', nuitee: 80, nuiteesParMois: 15 });
    expect(appliquerLoyerVise(cd, loyer)).toBe(cd);
  });
});

describe('changer de type sur un projet minimal', () => {
  const mode = descripteurParChemin('hypotheses.location.mode');
  const { achat, pret, location, fiscalite, revente, revenusMensuels } = projetExemple.hypotheses;
  const hypotheses: ProjetEntree['hypotheses'] = {
    achat,
    pret,
    location,
    fiscalite,
    revenusMensuels,
    ...(revente === undefined ? {} : { revente }),
  };

  it('sans charges, sans provenance, sans chambres : chambres = pièces − 1, abonnements des règles', () => {
    const minimal: ProjetEntree = {
      id: projetExemple.id,
      versionRegles: projetExemple.versionRegles,
      bien: { type: 'appartement', surface: 65, pieces: 3, departement: '13' },
      hypotheses,
    };
    const r = appliquerSaisie(minimal, mode, 'colocation');
    if (!r.ok) throw new Error(r.erreur);
    expect(r.projet.hypotheses.location).toMatchObject({ mode: 'colocation', chambres: 2 });
    expect(r.projet.hypotheses.charges).toEqual({ energieMensuel: 190, internetMensuel: 30 });
    expect(r.projet.provenance).toMatchObject({ 'charges.energieMensuel': 'estime' });
    expect(ProjetSchema.safeParse(r.projet).success).toBe(true);
  });

  it('un abonnement « à toi » sans montant enregistré reste à 0', () => {
    const aToi: ProjetEntree = {
      ...projetExemple,
      hypotheses,
      provenance: { 'charges.internetMensuel': 'utilisateur' },
    };
    const r = appliquerSaisie(aToi, mode, 'courte_duree');
    if (!r.ok) throw new Error(r.erreur);
    expect(r.projet.hypotheses.charges).toEqual({ energieMensuel: 190, internetMensuel: 0 });
    expect(r.projet.provenance).toMatchObject({ 'charges.internetMensuel': 'utilisateur' });
  });
});

describe('lecture et construction : cas limites', () => {
  it('une liste enregistrée qui n’est pas un tableau donne une liste vide', () => {
    const s = stockage();
    s.setItem(CLE_STOCKAGE, JSON.stringify({ projets: [ANCIEN_MEUBLE] }));
    expect(lireProjets(s)).toEqual([]);
  });

  it('le type lu dans l’annonce garde sa provenance « annonce »', () => {
    const saisie: SaisieProjet = {
      prix: 155_000,
      surface: 65,
      codePostal: '13005',
      ville: 'Marseille',
      mode: 'colocation',
      loyerHc: 1_840,
      apport: 15_000,
      dureeAnnees: 25,
      tmi: 0.3,
      provenance: { mode: 'annonce' },
    };
    expect(construireProjet(saisie, 'p').provenance?.['location.mode']).toBe('annonce');
  });
});

describe('lecture du type de location dans l’annonce', () => {
  it('par règles : du plus précis au plus général', () => {
    expect(extraireChamps('T4 meublé idéal colocation, 3 chambres').mode).toBe('colocation');
    expect(extraireChamps('Studio meublé loué en bail mobilité à des étudiants').mode).toBe(
      'moyenne_duree',
    );
    expect(extraireChamps('Studio meublé, idéal Airbnb, proche plage').mode).toBe('courte_duree');
    expect(extraireChamps('Appartement vendu loué en location saisonnière').mode).toBe(
      'courte_duree',
    );
    expect(extraireChamps('T2 loué meublé à l’année').mode).toBe('meuble');
    expect(extraireChamps('T2 vendu libre, lumineux').mode).toBeUndefined();
  });

  it('par l’IA : le type du modèle remplace celui des règles ; absent ou null, les règles restent', () => {
    const base = { ...CHAMPS_IA_VIDES, typeLocation: 'courte_duree' as const };
    expect(fusionnerChamps({ mode: 'meuble' }, base).mode).toBe('courte_duree');
    expect(fusionnerChamps({ mode: 'meuble' }, { ...base, typeLocation: null }).mode).toBe(
      'meuble',
    );
    // Réponse mise en cache avant le prompt v3 : pas de typeLocation du tout.
    expect(fusionnerChamps({ mode: 'colocation' }, CHAMPS_IA_VIDES).mode).toBe('colocation');
  });

  it('pré-remplit le type de Vérifier, « meublé » seul donnant une location meublée', () => {
    expect(valeursDepuisChamps({ mode: 'colocation' })).toMatchObject({
      valeurs: { mode: 'colocation' },
      provenance: { mode: 'annonce' },
    });
    expect(valeursDepuisChamps({ meuble: true }).valeurs.mode).toBe('meuble');
    expect(valeursDepuisChamps({ meuble: false }).provenance.mode).toBeUndefined();
  });
});

describe('formulaire Vérifier : champs et saisie par type', () => {
  const base = {
    ...valeursDepuisChamps({}).valeurs,
    prix: '120000',
    surface: '60',
    codePostal: '13002',
    ville: 'Marseille',
    apport: '10000',
  };

  it('valide les champs de loyer du type choisi : vides permis, mal remplis signalés', () => {
    expect(valider({ ...base, mode: 'meuble' })).toEqual({});
    expect(valider({ ...base, mode: 'meuble', loyerHc: 'abc' })).toEqual({
      loyerHc: 'Nombre attendu.',
    });
    expect(
      valider({ ...base, mode: 'colocation', chambresLouees: '0', loyerChambre: '-5' }),
    ).toEqual({
      chambresLouees: 'Entre 1 et 20 chambres, ou rien.',
      loyerChambre: 'Un montant positif, ou rien.',
    });
    expect(valider({ ...base, mode: 'colocation', chambresLouees: '', loyerChambre: '' })).toEqual(
      {},
    );
    expect(valider({ ...base, mode: 'courte_duree', nuitee: '0', nuiteesParMois: '32' })).toEqual({
      nuitee: 'Un prix positif, ou rien.',
      nuiteesParMois: 'Entre 0 et 31 nuits, ou rien.',
    });
    expect(
      valider({ ...base, mode: 'courte_duree', nuitee: '70', nuiteesParMois: '16', loyerHc: '' }),
    ).toEqual({});
  });

  it('colocation : loyer du logement = chambres × loyer par chambre ; courte durée : nuitée × 30 ÷ 2', () => {
    const coloc = versSaisie(
      { ...base, mode: 'colocation', chambresLouees: '3', loyerChambre: '450', nuitee: '99' },
      {},
      null,
    );
    expect(coloc).toMatchObject({
      mode: 'colocation',
      loyerHc: 1_350,
      chambresLouees: 3,
      loyerChambre: 450,
    });
    expect(coloc.nuitee).toBeUndefined();
    const cd = versSaisie(
      { ...base, mode: 'courte_duree', nuitee: '70', nuiteesParMois: '16' },
      {},
      null,
    );
    expect(cd).toMatchObject({
      mode: 'courte_duree',
      loyerHc: 1_050,
      nuitee: 70,
      nuiteesParMois: 16,
    });
    expect(cd.loyerChambre).toBeUndefined();
    const md = versSaisie({ ...base, mode: 'moyenne_duree', loyerHc: '900' }, {}, null);
    expect(md).toMatchObject({ mode: 'moyenne_duree', loyerHc: 900 });
    const vide = versSaisie({ ...base, mode: 'colocation' }, {}, null);
    // Rien de saisi : pas de loyer, construireProjet prend le loyer de marché s'il le connaît.
    expect(vide.loyerHc).toBeUndefined();
    expect(
      versSaisie({ ...base, mode: 'colocation', chambresLouees: '3' }, {}, null).loyerHc,
    ).toBeUndefined();
    expect(versSaisie({ ...base, mode: 'courte_duree' }, {}, null).loyerHc).toBeUndefined();
    expect(versSaisie({ ...base, mode: 'nu' }, {}, null).loyerHc).toBeUndefined();
  });
});

describe('régimes proposés selon le type', () => {
  it('nue et meublée : les quatre régimes ; colocation, courte et moyenne durée : ceux du meublé', () => {
    const d = descripteurParChemin('hypotheses.fiscalite.regime');
    const garder = d.optionVisibleSi;
    if (garder === undefined) throw new Error('filtre attendu');
    const proposes = (mode: ProjetEntree['hypotheses']['location']['mode']): string[] => {
      const projet = { hypotheses: { location: { mode } } } as unknown as ProjetEntree;
      return (d.options ?? []).filter((o) => garder(o.v, projet)).map((o) => o.v);
    };
    expect(proposes('nu')).toEqual(['lmnp_reel', 'micro_bic', 'nu_reel', 'micro_foncier']);
    expect(proposes('meuble')).toHaveLength(4);
    for (const mode of ['colocation', 'courte_duree', 'moyenne_duree'] as const) {
      expect(proposes(mode)).toEqual(['lmnp_reel', 'micro_bic']);
    }
  });
});
