import { copro, dpeParmi, maison, parametreDpe, tous } from '../contexte';
import type { QuestionVisite } from '../types';

const ALUR_PROMESSE = 'Loi ALUR, art. L721-2 du CCH (documents annexés à la promesse de vente)';

/** Documents à demander à l'agence, au vendeur ou au syndic, avant ou pendant la visite. */
export const QUESTIONS_DOCUMENTS: readonly QuestionVisite[] = [
  {
    id: 'DOC_TITRE_PLAN',
    categorie: 'documents',
    texte:
      "Le titre de propriété et le plan du logement sont-ils fournis ? Vérifier que le lot vendu (cave, parking, grenier) correspond à l'annonce.",
    source: 'Notaires de France, « Acheter un logement : les documents à réunir »',
  },
  {
    id: 'DOC_TAXE_FONCIERE',
    categorie: 'documents',
    texte: 'Le dernier avis de taxe foncière : quel montant par an ?',
    source: 'ANIL, « Les charges et impôts du propriétaire bailleur »',
    valeur: { chemin: 'hypotheses.charges.taxeFonciere', type: 'euros' },
  },
  {
    id: 'DOC_CHARGES_COPRO',
    categorie: 'documents',
    condition: copro,
    texte:
      'Les derniers appels de fonds ou le décompte annuel des charges : combien de charges de copropriété par an ?',
    source: ALUR_PROMESSE,
    valeur: { chemin: 'hypotheses.charges.coproAnnuel', type: 'euros' },
  },
  {
    id: 'DOC_PV_AG',
    categorie: 'documents',
    condition: copro,
    texte:
      "Les procès-verbaux des trois dernières assemblées générales et le carnet d'entretien{detail} : travaux votés, litiges, impayés.",
    source: ALUR_PROMESSE,
    parametres: (c) => {
      const { lots } = c.projet.bien.copro ?? {};
      const { annee } = c.projet.bien;
      const morceaux = [
        lots === undefined ? '' : `${String(lots)} lots`,
        annee === undefined ? '' : `immeuble de ${String(annee)}`,
      ].filter((m) => m !== '');
      return { detail: morceaux.length === 0 ? '' : ` (${morceaux.join(', ')})` };
    },
  },
  {
    id: 'DOC_REGLEMENT_COPRO',
    categorie: 'documents',
    condition: copro,
    texte:
      "Le règlement de copropriété et l'état descriptif de division : destination de l'immeuble, clauses sur la location (meublé, courte durée, professions), répartition des charges.",
    source: `${ALUR_PROMESSE} ; loi Le Meur du 19 novembre 2024 (clauses sur les meublés de tourisme)`,
  },
  {
    id: 'DOC_FICHE_SYNTHETIQUE',
    categorie: 'documents',
    condition: copro,
    texte:
      "La fiche synthétique de la copropriété et son numéro d'immatriculation au registre national des copropriétés.",
    source: 'Loi ALUR, art. 8-2 de la loi du 10 juillet 1965',
  },
  {
    id: 'DOC_PRE_ETAT_DATE',
    categorie: 'documents',
    condition: copro,
    texte:
      'Le pré-état daté : impayés du vendeur, dettes de la copropriété envers les fournisseurs, fonds de travaux attaché au lot.',
    source: ALUR_PROMESSE,
  },
  {
    id: 'DOC_DTG_PPT',
    categorie: 'documents',
    condition: copro,
    texte:
      'Un diagnostic technique global (DTG) ou un plan pluriannuel de travaux (PPT) existe-t-il ? Quels travaux y sont prévus, pour quel montant ?',
    source: 'Loi Climat et résilience du 22 août 2021, art. 171 (plan pluriannuel de travaux)',
  },
  {
    id: 'DOC_DPE_COMPLET',
    categorie: 'documents',
    texte:
      "Le DPE complet, pas seulement l'étiquette : date, consommation, étiquette climat, recommandations de travaux.",
    source: 'Service-public.fr, « Diagnostic de performance énergétique (DPE) »',
  },
  {
    id: 'DOC_ERP',
    categorie: 'documents',
    texte:
      "L'état des risques et pollutions (ERP) de moins de six mois : risques naturels, miniers, technologiques, radon, pollution des sols.",
    source:
      "Service-public.fr, « État des risques et pollutions » ; art. L125-5 du Code de l'environnement",
  },
  {
    id: 'DOC_AUDIT_ENERGETIQUE',
    categorie: 'documents',
    condition: tous(maison, dpeParmi('E', 'F', 'G')),
    texte:
      "Maison classée {dpe} : l'audit énergétique réglementaire, obligatoire à la vente, est-il fourni avec ses scénarios de travaux chiffrés ?",
    source:
      'Service-public.fr, « Audit énergétique » (maisons F et G depuis avril 2023, E depuis janvier 2025)',
    parametres: parametreDpe,
  },
  {
    id: 'DOC_ASSAINISSEMENT',
    categorie: 'documents',
    condition: maison,
    texte:
      "Le contrôle de l'assainissement : raccordement au tout-à-l'égout, ou rapport du SPANC de moins de trois ans pour une fosse (mise en conformité dans l'année si elle est non conforme).",
    source: 'Service-public.fr, « Diagnostic assainissement »',
  },
];
