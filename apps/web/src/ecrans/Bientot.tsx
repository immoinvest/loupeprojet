import type { JSX } from 'react';

import { Chapo, Page, TitrePage } from '@/composants/mise-en-page';

export function Bientot({ titre, phrase }: { titre: string; phrase: string }): JSX.Element {
  return (
    <Page espacement="serre">
      <TitrePage>{titre}</TitrePage>
      <Chapo>{phrase}</Chapo>
    </Page>
  );
}
