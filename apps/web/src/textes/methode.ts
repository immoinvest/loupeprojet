import type { Regles } from '@loupe/moteur';

import type { Defauts } from '@/analyses';

import { pct, pctSigne, type ConstanteMethode, type SectionMethode } from './methode-commun';
import {
  sectionAcquisition,
  sectionCashflow,
  sectionCredit,
  sectionRendements,
} from './methode-financement';
import {
  sectionLmnpReel,
  sectionMicroBic,
  sectionMicroFoncier,
  sectionNuReel,
  sectionRevente,
} from './methode-fiscalite';
import { sectionDefauts, sectionScenarios, sectionTri, sectionVerdict } from './methode-verdict';

/**
 * La page « Comment c'est calculé » : une section par module du moteur, générée depuis
 * les règles datées (aucune constante recopiée) et les défauts lus dans le code.
 */
export function sectionsMethode(regles: Regles, defauts: Defauts): SectionMethode[] {
  const sections: readonly SectionMethode[] = [
    sectionAcquisition(regles),
    sectionCredit(regles),
    sectionCashflow(regles, defauts),
    sectionRendements(),
    sectionMicroBic(regles),
    sectionLmnpReel(regles),
    sectionMicroFoncier(regles),
    sectionNuReel(regles),
    sectionRevente(regles, defauts),
    sectionTri(),
    sectionVerdict(regles),
    sectionScenarios(regles),
    sectionDefauts(defauts),
  ];
  return sections.map((s) => ({
    ...s,
    constantes: s.constantes.map((c): ConstanteMethode => ({
      ...c,
      aConfirmer: c.chemin !== undefined && regles.aConfirmer.includes(c.chemin),
    })),
  }));
}

export { pct, pctSigne, type ConstanteMethode, type SectionMethode };
