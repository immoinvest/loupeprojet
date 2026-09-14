import { VERSION_REGLES_COURANTE, obtenirRegles } from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import { defautsDuMoteur } from '@/analyses';
import { pct, pctSigne, sectionsMethode } from '@/textes/methode';
import { sectionDefauts } from '@/textes/methode-verdict';

const n = (s: string): string => s.replace(/\s/g, ' ');
const regles = obtenirRegles(VERSION_REGLES_COURANTE);
const defauts = defautsDuMoteur();

describe('pct', () => {
  it('garde juste les décimales utiles', () => {
    expect(n(pct(0.05))).toBe('5 %');
    expect(n(pct(0.038))).toBe('3,8 %');
    expect(n(pct(0.0237))).toBe('2,37 %');
    expect(n(pct(0.01596))).toBe('1,596 %');
    expect(n(pct(0.186))).toBe('18,6 %');
    expect(n(pctSigne(-0.05))).toBe('−5 %');
    expect(n(pctSigne(0.05))).toBe('+5 %');
    expect(n(pctSigne(0))).toBe('0 %');
  });
});

describe('defautsDuMoteur', () => {
  it('lit les défauts des schémas et du formulaire plutôt que de les recopier', () => {
    expect(defauts).toEqual({
      vacanceSemaines: 3,
      entretienTaux: 0.005,
      tauxAssurance: 0.0025,
      psBic: 0.186,
      psFoncier: 0.172,
      reventeAnnees: 10,
      evolutionAnnuelle: 0.015,
      fraisAgenceTaux: 0.04,
      diagnostics: 500,
      honorairesChargeAcquereur: true,
      negociationTaux: 0,
      pno: 150,
      comptable: 420,
      cfe: 180,
      fraisDossier: 850,
      fraisGarantie: 1_500,
      mobilierParM2: 75,
      coproParM2An: 25,
      taxeFonciereEnMoisDeLoyer: 1,
      surfaceParPiece: 20,
    });
  });
});

describe('sectionsMethode', () => {
  const sections = sectionsMethode(regles, defauts);
  const section = (code: string): (typeof sections)[number] => {
    const s = sections.find((x) => x.code === code);
    if (s === undefined) throw new Error(`section ${code} absente`);
    return s;
  };
  const valeurs = (code: string): string =>
    n(
      section(code)
        .constantes.map((c) => c.valeur)
        .join(' | '),
    );

  it('couvre chaque module du moteur, avec une valeur et une source par constante', () => {
    expect(sections.map((s) => s.code)).toEqual([
      'acquisition',
      'credit',
      'cashflow',
      'location',
      'rendement',
      'micro_bic',
      'lmnp_reel',
      'micro_foncier',
      'nu_reel',
      'revente',
      'tri',
      'estimation',
      'verdict',
      'scenarios',
      'defauts',
    ]);
    for (const s of sections) {
      expect(s.titre.length).toBeGreaterThan(3);
      expect(s.resume.length).toBeGreaterThan(10);
      expect(s.etapes.length + s.constantes.length).toBeGreaterThan(0);
      for (const c of s.constantes) {
        expect(c.valeur.length).toBeGreaterThan(0);
        expect(c.source.length).toBeGreaterThan(3);
        expect(typeof c.aConfirmer).toBe('boolean');
      }
    }
  });

  it('formate les constantes depuis les règles, jamais recopiées', () => {
    expect(n(section('acquisition').etapes[2] ?? '')).toContain(
      '5 % de droits départementaux × (1 + 2,37 %',
    );
    expect(valeurs('acquisition')).toContain(
      "3,87 % jusqu'à 6 500 €, 1,596 % jusqu'à 17 000 €, 1,064 % jusqu'à 60 000 €, 0,799 % au-delà",
    );
    expect(valeurs('acquisition')).toContain('36 : 3,8 %, 56 : 3,8 %, 976 : 3,8 %');
    expect(valeurs('credit')).toContain('3,14 % · 3,27 % · 3,35 %');
    expect(n(section('credit').etapes[4] ?? '')).toContain(
      'Crédit ÷ loyer = mensualité assurance comprise ÷ loyer hors charges',
    );
    expect(n(section('credit').etapes[5] ?? '')).toContain(
      "Deklic ne demande pas vos revenus : la banque calculera votre taux d'effort avec 70 % des loyers, seuil 35 % ; durée maximale 25 ans (27 ans si les travaux dépassent 10 % du prix)",
    );
    expect(n(section('revente').etapes[3] ?? '')).toContain(
      '6 % par an de la 6e à la 21e année, 4 % la 22e année',
    );
    expect(n(section('revente').etapes[3] ?? '')).toContain('9 % par an de la 23e à la 30e année');
    expect(n(section('revente').etapes[4] ?? '')).toContain(
      "2 % jusqu'à 100 000 €, 3 % jusqu'à 150 000 €, 4 % jusqu'à 200 000 €, 5 % jusqu'à 250 000 €, 6 % au-delà",
    );
    expect(n(section('verdict').etapes[0] ?? '')).toContain(
      "Bon jusqu'à −5 %, à surveiller jusqu'à +5 %",
    );
    expect(n(section('lmnp_reel').etapes[1] ?? '')).toContain('55 % sur 50 ans et 45 % sur 20 ans');
    expect(n(section('cashflow').etapes[0] ?? '')).toContain('3 semaines par défaut');
    expect(valeurs('defauts')).toContain('75 € par m²');
    expect(valeurs('micro_bic')).toContain('83 600 €');
    expect(valeurs('nu_reel')).toContain('21 400 €');
  });

  it('pose le drapeau « à confirmer » d’après les règles', () => {
    const psBic = section('micro_bic').constantes.find(
      (c) => c.chemin === 'fiscalite.prelevementsSociaux.bic',
    );
    expect(psBic?.aConfirmer).toBe(true);
    const dmtoReduits = section('acquisition').constantes.find(
      (c) => c.chemin === 'acquisition.dmtoParDepartement',
    );
    expect(dmtoReduits?.aConfirmer).toBe(true);
    const taxeCommunale = section('acquisition').constantes.find(
      (c) => c.chemin === 'acquisition.taxeCommunale',
    );
    expect(taxeCommunale?.aConfirmer).toBe(false);
    expect(section('micro_foncier').constantes[0]?.chemin).toBeUndefined();
    expect(section('micro_foncier').constantes[0]?.aConfirmer).toBe(false);
    // 3 constantes fiscales + 6 coefficients de l'estimation (DPE ×2, étage ×2, extérieur, charges)
    // + 9 valeurs de départ des types de location (Excel « Projet 92K », Airbnb, choix Deklic).
    expect(sections.flatMap((s) => s.constantes).filter((c) => c.aConfirmer).length).toBe(18);
  });

  it('explique chaque type de location avec ses règles datées', () => {
    const etapes = n(section('location').etapes.join(' | '));
    expect(etapes).toContain('Location nue : loyer × 12 − vacance (3 semaines par défaut)');
    expect(etapes).toContain('vacance de 4 semaines par chambre');
    expect(etapes).toContain("Micro-BIC à 30 % d'abattement et 15 000 € de plafond");
    expect(etapes).toContain('bail mobilité, 1 à 10 mois');
    const v = valeurs('location');
    expect(v).toContain('+35 %');
    expect(v).toContain('9 m² · 20 m³');
    expect(v).toContain('190 € par mois');
    expect(v).toContain('E pour une nouvelle autorisation · D pour tous dès 2034');
    const plateforme = section('location').constantes.find(
      (c) => c.chemin === 'exploitation.parType.courte_duree.plateformeTaux',
    );
    expect(plateforme).toMatchObject({ valeur: '3 %', aConfirmer: true });
  });

  it('expose les coefficients de l’estimation et leur source, lus dans les règles', () => {
    const v = valeurs('estimation');
    expect(v).toContain('A +16 % · B +12 % · C +6 % · E −4 % · F −12 % · G −12 %');
    expect(v).toContain('F −25 % · G −25 % · A, B, C, E non publiées');
    expect(v).toContain('rez-de-chaussée −9,9 % · 4e étage et plus +4 %');
    expect(v).toContain('rez-de-chaussée −9,6 % · 3e étage et plus −0,9 %');
    expect(v).toContain('+8,8 %');
    expect(v).toContain('26 € par m² et par an · effet borné à ±15 %');
    expect(v).toContain(
      'à rénover 25 % · à rafraîchir 37,5 % · bon état 50 % · rénové 75 % des ventes',
    );
    expect(n(section('estimation').etapes[5] ?? '')).toContain(
      'localisation (35 points au plus), dispersion des prix (30), nombre de ventes comparables (20) et ancienneté des ventes (15)',
    );
    expect(n(section('estimation').etapes[6] ?? '')).toBe(
      'Fourchette : ±5 % si la confiance est élevée, ±6,5 % si la confiance est bonne, ±8 % si la confiance est moyenne, ±12 % si la confiance est faible, ±15 % si la confiance est très faible.',
    );
    expect(v).toContain(
      'même immeuble 35 · même rue 30 · quartier ≤ 100 m 26, ≤ 200 m 22, ≤ 300 m 18, au-delà 12 · commune 4',
    );
    expect(v).toContain('3 ventes ou moins 0 · 10 ventes 12 · 30 ventes ou plus 20');
    expect(v).toContain('10 % ou moins 30 · 45 % ou plus 0');
    expect(v).toContain('6 mois ou moins 15 · 30 mois ou plus 0 · inconnue : 12 mois supposés');
    expect(v).toContain(
      'élevée dès 80 · bonne dès 65 · moyenne dès 45 · faible dès 25 · très faible dès 0',
    );
    expect(v).toContain('±5 % · ±6,5 % · ±8 % · ±12 % · ±15 %');
    expect(section('estimation').constantes.every((c) => c.source.length > 3)).toBe(true);
  });

  it('décrit les honoraires selon le défaut', () => {
    const vendeur = sectionDefauts({ ...defauts, honorairesChargeAcquereur: false });
    expect(vendeur.constantes.map((c) => c.valeur)).toContain('à la charge du vendeur');
    expect(sectionDefauts(defauts).constantes.map((c) => c.valeur)).toContain(
      "à la charge de l'acquéreur",
    );
  });
});
