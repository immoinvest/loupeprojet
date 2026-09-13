import type { JSX } from 'react';

export function Bientot({ titre, phrase }: { titre: string; phrase: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-2 p-10">
      <h1 className="m-0 font-display text-3xl font-bold">{titre}</h1>
      <p className="m-0 max-w-[60ch] text-[17px] text-encre-2">{phrase}</p>
    </div>
  );
}
