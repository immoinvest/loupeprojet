import type { Feu } from '@loupe/moteur';
import type { JSX, ReactNode } from 'react';

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
  return (
    <section
      id={id}
      className={`flex flex-col gap-3 rounded-carte border border-bordure bg-surface p-4 shadow-carte sm:p-6 print:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

export function TitreCarte({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}): JSX.Element {
  // En mode document, l'action (souvent une explication dépliée) passe sous le titre.
  const document = useModeDocument();
  return (
    <div
      className={
        document
          ? 'flex flex-col gap-2'
          : 'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1'
      }
    >
      <h2 className="m-0 font-display text-[22px] font-semibold">{children}</h2>
      {action}
    </div>
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

const CLASSE_EXPLICATION = 'rounded-encart bg-accent-fond p-3 leading-relaxed text-encre-2';

/** Explication longue, repliée par défaut ; toujours visible dans un document. */
export function Pourquoi({
  texte,
  libelle = 'Pourquoi ?',
}: {
  texte: string;
  libelle?: string;
}): JSX.Element {
  if (useModeDocument()) {
    return <p className={`m-0 text-sm ${CLASSE_EXPLICATION}`}>{texte}</p>;
  }
  return (
    <details className="text-sm">
      <summary className="cursor-pointer list-none font-bold text-accent pointer-coarse:py-3">
        {libelle}
      </summary>
      <p className={`mt-2 mb-0 ${CLASSE_EXPLICATION}`}>{texte}</p>
    </details>
  );
}

/** Un document n'a pas de boutons : rendu nul en mode document. */
export function Bouton({
  children,
  onClick,
  variante = 'secondaire',
  type = 'button',
  disabled = false,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variante?: 'primaire' | 'secondaire';
  type?: 'button' | 'submit';
  disabled?: boolean;
  title?: string;
}): JSX.Element | null {
  if (useModeDocument()) return null;
  const style =
    variante === 'primaire'
      ? 'bg-accent text-white hover:bg-accent-fonce'
      : 'border border-bordure bg-surface text-encre-2 hover:bg-accent-fond';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${style}`}
    >
      {children}
    </button>
  );
}
