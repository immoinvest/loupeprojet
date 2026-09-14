import type { DpeAdresse, NiveauRisqueAdresse } from '@/enrichissement';
import type { LoyerBien } from '@/enrichissement/loyer';
import { dateCourte, euros, nombre } from '@/formatage/nombres';

export const LIBELLES_NIVEAUX: Readonly<Record<NiveauRisqueAdresse, string>> = {
  fort: 'fort',
  moyen: 'moyen',
  faible: 'faible',
  inconnu: 'non connu',
  absent: 'non concerné',
};

/** Les risques Géorisques en français courant, pour les phrases du verdict et de la visite. */
const LIBELLES_RISQUES: Readonly<Record<string, string>> = {
  inondation: 'inondation',
  remonteeNappe: 'remontée de nappe',
  risqueCotier: 'risques côtiers',
  seisme: 'séisme',
  mouvementTerrain: 'mouvements de terrain',
  reculTraitCote: 'recul du trait de côte',
  retraitGonflementArgile: 'retrait-gonflement des argiles',
  avalanche: 'avalanche',
  feuForet: 'feu de forêt',
  eruptionVolcanique: 'volcan',
  cyclone: 'vent violent',
  radon: 'radon',
  icpe: 'installations industrielles classées',
  nucleaire: 'nucléaire',
  canalisationsMatieresDangereuses: 'canalisations de matières dangereuses',
  pollutionSols: 'pollution des sols',
  ruptureBarrage: 'rupture de barrage',
  risqueMinier: 'risques miniers',
};

/** « retraitGonflementArgile » → « retrait-gonflement des argiles » ; un type inconnu reste tel quel. */
export function libelleRisque(type: string): string {
  return LIBELLES_RISQUES[type] ?? type;
}

export const PHRASES_DONNEES_ADRESSE = {
  dpeAucun: 'Aucun DPE enregistré à moins de 30 m de l’adresse.',
  dpeIndisponible: 'La base des DPE de l’ADEME ne répond pas pour le moment.',
  dpeChoisir: 'Plusieurs logements à cette adresse : choisissez le vôtre.',
  dpeApplique: 'DPE du projet',
  risquesIndisponibles:
    'Géorisques ne répond pas pour le moment : les risques ne sont pas chargés.',
  risquesAucun: 'Aucun risque recensé à cette adresse.',
  risquesAppliques: 'Les risques présents à l’adresse comptent dans le verdict.',
  loyerIndisponible: 'Pas de loyer de marché publié pour cette commune.',
  loyerApplique: 'Loyer visé du projet',
} as const;

/** « 1er étage · 72,5 m² · DPE du 8 juil. 2024 », ou « Immeuble entier · … ». */
export function descriptionDpe(dpe: DpeAdresse): string {
  const lieu =
    dpe.typeBatiment === 'immeuble'
      ? 'Immeuble entier'
      : (dpe.complement ??
        (dpe.etage === null
          ? 'Logement'
          : dpe.etage === 0
            ? 'Rez-de-chaussée'
            : `${nombre(dpe.etage)}e étage`));
  const surface =
    dpe.surface === null
      ? []
      : [`${nombre(dpe.surface, Number.isInteger(dpe.surface) ? 0 : 1)} m²`];
  const date = dpe.date === null ? [] : [`DPE du ${dateCourte(dpe.date)}`];
  return [lieu, ...surface, ...date].join(' · ');
}

/** « 720 € par mois hors charges en location nue, 828 € en meublé ; fourchette des annonces : 610 € à 850 €. » */
export function phraseLoyer(loyer: LoyerBien): string {
  return `${euros(loyer.nuMensuel)} par mois hors charges en location nue, ${euros(loyer.meubleMensuel)} en meublé ; fourchette des annonces : ${euros(loyer.basMensuel)} à ${euros(loyer.hautMensuel)}.`;
}
