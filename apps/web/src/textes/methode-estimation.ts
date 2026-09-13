import type { ClasseEnergie, Regles } from '@loupe/moteur';

import { nombre } from '@/formatage/nombres';

import { pct, pctSigne, type SectionMethode } from './methode-commun';

const CLASSES: readonly ClasseEnergie[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

/** « A +16 % · B +12 % · … » : les classes publiées autres que D. */
function ecartsDpe(table: Readonly<Record<ClasseEnergie, number | null>>): string {
  const publiees = CLASSES.flatMap((classe) => {
    const taux = table[classe];
    return taux === null || classe === 'D' ? [] : [`${classe} ${pctSigne(taux)}`];
  });
  const nonPubliees = CLASSES.filter((classe) => table[classe] === null);
  return nonPubliees.length === 0
    ? publiees.join(' · ')
    : `${publiees.join(' · ')} · ${nonPubliees.join(', ')} non publiées`;
}

export function sectionEstimation(regles: Regles): SectionMethode {
  const e = regles.estimation;
  const { avecAscenseur: avec, sansAscenseur: sans } = e.etage;
  return {
    code: 'estimation',
    titre: "L'estimation du prix",
    resume:
      'Comme un estimateur en ligne, mais chaque vente, chaque correction et chaque source sont montrées.',
    etapes: [
      'Ventes comparables : même type de logement, surface à 40 % près, du même immeuble au cercle de 300 m (onglet Estimation), sinon la commune.',
      'Date : chaque vente est ramenée au dernier semestre publié par la médiane du prix au m² par semestre de sa commune (ou du département), lissée sur trois semestres, sur cinq ans de ventes DVF.',
      `État : à rénover = premier quartile des ventes comparables, à rafraîchir = entre premier quartile et médiane, bon état = médiane (supposé par défaut), rénové = troisième quartile. DVF ne dit rien de l'état des biens vendus.`,
      'Corrections : DPE, étage et ascenseur, balcon ou terrasse, en pourcentage du prix de marché, additionnées. Chacune se désactive pour un projet.',
      `Charges : l'écart des charges de copropriété au repère de ${nombre(e.charges.repereM2An)} € par m² et par an est un coût permanent, capitalisé au rendement locatif brut local (loyer de référence ÷ prix médian), borné à ${pct(e.charges.borne)} du prix. Charges estimées par défaut : ignorées.`,
      `Fourchette : ±${pct(e.marges.elevee)} avec au moins ${String(e.confiance.eleveeVentes)} ventes comparables dans ${nombre(e.confiance.eleveeRayonMetres)} m, ±${pct(e.marges.moyenne)} avec ${String(e.confiance.moyenneVentes)} ventes dans ${nombre(e.confiance.moyenneRayonMetres)} m, ±${pct(e.marges.faible)} sinon.`,
    ],
    constantes: [
      {
        libelle: 'Position selon l’état',
        valeur: `à rénover ${pct(e.positionsEtat.a_renover)} · à rafraîchir ${pct(e.positionsEtat.a_rafraichir)} · bon état ${pct(e.positionsEtat.bon_etat)} · rénové ${pct(e.positionsEtat.renove)} des ventes`,
        source: 'Choix Deklic',
      },
      {
        libelle: 'DPE, appartements (écart à la classe D)',
        valeur: ecartsDpe(e.dpe.appartement),
        source:
          'Notaires de France, « La valeur verte des logements en France sur les transactions 2024 », janvier 2026 ; F reprend G',
        chemin: 'estimation.dpe',
      },
      {
        libelle: 'DPE, maisons (écart à la classe D)',
        valeur: ecartsDpe(e.dpe.maison),
        source: 'Même étude ; F reprend G',
        chemin: 'estimation.dpe',
      },
      {
        libelle: 'Étage, immeuble avec ascenseur (écart au 2e étage)',
        valeur: `rez-de-chaussée ${pctSigne(avec.rezDeChaussee)} · ${String(avec.hautsAPartirDe)}e étage et plus ${pctSigne(avec.hauts)}`,
        source: 'MeilleursAgents, grandes villes de province, juin 2017',
        chemin: 'estimation.etage',
      },
      {
        libelle: 'Étage, immeuble sans ascenseur (écart au 2e étage)',
        valeur: `rez-de-chaussée ${pctSigne(sans.rezDeChaussee)} · ${String(sans.hautsAPartirDe)}e étage et plus ${pctSigne(sans.hauts)}`,
        source: 'MeilleursAgents, grandes villes de province, juin 2017',
        chemin: 'estimation.etage',
      },
      {
        libelle: 'Balcon ou terrasse',
        valeur: pctSigne(e.exterieur),
        source: 'MeilleursAgents, onze plus grandes villes, mai 2020 (Marseille +15,9 %)',
        chemin: 'estimation.exterieur',
      },
      {
        libelle: 'Repère des charges de copropriété',
        valeur: `${nombre(e.charges.repereM2An)} € par m² et par an · effet borné à ±${pct(e.charges.borne)}`,
        source: 'Observatoire des charges de copropriété ARC/UNARC, 2024',
        chemin: 'estimation.charges',
      },
      {
        libelle: 'Largeur de la fourchette',
        valeur: `±${pct(e.marges.elevee)} · ±${pct(e.marges.moyenne)} · ±${pct(e.marges.faible)}`,
        source: 'Choix Deklic',
      },
    ],
  };
}
