import { describe, expect, it } from 'vitest';

import { TOUS_LES_GROUPES, type Descripteur } from '@/hypotheses';
import {
  BORNES_PAR_DEFAUT,
  DECIMALES_MONTANT,
  commandeDe,
  libelleTuile,
  texteNuits,
  type TypeCommande,
} from '@/hypotheses/commandes';
import { CHAMPS_OFFRE, CHAMPS_PROJET } from '@/simulateur/descripteurs';

const champ = (partiel: Partial<Descripteur>): Descripteur => ({
  chemin: 'x.y',
  libelle: 'Champ',
  type: 'texte',
  ...partiel,
});

const COMMANDES: readonly TypeCommande[] = [
  'montant',
  'compteur',
  'ouiNon',
  'tuiles',
  'energie',
  'annee',
  'duree',
  'apport',
  'curseur',
  'taux',
  'texte',
];

describe('commandeDe : la commande déduite de la nature du champ', () => {
  it('euros et nombre → montant à deux décimales', () => {
    expect(commandeDe(champ({ type: 'euros' }))).toEqual({
      type: 'montant',
      decimales: DECIMALES_MONTANT,
    });
    expect(commandeDe(champ({ type: 'nombre' })).type).toBe('montant');
  });

  it('entier → compteur, bornes par défaut ou déclarées, noms des boutons, libellé du zéro', () => {
    expect(commandeDe(champ({ type: 'entier', libelle: 'Pièces' }))).toEqual({
      type: 'compteur',
      bornes: BORNES_PAR_DEFAUT,
      moins: 'Un de moins',
      plus: 'Un de plus',
      libelleZero: undefined,
    });
    const etage = commandeDe(
      champ({ type: 'entier', bornes: { min: 0, max: 50 }, libelleZero: 'RDC' }),
    );
    expect(etage).toMatchObject({ bornes: { min: 0, max: 50 }, libelleZero: 'RDC' });
  });

  it('bool sans options → oui / non ; avec options → tuiles ; effaçable sauf obligatoire', () => {
    expect(commandeDe(champ({ type: 'bool' }))).toEqual({ type: 'ouiNon', effacable: true });
    expect(
      commandeDe(champ({ type: 'bool', obligatoire: true, options: [{ v: 'oui', l: 'Oui' }] })),
    ).toEqual({ type: 'tuiles', effacable: false });
    expect(commandeDe(champ({ type: 'enum', options: [{ v: 'a', l: 'a' }] })).type).toBe('tuiles');
  });

  it('pourcent → taux ; texte et enum sans options → texte', () => {
    expect(commandeDe(champ({ type: 'pourcent' })).type).toBe('taux');
    expect(commandeDe(champ({ type: 'texte' })).type).toBe('texte');
    expect(commandeDe(champ({ type: 'enum' })).type).toBe('texte');
  });

  it('une commande déclarée l’emporte ; l’échelle d’énergie lit sa variante dans le chemin', () => {
    expect(commandeDe(champ({ chemin: 'bien.dpe', commande: 'energie' }))).toEqual({
      type: 'energie',
      variante: 'dpe',
    });
    expect(commandeDe(champ({ chemin: 'bien.ges', commande: 'energie' }))).toEqual({
      type: 'energie',
      variante: 'ges',
    });
    for (const type of ['annee', 'duree', 'apport', 'curseur'] as const) {
      expect(commandeDe(champ({ type: 'entier', commande: type }))).toEqual({ type });
    }
  });

  it('chaque descripteur d’Hypothèses, de Financement et du simulateur a une commande connue', () => {
    const tous = [
      ...TOUS_LES_GROUPES.flatMap((g) => g.champs),
      ...CHAMPS_PROJET,
      ...CHAMPS_OFFRE,
    ] as readonly Descripteur[];
    for (const d of tous) expect(COMMANDES).toContain(commandeDe(d).type);
  });

  it('les champs de la fiche 24 ont la commande de Vérifier', () => {
    const par = new Map(TOUS_LES_GROUPES.flatMap((g) => g.champs).map((d) => [d.chemin, d]));
    const type = (chemin: string): TypeCommande | undefined => {
      const d = par.get(chemin);
      return d === undefined ? undefined : commandeDe(d).type;
    };
    expect(type('hypotheses.achat.prix')).toBe('montant');
    expect(type('bien.pieces')).toBe('compteur');
    expect(type('bien.ascenseur')).toBe('tuiles');
    expect(type('hypotheses.location.tourismeClasse')).toBe('ouiNon');
    expect(type('bien.dpe')).toBe('energie');
    expect(type('bien.annee')).toBe('annee');
    expect(type('hypotheses.pret.dureeAnnees')).toBe('duree');
    expect(type('hypotheses.pret.apport')).toBe('apport');
    expect(type('hypotheses.location.nuiteesParMois')).toBe('curseur');
    expect(type('hypotheses.pret.tauxNominal')).toBe('taux');
    expect(type('hypotheses.fiscalite.tmi')).toBe('tuiles');
    expect(type('bien.departement')).toBe('texte');
  });
});

describe('textes des commandes', () => {
  it('texteNuits dit les nuits et le taux d’occupation sur 30 jours', () => {
    expect(texteNuits(15).replace(/\s/g, ' ')).toBe("15 nuits · 50 % d'occupation");
    expect(texteNuits(20.5).replace(/\s/g, ' ')).toBe("20,5 nuits · 68 % d'occupation");
  });

  it('libelleTuile met une majuscule', () => {
    expect(libelleTuile('à rénover')).toBe('À rénover');
    expect(libelleTuile('')).toBe('');
  });
});
