import { calculerProjet, projetExemple, type ProjetEntree } from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import { appliquerSaisie, descripteurParChemin } from '@/hypotheses';
import { effetsDe, indicateursLies } from '@/hypotheses/effet';
import {
  CHIFFRES_COMPARER,
  CHIFFRES_PAR_VOLET,
  VOLETS,
  cheminDepuisFragment,
  descripteurLie,
  lienHypothese,
  lireDepuis,
  origineDepuisChemin,
  segmentDe,
  utilisePar,
  voletDeRepli,
  voletPour,
} from '@/hypotheses/liens';
import { LIBELLES_ORIGINE, TEXTES_LIENS, phraseEffet } from '@/textes/liens';

const n = (s: string): string => s.replace(/\s/g, ' ');

function avec(projet: ProjetEntree, chemin: string, texte: string): ProjetEntree {
  const application = appliquerSaisie(projet, descripteurParChemin(chemin), texte);
  if (!application.ok) throw new Error(application.erreur);
  return application.projet;
}

describe('tables des chiffres liés', () => {
  it('chaque chemin lié a un descripteur éditable', () => {
    const chemins = [...VOLETS.flatMap((v) => CHIFFRES_PAR_VOLET[v]), ...CHIFFRES_COMPARER];
    for (const chemin of chemins) expect(descripteurLie(chemin), chemin).not.toBeNull();
  });

  it('descripteurLie ne lève jamais', () => {
    expect(descripteurLie('hypotheses.pret.tauxNominal')?.libelle).toBe('Taux nominal');
    expect(descripteurLie('bien.inconnu')).toBeNull();
  });

  it('utilisé par : les volets qui affichent le chiffre, dans l’ordre de la bande', () => {
    expect(utilisePar('hypotheses.achat.prix')).toEqual(['rapport', 'financement', 'revente']);
    expect(utilisePar('hypotheses.pret.tauxNominal')).toEqual(['rapport']);
    expect(utilisePar('bien.pieces')).toEqual([]);
  });
});

describe('lienHypothese', () => {
  it('le prêt dans Financement, l’horizon dans Revente, le reste dans Hypothèses', () => {
    expect(voletPour('hypotheses.pret.tauxNominal')).toBe('financement');
    expect(voletPour('hypotheses.revente.annees')).toBe('revente');
    expect(voletPour('hypotheses.location.loyerHc')).toBe('hypotheses');
    expect(segmentDe('rapport')).toBe('');
    expect(segmentDe('revente')).toBe('revente');
  });

  it('adresse, fragment et origine', () => {
    expect(
      lienHypothese('abc', 'hypotheses.pret.tauxNominal', {
        pathname: '/projets/abc',
        origine: 'rapport',
      }),
    ).toEqual({
      pathname: '/projets/abc/financement',
      hash: '#hypotheses.pret.tauxNominal',
      state: {
        depuis: {
          pathname: '/projets/abc',
          origine: 'rapport',
          chemin: 'hypotheses.pret.tauxNominal',
        },
      },
    });
    expect(lienHypothese('a b', 'hypotheses.location.loyerHc')).toEqual({
      pathname: '/projets/a%20b/hypotheses',
      hash: '#hypotheses.location.loyerHc',
      state: null,
    });
  });

  it('fragment : décodé, seulement un champ éditable', () => {
    expect(cheminDepuisFragment('#hypotheses.location.loyerHc')).toBe(
      'hypotheses.location.loyerHc',
    );
    expect(cheminDepuisFragment('bien.dpe')).toBe('bien.dpe');
    expect(cheminDepuisFragment('#n-importe-quoi')).toBeNull();
    expect(cheminDepuisFragment('')).toBeNull();
    expect(cheminDepuisFragment('#%E0%A4%A')).toBeNull();
  });

  it('origine d’une adresse', () => {
    expect(origineDepuisChemin('/projets/abc')).toBe('rapport');
    expect(origineDepuisChemin('/projets/abc/')).toBe('rapport');
    expect(origineDepuisChemin('/projets/abc/fiscalite')).toBe('fiscalite');
    expect(origineDepuisChemin('/projets/abc/imprimer/x')).toBeNull();
    expect(origineDepuisChemin('/projets/abc/inconnu')).toBeNull();
    expect(origineDepuisChemin('/comparer')).toBe('comparer');
    expect(origineDepuisChemin('/projets')).toBeNull();
  });

  it('lireDepuis refuse un état mal formé', () => {
    const bon = { pathname: '/projets/abc', origine: 'rapport', chemin: 'bien.dpe' };
    expect(lireDepuis({ depuis: bon })).toEqual(bon);
    expect(lireDepuis(null)).toBeNull();
    expect(lireDepuis({})).toBeNull();
    expect(lireDepuis({ depuis: { ...bon, pathname: 3 } })).toBeNull();
    expect(lireDepuis({ depuis: { ...bon, chemin: undefined } })).toBeNull();
    expect(lireDepuis({ depuis: { ...bon, origine: 'ailleurs' } })).toBeNull();
    expect(lireDepuis({ depuis: { ...bon, origine: 4 } })).toBeNull();
  });

  it('repli vers Hypothèses seulement si le champ y vit', () => {
    expect(voletDeRepli('hypotheses.revente.annees', 'revente')).toBe('hypotheses');
    expect(voletDeRepli('hypotheses.revente.annees', 'hypotheses')).toBeNull();
    expect(voletDeRepli('hypotheses.pret.apport', 'rapport')).toBeNull();
  });
});

describe('effet d’une modification', () => {
  const avant = calculerProjet(projetExemple);

  it('loyer : valeur et chiffres liés qui bougent', () => {
    const apres = calculerProjet(avec(projetExemple, 'hypotheses.location.loyerHc', '1300'));
    const effet = effetsDe(avant, apres, 'hypotheses.location.loyerHc');
    expect(effet).not.toBeNull();
    expect(n(phraseEffet(effet!))).toBe(
      n(
        `Loyer visé, hors charges : 980 €/mois → 1 300 €/mois. Cash-flow : −210 €/mois → +91 €/mois. Rendement net : ${effet!.indicateurs[1]!.avant} → ${effet!.indicateurs[1]!.apres}.`,
      ),
    );
  });

  it('rien de changé : null ; chemin inconnu : null', () => {
    expect(effetsDe(avant, avant, 'hypotheses.location.loyerHc')).toBeNull();
    expect(effetsDe(avant, avant, 'bien.inconnu')).toBeNull();
  });

  it('seulement les chiffres qui bougent', () => {
    const apres = calculerProjet(avec(projetExemple, 'hypotheses.revente.fraisAgenceTaux', '6'));
    const effet = effetsDe(avant, apres, 'hypotheses.revente.fraisAgenceTaux');
    expect(effet?.indicateurs.map((i) => i.code)).toEqual(['cashNet', 'tri']);
  });

  it('sans loyer : « — » avant, chiffres après', () => {
    const sansLoyer = calculerProjet({
      ...projetExemple,
      hypotheses: {
        ...projetExemple.hypotheses,
        location: { ...projetExemple.hypotheses.location, loyerHc: undefined },
      },
    } as ProjetEntree);
    const effet = effetsDe(sansLoyer, avant, 'hypotheses.location.loyerHc');
    expect(effet?.avant).toBe('—');
    expect(effet?.indicateurs[0]?.avant).toBe('—');
  });

  it('sans loyer des deux côtés : les chiffres qui attendent le loyer restent « — »', () => {
    const sansLoyer = (p: ProjetEntree): ProjetEntree =>
      ({
        ...p,
        hypotheses: {
          ...p.hypotheses,
          location: { ...p.hypotheses.location, loyerHc: undefined },
        },
      }) as ProjetEntree;
    const avantPartiel = calculerProjet(sansLoyer(projetExemple));
    for (const [chemin, texte] of [
      ['hypotheses.fiscalite.regime', 'micro_bic'],
      ['hypotheses.revente.fraisAgenceTaux', '6'],
    ] as const) {
      const apres = calculerProjet(sansLoyer(avec(projetExemple, chemin, texte)));
      const effet = effetsDe(avantPartiel, apres, chemin);
      expect(effet?.avant).not.toBe(effet?.apres);
      expect(effet?.indicateurs).toEqual([]);
    }
  });

  it('chaque famille d’hypothèses a ses chiffres, lus sur le projet', () => {
    expect(indicateursLies('hypotheses.pret.apport')).toEqual(['mensualite', 'cashflow']);
    expect(indicateursLies('marche.plafondLoyerMensuel')).toEqual(['cashflow', 'rendementNet']);
    expect(indicateursLies('hypotheses.charges.pno')).toEqual(['cashflow', 'rendementNet']);
    expect(indicateursLies('inconnu')).toEqual(['cashflow']);
    const cas: readonly (readonly [string, string])[] = [
      ['hypotheses.pret.tauxNominal', '4'],
      ['hypotheses.fiscalite.regime', 'micro_bic'],
      ['hypotheses.achat.prix', '140000'],
      ['bien.dpe', 'G'],
    ];
    for (const [chemin, texte] of cas) {
      const effet = effetsDe(avant, calculerProjet(avec(projetExemple, chemin, texte)), chemin);
      expect(effet?.indicateurs.length, chemin).toBeGreaterThan(0);
      expect(effet?.indicateurs.every((i) => i.avant !== i.apres)).toBe(true);
    }
  });

  it('sans estimation : prix estimé « — »', () => {
    const sansDvf = calculerProjet({
      ...projetExemple,
      marche: { ...projetExemple.marche, dvf: undefined },
    });
    const apres = calculerProjet({
      ...avec(projetExemple, 'bien.dpe', 'G'),
      marche: { ...projetExemple.marche, dvf: undefined },
    });
    const effet = effetsDe(sansDvf, apres, 'bien.dpe');
    expect(effet?.avant).not.toBe(effet?.apres);
    expect(effet?.indicateurs.find((i) => i.code === 'prixEstime')).toBeUndefined();
  });
});

describe('textes des liens', () => {
  it('libellés et phrases', () => {
    expect(LIBELLES_ORIGINE.adresse).toBe('Estimation');
    expect(TEXTES_LIENS.revenir('rapport')).toBe('Revenir à Rapport');
    expect(TEXTES_LIENS.modifier('980 €', 'Loyer')).toBe('980 € — modifier Loyer');
  });
});
