import type { JSX } from 'react';
import { Link } from 'react-router';

import { Chapo, Page, TitrePage } from '@/composants/mise-en-page';
import { TEXTES_GERER as T } from '@/textes/gerer-ecrans';

const CLASSE_PRINCIPAL =
  'inline-flex min-h-[44px] items-center justify-center rounded-full bg-accent px-5 text-[15px] font-semibold text-white no-underline hover:bg-accent-fonce';
const CLASSE_SECONDAIRE =
  'inline-flex min-h-[44px] items-center justify-center rounded-full border border-bordure bg-surface px-5 text-[15px] font-semibold text-encre-2 no-underline hover:bg-accent-fond';

/** Gérer sans compte : ce que ça fait, pourquoi il faut un compte, et le chemin pour en ouvrir un. */
export function SansCompte(): JSX.Element {
  return (
    <Page espacement="large" className="max-w-[760px]">
      <TitrePage taille="accroche">{T.sansCompteTitre}</TitrePage>
      <Chapo>{T.sansCompteTexte}</Chapo>
      <div className="flex flex-wrap gap-3">
        <Link to="/connexion?retour=/gerer" className={CLASSE_PRINCIPAL}>
          {T.seConnecter}
        </Link>
        <Link to="/projets" className={CLASSE_SECONDAIRE}>
          {T.continuerAnalyser}
        </Link>
      </div>
    </Page>
  );
}
