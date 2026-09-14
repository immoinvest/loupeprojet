import type { CategorieVisite, QuestionPosee } from '@loupe/moteur';

import { dateCourte, euros, nombre, pourcentage } from '@/formatage/nombres';
import type { EtatReponse, Visite } from '@/stockage/projets';

import { libelleRisque } from './donnees-adresse';

export const CATEGORIES_VISITE: Readonly<Record<CategorieVisite, string>> = {
  documents: 'Documents à demander',
  diagnostics: 'Diagnostics et travaux',
  logement: 'Sur place, le logement',
  immeuble: "L'immeuble et la copropriété",
  quartier: 'Le quartier',
  vendeur: "Questions au vendeur ou à l'agence",
  exploitation: 'Exploitation locative',
};

export const ETATS_REPONSE: Readonly<Record<EtatReponse, string>> = {
  a_verifier: 'À vérifier',
  ok: 'OK',
  probleme: 'Problème',
  sans_objet: 'Sans objet',
};

export const ORDRE_ETATS: readonly EtatReponse[] = ['a_verifier', 'ok', 'probleme', 'sans_objet'];

/** Paramètres qui sont des montants en euros. */
const MONTANTS: ReadonlySet<string> = new Set(['honoraires', 'travaux', 'plafond']);

/** Le moteur donne des valeurs brutes ; ici on les met en forme selon ce qu'elles désignent. */
function formaterParametre(cle: string, valeur: number | string): string {
  if (cle === 'ecart') return pourcentage(Math.abs(Number(valeur)), 0);
  if (MONTANTS.has(cle)) return euros(Number(valeur));
  if (cle === 'risques') return String(valeur).split(',').map(libelleRisque).join(', ');
  if (cle === 'surface') {
    const n = Number(valeur);
    return nombre(n, Number.isInteger(n) ? 0 : 1);
  }
  return String(valeur);
}

/** Le texte d'une question posée, ses jetons `{nom}` remplacés par ses paramètres formatés. */
export function texteQuestion(question: Pick<QuestionPosee, 'texte' | 'parametres'>): string {
  return question.texte.replace(/\{(\w+)\}/g, (jeton: string, cle: string) => {
    const valeur = question.parametres[cle];
    return valeur === undefined ? jeton : formaterParametre(cle, valeur);
  });
}

export interface CompteVisite {
  readonly total: number;
  readonly repondues: number;
  readonly problemes: number;
}

/** « 12 sur 48 répondues, 2 problèmes ». */
export function phraseProgression(p: CompteVisite): string {
  const base = `${String(p.repondues)} sur ${String(p.total)} ${p.repondues === 1 ? 'répondue' : 'répondues'}`;
  if (p.problemes === 0) return base;
  return `${base}, ${String(p.problemes)} ${p.problemes === 1 ? 'problème' : 'problèmes'}`;
}

/** Lien du Rapport : « Préparer la visite : 48 questions » ou « Visite faite le 14 sept. 2026 · 2 problèmes ». */
export function phraseVisite(visite: Pick<Visite, 'faite' | 'date'>, p: CompteVisite): string {
  if (!visite.faite) {
    return `Préparer la visite : ${String(p.total)} question${p.total === 1 ? '' : 's'}`;
  }
  const quand =
    visite.date === undefined ? 'Visite faite' : `Visite faite le ${dateCourte(visite.date)}`;
  const problemes =
    p.problemes === 0
      ? 'aucun problème relevé'
      : `${String(p.problemes)} problème${p.problemes === 1 ? '' : 's'}`;
  return `${quand} · ${problemes}`;
}
