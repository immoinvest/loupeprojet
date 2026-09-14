import type { JSX, ReactNode } from 'react';

/*
 * Marges et titres des écrans, à un seul endroit. La base vaut pour le téléphone, les préfixes
 * `sm` et `lg` élargissent. Chaque valeur d'écran large a son équivalent `print:` : une page A4
 * mesure environ 700 px, et le document imprimé garde la mise en page d'ordinateur.
 */

/** Marges latérales : 16 px sur téléphone, 24 px sur tablette, 40 px sur ordinateur et sur papier. */
export const MARGES_LATERALES = 'px-4 sm:px-6 lg:px-10 print:px-10';

const ESPACEMENTS = {
  serre: 'gap-2',
  moyen: 'gap-4',
  normal: 'gap-5',
  large: 'gap-6',
} as const;

const HAUTS = {
  normal: 'pt-6 lg:pt-8 print:pt-8',
  serre: 'pt-3 lg:pt-4 print:pt-4',
} as const;

export function Page({
  children,
  espacement = 'normal',
  haut = 'normal',
  className = '',
}: {
  children: ReactNode;
  espacement?: keyof typeof ESPACEMENTS;
  /** `serre` quand une barre collante ouvre la page (Hypothèses). */
  haut?: keyof typeof HAUTS;
  /** Largeur maximale de la page, par exemple `max-w-[760px]`. */
  className?: string;
}): JSX.Element {
  return (
    <div
      className={`flex flex-col ${ESPACEMENTS[espacement]} ${MARGES_LATERALES} ${HAUTS[haut]} pb-8 lg:pb-10 print:pb-10 ${className}`}
    >
      {children}
    </div>
  );
}

const TAILLES_TITRE = {
  /** Phrase d'accroche : verdict du rapport, Nouveau projet, Extension. */
  accroche:
    'text-[30px] leading-[1.15] text-balance sm:text-[36px] lg:text-[40px] lg:leading-[1.1] print:text-[40px] print:leading-[1.1]',
  page: 'text-[28px] leading-tight sm:text-[32px] lg:text-[34px] print:text-[34px]',
  volet: 'text-[26px] leading-tight sm:text-[30px] lg:text-[32px] print:text-[32px]',
  section: 'text-2xl leading-tight sm:text-[28px] print:text-[28px]',
} as const;

export function TitrePage({
  children,
  taille = 'page',
  className = '',
}: {
  children: ReactNode;
  taille?: keyof typeof TAILLES_TITRE;
  /** Largeur de ligne, par exemple `max-w-[22ch]`. */
  className?: string;
}): JSX.Element {
  return (
    <h1
      className={`m-0 font-display font-bold tracking-tight ${TAILLES_TITRE[taille]} ${className}`}
    >
      {children}
    </h1>
  );
}

/** Paragraphe d'introduction, sous le titre de la page. */
export function Chapo({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return <p className={`m-0 max-w-[64ch] text-[17px] text-encre-2 ${className}`}>{children}</p>;
}
