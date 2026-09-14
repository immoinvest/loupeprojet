import type { JSX } from 'react';

import { phraseProgression, type CompteVisite } from '@/textes/visite';

/** Barre et phrase : « 12 sur 48 répondues, 2 problèmes ». */
export function Progression({ compte }: { compte: CompteVisite }): JSX.Element {
  const part = compte.total === 0 ? 0 : Math.round((compte.repondues / compte.total) * 100);
  return (
    <div className="flex max-w-[560px] flex-col gap-1.5">
      <div
        role="progressbar"
        aria-label="Questions répondues"
        aria-valuemin={0}
        aria-valuemax={compte.total}
        aria-valuenow={compte.repondues}
        className="h-2 overflow-hidden rounded-full bg-bordure-douce"
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${String(part)}%` }} />
      </div>
      <span className="text-sm font-semibold text-encre-2">{phraseProgression(compte)}</span>
    </div>
  );
}
