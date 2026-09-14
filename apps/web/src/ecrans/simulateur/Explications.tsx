import type { JSX } from 'react';

import { useModeDocument } from '@/composants/document';
import { EXPLICATIONS_SIMULATEUR } from '@/textes/simulateur';

const LIGNES: readonly { readonly titre: string; readonly texte: string }[] = [
  { titre: 'TAEG', texte: EXPLICATIONS_SIMULATEUR.taeg },
  { titre: "Taux d'endettement", texte: EXPLICATIONS_SIMULATEUR.endettement },
  { titre: 'Frais bancaires', texte: EXPLICATIONS_SIMULATEUR.fraisFinances },
  { titre: 'Assurance', texte: EXPLICATIONS_SIMULATEUR.assurance },
];

/** Les quatre explications du simulateur, repliées ; toujours visibles dans un document. */
export function Explications(): JSX.Element {
  const document = useModeDocument();
  const liste = (
    <dl className="m-0 flex flex-col gap-3 rounded-encart bg-accent-fond p-3 text-sm leading-relaxed text-encre-2">
      {LIGNES.map((l) => (
        <div key={l.titre}>
          <dt className="font-bold text-encre">{l.titre}</dt>
          <dd className="m-0">{l.texte}</dd>
        </div>
      ))}
    </dl>
  );
  if (document) return liste;
  return (
    <details className="text-sm">
      <summary className="cursor-pointer list-none font-bold text-accent pointer-coarse:min-h-11 pointer-coarse:py-3">
        Comment c'est calculé ?
      </summary>
      <div className="mt-2">{liste}</div>
    </details>
  );
}
