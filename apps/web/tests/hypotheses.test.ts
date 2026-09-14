import { ProjetSchema, projetExemple, type ProjetEntree } from '@loupe/moteur';
import { describe, expect, it } from 'vitest';

import {
  GROUPES,
  appliquerSaisie,
  cleProvenance,
  depuisTexte,
  ecrireChemin,
  lireChemin,
  valeurActuelle,
  versTexte,
  type Descripteur,
} from '@/hypotheses';

const champ = (chemin: string): Descripteur => {
  const d = GROUPES.flatMap((g) => g.champs).find((c) => c.chemin === chemin);
  if (d === undefined) throw new Error(`descripteur inconnu : ${chemin}`);
  return d;
};

describe('chemins', () => {
  it('lit un chemin pointé, undefined si absent ou si un segment n’est pas un objet', () => {
    expect(lireChemin(projetExemple, 'hypotheses.pret.tauxNominal')).toBe(0.0335);
    expect(lireChemin(projetExemple, 'marche.dvf.medianM2')).toBe(3050);
    expect(lireChemin(projetExemple, 'bien.copro.procedure')).toBe(false);
    expect(lireChemin(projetExemple, 'bien.inconnu.x')).toBeUndefined();
    expect(lireChemin(projetExemple, 'bien.surface.x')).toBeUndefined();
  });

  it('écrit sans muter, crée les objets intermédiaires, supprime avec undefined', () => {
    const suivant = ecrireChemin(projetExemple, 'hypotheses.pret.tauxNominal', 0.04);
    expect(lireChemin(suivant, 'hypotheses.pret.tauxNominal')).toBe(0.04);
    expect(lireChemin(projetExemple, 'hypotheses.pret.tauxNominal')).toBe(0.0335);
    expect(suivant.bien).toBe(projetExemple.bien);

    const cree = ecrireChemin(projetExemple, 'hypotheses.location.courteDuree.nuitee', 80);
    expect(lireChemin(cree, 'hypotheses.location.courteDuree.nuitee')).toBe(80);

    const sans = ecrireChemin(projetExemple, 'bien.dpe', undefined);
    expect('dpe' in sans.bien).toBe(false);
    expect(ecrireChemin(projetExemple, 'bien.inconnu', undefined).bien).toEqual(projetExemple.bien);
  });
});

describe('conversion', () => {
  it('versTexte : pourcentages affichés en %, booléens en oui/non, vide pour absent', () => {
    expect(versTexte(0.0335, 'pourcent')).toBe('3.35');
    expect(versTexte(0.6, 'pourcent')).toBe('60');
    expect(versTexte(true, 'bool')).toBe('oui');
    expect(versTexte(false, 'bool')).toBe('non');
    expect(versTexte(155_000, 'euros')).toBe('155000');
    expect(versTexte('D', 'enum')).toBe('D');
    expect(versTexte(undefined, 'euros')).toBe('');
    expect(versTexte(null, 'texte')).toBe('');
    expect(versTexte({ objet: true }, 'texte')).toBe('');
  });

  it('depuisTexte : nombres à la française, pourcentages, entiers, erreurs', () => {
    expect(depuisTexte('3,35', 'pourcent')).toEqual({ ok: true, valeur: 0.0335 });
    expect(depuisTexte('155 000', 'euros')).toEqual({ ok: true, valeur: 155_000 });
    expect(depuisTexte('32,5', 'nombre')).toEqual({ ok: true, valeur: 32.5 });
    expect(depuisTexte('25', 'entier')).toEqual({ ok: true, valeur: 25 });
    expect(depuisTexte('oui', 'bool')).toEqual({ ok: true, valeur: true });
    expect(depuisTexte('nu', 'enum')).toEqual({ ok: true, valeur: 'nu' });
    expect(depuisTexte('13', 'texte')).toEqual({ ok: true, valeur: '13' });
    expect(depuisTexte('  ', 'euros')).toEqual({ ok: true, valeur: undefined });
    expect(depuisTexte('2,5', 'entier').ok).toBe(false);
    expect(depuisTexte('abc', 'euros').ok).toBe(false);
    expect(depuisTexte('abc', 'pourcent').ok).toBe(false);
  });
});

describe('descripteurs', () => {
  it('chaque chemin existe dans le projet d’exemple ou est optionnel, sans doublon', () => {
    const chemins = GROUPES.flatMap((g) => g.champs.map((c) => c.chemin));
    expect(new Set(chemins).size).toBe(chemins.length);
    const projet = ProjetSchema.parse(projetExemple);
    for (const d of GROUPES.flatMap((g) => g.champs)) {
      const v = valeurActuelle(projet, d);
      const visible = d.visibleSi === undefined || d.visibleSi(projet);
      if (d.obligatoire === true && visible) expect(v, d.chemin).toBeDefined();
    }
  });

  it('cleProvenance retire le préfixe hypotheses.', () => {
    expect(cleProvenance('hypotheses.achat.prix')).toBe('achat.prix');
    expect(cleProvenance('bien.surface')).toBe('bien.surface');
  });
});

describe('appliquerSaisie', () => {
  it('écrit la valeur convertie et marque la provenance « utilisateur »', () => {
    const r = appliquerSaisie(projetExemple, champ('hypotheses.pret.tauxNominal'), '4');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.projet.hypotheses.pret.tauxNominal).toBe(0.04);
    expect(r.projet.provenance?.['pret.tauxNominal']).toBe('utilisateur');
    expect(ProjetSchema.safeParse(r.projet).success).toBe(true);
  });

  it('refuse un vide sur un champ obligatoire, accepte un vide sur un optionnel', () => {
    expect(appliquerSaisie(projetExemple, champ('hypotheses.achat.prix'), '')).toEqual({
      ok: false,
      erreur: 'Cette valeur est nécessaire au calcul.',
    });
    const r = appliquerSaisie(projetExemple, champ('bien.dpe'), '');
    expect(r.ok && r.projet.bien.dpe).toBeUndefined();
  });

  it('propage une erreur de conversion', () => {
    expect(appliquerSaisie(projetExemple, champ('hypotheses.achat.prix'), 'abc').ok).toBe(false);
  });

  it('passer en courte durée reconstruit la location avec les défauts du type, badgés « estimé »', () => {
    const r = appliquerSaisie(projetExemple, champ('hypotheses.location.mode'), 'courte_duree');
    if (!r.ok) throw new Error(r.erreur);
    // 980 € ÷ 30 × 2 = 65 € la nuit ; 15 nuits par mois.
    expect(r.projet.hypotheses.location).toEqual({
      mode: 'courte_duree',
      nuitee: 65,
      nuiteesParMois: 15,
      dureeSejourNuits: 4,
      menageFactureParSejour: 27,
      menageCoutParSejour: 27,
      plateformeTaux: 0.03,
      conciergerieTaux: 0,
      tourismeClasse: false,
    });
    expect(r.projet.hypotheses.charges).toMatchObject({ energieMensuel: 190, internetMensuel: 30 });
    expect(r.projet.provenance).toMatchObject({
      'location.mode': 'utilisateur',
      'location.nuitee': 'estime',
      'charges.energieMensuel': 'estime',
    });
    expect(r.projet.provenance?.['location.loyerHc']).toBeUndefined();
    expect(ProjetSchema.safeParse(r.projet).success).toBe(true);
    // Le même type une seconde fois : rien ne bouge.
    const deja = appliquerSaisie(r.projet, champ('hypotheses.location.mode'), 'courte_duree');
    expect(deja.ok && deja.projet).toBe(r.projet);
  });

  it('changer de type garde le loyer de référence et les abonnements « à toi », règle le régime', () => {
    const nuReel: ProjetEntree = {
      ...projetExemple,
      hypotheses: {
        ...projetExemple.hypotheses,
        charges: { ...projetExemple.hypotheses.charges, energieMensuel: 120 },
        fiscalite: { tmi: 0.3, regime: 'nu_reel' },
      },
      provenance: { ...projetExemple.provenance, 'charges.energieMensuel': 'utilisateur' },
    };
    const coloc = appliquerSaisie(nuReel, champ('hypotheses.location.mode'), 'colocation');
    if (!coloc.ok) throw new Error(coloc.erreur);
    // 980 € × 1,35 ÷ 2 chambres = 662 € par chambre.
    expect(coloc.projet.hypotheses.location).toMatchObject({ chambres: 2, loyerChambre: 662 });
    expect(coloc.projet.hypotheses.charges).toMatchObject({
      energieMensuel: 120,
      internetMensuel: 30,
    });
    expect(coloc.projet.hypotheses.fiscalite.regime).toBe('lmnp_reel');
    expect(coloc.projet.provenance).toMatchObject({
      'charges.energieMensuel': 'utilisateur',
      'charges.internetMensuel': 'estime',
    });
    // Retour en meublé : 1 324 € ÷ 1,35 = 981 €, abonnements estimés remis à 0.
    const retour = appliquerSaisie(coloc.projet, champ('hypotheses.location.mode'), 'meuble');
    if (!retour.ok) throw new Error(retour.erreur);
    expect(retour.projet.hypotheses.location).toEqual({
      mode: 'meuble',
      loyerHc: 981,
      chargesLocataire: 0,
      vacanceSemaines: 3,
      gestionTaux: 0,
    });
    expect(retour.projet.hypotheses.charges).toMatchObject({
      energieMensuel: 120,
      internetMensuel: 0,
    });
    expect(retour.projet.provenance?.['location.loyerChambre']).toBeUndefined();
  });

  it('refuse un type inconnu ; une location illisible repart d’un loyer nul', () => {
    expect(appliquerSaisie(projetExemple, champ('hypotheses.location.mode'), 'saisonnier')).toEqual(
      {
        ok: false,
        erreur: 'Type de location inconnu.',
      },
    );
    const cassee = {
      ...projetExemple,
      hypotheses: { ...projetExemple.hypotheses, location: { mode: 'nu' } },
    } as unknown as ProjetEntree;
    const r = appliquerSaisie(cassee, champ('hypotheses.location.mode'), 'meuble');
    expect(r.ok && r.projet.hypotheses.location).toMatchObject({ mode: 'meuble', loyerHc: 0 });
  });

  it('une première valeur de marché crée le bloc DVF', () => {
    const base: ProjetEntree = {
      id: projetExemple.id,
      versionRegles: projetExemple.versionRegles,
      bien: projetExemple.bien,
      hypotheses: projetExemple.hypotheses,
    };
    const r = appliquerSaisie(base, champ('marche.dvf.medianM2'), '3000');
    expect(r.ok && r.projet.marche?.dvf).toEqual({ medianM2: 3000, nombreVentes: 0 });
    const r2 = appliquerSaisie(projetExemple, champ('marche.dvf.q1M2'), '2500');
    expect(r2.ok && r2.projet.marche?.dvf?.medianM2).toBe(3050);
  });
});
