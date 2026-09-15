import type { JSX, ReactNode } from 'react';

import { GLOSSAIRE, texteDuTerme, type CodeTerme } from '@/textes/glossaire';

import { useModeDocument } from './document';
import { Info } from './info';

/**
 * Un terme technique dans une phrase ou un tableau, suivi de son icône ⓘ : `<Terme code="cfe">CFE</Terme>`.
 * Dans un document, le mot seul (une définition au milieu d'une phrase imprimée gênerait la lecture).
 */
export function Terme({ code, children }: { code: CodeTerme; children: ReactNode }): JSX.Element {
  const document = useModeDocument();
  if (document) return <>{children}</>;
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <Info sujet={GLOSSAIRE[code].terme} texte={texteDuTerme(code)} />
    </span>
  );
}
