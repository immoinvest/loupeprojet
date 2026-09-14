import type { Feu } from '@loupe/moteur';
import { ArrowRight } from 'lucide-react';
import type { JSX, ReactNode } from 'react';
import { Link } from 'react-router';

import { useModeDocument } from './document';

export type TonPastille = Feu | 'neutre' | 'accent';

const TONS: Readonly<Record<TonPastille, string>> = {
  bon: 'bg-bon-fond text-bon-texte',
  surveiller: 'bg-surveiller-fond text-surveiller-texte',
  probleme: 'bg-probleme-fond text-probleme-texte',
  inconnu: 'bg-bordure-douce text-encre-3',
  neutre: 'border border-bordure text-encre-2 bg-surface',
  accent: 'bg-accent-doux text-accent',
};

const POINTS: Readonly<Record<Feu, string>> = {
  bon: 'bg-bon',
  surveiller: 'bg-surveiller',
  probleme: 'bg-probleme',
  inconnu: 'bg-encre-4',
};

export function Point({ feu, taille = 10 }: { feu: Feu; taille?: number }): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={`inline-block rounded-full ${POINTS[feu]}`}
      style={{ width: taille, height: taille }}
    />
  );
}

export function Pastille({
  ton,
  feu,
  children,
  compacte = false,
}: {
  ton: TonPastille;
  feu?: Feu;
  children: ReactNode;
  compacte?: boolean;
}): JSX.Element {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full font-semibold ${TONS[ton]} ${
        compacte ? 'min-h-[30px] px-2.5 py-1 text-xs' : 'min-h-[44px] px-3.5 py-2 text-sm'
      }`}
    >
      {feu !== undefined && <Point feu={feu} />}
      {children}
    </span>
  );
}

export function Carte({
  children,
  className = '',
  id,
}: {
  children: ReactNode;
  className?: string;
  /** Ancre (sommaire de la page Méthode). */
  id?: string;
}): JSX.Element {
  // Deux utilitaires de même propriété ne s'annulent pas selon leur ordre dans l'attribut
  // mais selon leur ordre dans la feuille : le fond et la bordure passés par l'appelant
  // remplacent donc les valeurs par défaut au lieu de s'y ajouter.
  const fond = /(^|\s)bg-/.test(className) ? '' : 'bg-surface';
  const bordure = /(^|\s)border-(?!\d|[xytblrse](\s|$|-\d))/.test(className)
    ? ''
    : 'border-bordure';
  return (
    <section
      id={id}
      className={`flex flex-col gap-3 rounded-carte border ${bordure} ${fond} p-4 shadow-carte sm:p-6 print:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

const CLASSE_TITRE_CARTE = 'm-0 font-display text-[22px] font-semibold';

/**
 * Titre d'une carte : la question, son icône d'information juste à côté (`info`, hors du `h2`
 * pour ne pas changer son nom accessible) et une action à droite. En mode document, l'explication
 * et l'action s'empilent sous le titre.
 */
export function TitreCarte({
  children,
  info,
  action,
}: {
  children: ReactNode;
  info?: ReactNode;
  action?: ReactNode;
}): JSX.Element {
  const document = useModeDocument();
  if (document) {
    return (
      <div className="flex flex-col gap-2">
        <h2 className={CLASSE_TITRE_CARTE}>{children}</h2>
        {info}
        {action}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <div className="flex min-w-0 items-center gap-1">
        <h2 className={CLASSE_TITRE_CARTE}>{children}</h2>
        {info}
      </div>
      {action}
    </div>
  );
}

export type Volet = 'adresse' | 'hypotheses' | 'fiscalite' | 'revente' | 'visite';

/**
 * Lien vers un volet du projet, en bas de carte (« Voir la fiscalité »). Relatif à la route
 * `projets/:id`. Rien dans un document : il contient déjà tous les volets.
 */
export function LienOnglet({
  vers,
  children,
}: {
  vers: Volet;
  children: ReactNode;
}): JSX.Element | null {
  if (useModeDocument()) return null;
  return (
    <Link
      to={vers}
      className="mt-auto inline-flex min-h-11 items-center gap-1.5 self-start text-[15px] font-bold no-underline hover:underline"
    >
      {children}
      <ArrowRight size={18} aria-hidden="true" />
    </Link>
  );
}

export function GrosChiffre({
  children,
  ton = 'encre',
  complement,
}: {
  children: ReactNode;
  ton?: 'encre' | 'bon' | 'probleme' | 'surveiller';
  complement?: ReactNode;
}): JSX.Element {
  const couleur = {
    encre: 'text-encre',
    bon: 'text-bon',
    probleme: 'text-probleme',
    surveiller: 'text-surveiller',
  }[ton];
  return (
    <div
      className={`font-display text-[32px] leading-none font-bold sm:text-[40px] print:text-[40px] ${couleur}`}
    >
      {children}
      {complement !== undefined && (
        <span className="ml-2 text-lg font-semibold text-encre-3">{complement}</span>
      )}
    </div>
  );
}

export function Ligne({
  libelle,
  valeur,
  fort = false,
  tonValeur = '',
}: {
  libelle: ReactNode;
  valeur: ReactNode;
  fort?: boolean;
  tonValeur?: string;
}): JSX.Element {
  return (
    <div
      className={`flex justify-between gap-4 border-b border-bordure-douce py-2 text-[15px] last:border-b-0 ${
        fort ? 'pt-3 text-[17px] font-bold' : ''
      }`}
    >
      <span className="min-w-0">{libelle}</span>
      {/* Un montant ne se coupe jamais : c'est le libellé qui passe à la ligne. */}
      <span className={`shrink-0 text-right whitespace-nowrap ${tonValeur}`}>{valeur}</span>
    </div>
  );
}

type VarianteBouton = 'primaire' | 'secondaire';

function classeBouton(variante: VarianteBouton): string {
  const style =
    variante === 'primaire'
      ? 'bg-accent text-white hover:bg-accent-fonce'
      : 'border border-bordure bg-surface text-encre-2 hover:bg-accent-fond';
  return `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold ${style}`;
}

/** Un document n'a pas de boutons : rendu nul en mode document. */
export function Bouton({
  children,
  onClick,
  variante = 'secondaire',
  type = 'button',
  disabled = false,
  title,
  ouvre,
}: {
  children: ReactNode;
  onClick?: () => void;
  variante?: VarianteBouton;
  type?: 'button' | 'submit';
  disabled?: boolean;
  title?: string;
  /** Bouton qui ouvre une boîte : `true` quand elle est ouverte (aria-expanded). */
  ouvre?: boolean;
}): JSX.Element | null {
  if (useModeDocument()) return null;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-haspopup={ouvre === undefined ? undefined : 'dialog'}
      aria-expanded={ouvre}
      className={`${classeBouton(variante)} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {children}
    </button>
  );
}

/** Un lien de l'application habillé comme un bouton ; nul en mode document, comme `Bouton`. */
export function LienBouton({
  to,
  children,
  variante = 'secondaire',
}: {
  to: string;
  children: ReactNode;
  variante?: VarianteBouton;
}): JSX.Element | null {
  if (useModeDocument()) return null;
  return (
    <Link to={to} className={`${classeBouton(variante)} no-underline`}>
      {children}
    </Link>
  );
}
