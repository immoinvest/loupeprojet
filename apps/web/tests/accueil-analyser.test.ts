import { describe, expect, it } from 'vitest';

import { estExempleIntact, resumeAnalyser, type OptionsResume } from '@/accueil';
import {
  creerProjet,
  NOM_PROJET_EXEMPLE,
  type ProjetEnregistre,
  type StatutProjet,
} from '@/stockage/projets';

const CREATION = '2026-09-01T08:00:00.000Z';

let compteur = 0;

/** Un projet créé le 1er septembre, modifié à la date donnée (le jour du mois suffit). */
function projet(
  statut: StatutProjet,
  jour: number,
  extra: Partial<ProjetEnregistre> = {},
): ProjetEnregistre {
  compteur += 1;
  const id = `p${String(compteur)}`;
  const cree = creerProjet({
    nom: `Projet ${id}`,
    statut,
    maintenant: () => CREATION,
    genererId: () => id,
  });
  const modifie = `2026-09-${String(jour).padStart(2, '0')}T10:00:00.000Z`;
  return { ...cree, modifieLe: modifie, ...extra };
}

/** Options de test : cash-flow lu dans une table par identifiant, `null` sinon. */
function options(gerer: boolean, cashflows: Readonly<Record<string, number>> = {}): OptionsResume {
  return { gerer, cashflow: (p) => cashflows[p.id] ?? null };
}

describe('estExempleIntact', () => {
  it('le nom de l’exemple, jamais modifié', () => {
    const exemple = creerProjet({ nom: NOM_PROJET_EXEMPLE, statut: 'visite' });
    expect(estExempleIntact(exemple)).toBe(true);
    expect(estExempleIntact({ ...exemple, modifieLe: '2030-01-01T00:00:00.000Z' })).toBe(false);
    expect(estExempleIntact({ ...exemple, nom: 'Mon T3' })).toBe(false);
  });
});

describe('resumeAnalyser', () => {
  it('aucun projet : vide, sans exemple, sans prochaine étape', () => {
    expect(resumeAnalyser([], options(true))).toEqual({
      vide: true,
      exemple: null,
      aEtudier: 0,
      parEtape: { analyse: 0, visite: 0, offre: 0, achete: 0 },
      meilleur: null,
      prochaine: null,
    });
  });

  it('seulement l’exemple intact : vide, l’exemple est proposé ; modifié, il compte', () => {
    const exemple = creerProjet({ nom: NOM_PROJET_EXEMPLE, statut: 'visite' });
    const intact = resumeAnalyser([exemple], options(true));
    expect(intact.vide).toBe(true);
    expect(intact.exemple).toBe(exemple);

    const modifie = { ...exemple, modifieLe: '2030-01-01T00:00:00.000Z' };
    const r = resumeAnalyser([modifie], options(true));
    expect(r.vide).toBe(false);
    expect(r.exemple).toBeNull();
    expect(r.aEtudier).toBe(1);
  });

  it('compte les étapes ; les écartés et les achetés ne sont plus à l’étude, les scénarios oui', () => {
    const projets = [
      projet('analyse', 2),
      projet('analyse', 3),
      projet('visite', 4),
      projet('offre', 5),
      projet('achete', 6),
      projet('ecarte', 7),
      projet('scenario', 8),
    ];
    const r = resumeAnalyser(projets, options(true));
    expect(r.parEtape).toEqual({ analyse: 2, visite: 1, offre: 1, achete: 1 });
    expect(r.aEtudier).toBe(5);
  });

  it('prochaine étape : acheté (Gérer affiché), puis offre, visite prévue, analyse', () => {
    const achete = projet('achete', 2);
    const offre = projet('offre', 3);
    const visite = projet('visite', 4);
    const analyse = projet('analyse', 5);
    const tous = [analyse, visite, offre, achete];

    expect(resumeAnalyser(tous, options(true)).prochaine).toEqual({
      action: 'gerer',
      projet: achete,
      chemin: `/gerer/pret/${achete.id}`,
    });
    expect(resumeAnalyser(tous, options(false)).prochaine).toEqual({
      action: 'financement',
      projet: offre,
      chemin: `/projets/${offre.id}/financement`,
    });
    expect(resumeAnalyser([analyse, visite], options(true)).prochaine).toEqual({
      action: 'visite',
      projet: visite,
      chemin: `/projets/${visite.id}/visite`,
    });
    const visiteFaite = { ...visite, visite: { faite: true, reponses: {} } };
    expect(resumeAnalyser([analyse, visiteFaite], options(true)).prochaine).toEqual({
      action: 'rapport',
      projet: analyse,
      chemin: `/projets/${analyse.id}`,
    });
  });

  it('dans une même étape, le projet modifié le plus récemment', () => {
    const ancien = projet('analyse', 2);
    const recent = projet('analyse', 9);
    expect(resumeAnalyser([ancien, recent], options(true)).prochaine?.projet).toBe(recent);
  });

  it('tout écarté : rien à étudier, pas de prochaine étape', () => {
    const r = resumeAnalyser([projet('ecarte', 2), projet('ecarte', 3)], options(true));
    expect(r.vide).toBe(false);
    expect(r.aEtudier).toBe(0);
    expect(r.prochaine).toBeNull();
    expect(r.meilleur).toBeNull();
  });

  it('meilleur cash-flow : le plus haut des projets à l’étude, analyses incomplètes ignorées', () => {
    const faible = projet('analyse', 2);
    const fort = projet('visite', 3);
    const incomplet = projet('offre', 4);
    const ecarte = projet('ecarte', 5);
    const achete = projet('achete', 6);
    const r = resumeAnalyser(
      [faible, fort, incomplet, ecarte, achete],
      options(true, { [faible.id]: -210, [fort.id]: -40, [ecarte.id]: 500, [achete.id]: 800 }),
    );
    expect(r.meilleur).toEqual({ projet: fort, mensuel: -40 });
  });
});
