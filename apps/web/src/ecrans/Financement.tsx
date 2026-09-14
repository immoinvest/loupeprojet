import { useMemo, type JSX } from 'react';

import { lienSimulateurPret, simulationDepuisResultats } from '@/analyses';
import { useModeDocument } from '@/composants/document';
import { Page, TitrePage } from '@/composants/mise-en-page';
import { Carte, LienBouton, TitreCarte } from '@/composants/ui';
import { useProjetCourant } from '@/coque/ProjetLayout';
import { GROUPE_FINANCEMENT } from '@/hypotheses';
import { TEXTES_FINANCEMENT as T } from '@/textes/financement';

import { CarteCout, CarteCouverture, CarteOrigine } from './financement/Cartes';
import { TableauAnnuel } from './financement/TableauAnnuel';
import { GrilleHypotheses, LignesHypotheses } from './hypotheses/GrilleHypotheses';

/** L'onglet Financement : les hypothèses du prêt, puis ce qu'il coûte et ce qu'il couvre. */
export function Financement(): JSX.Element {
  const { enregistre, resultats: r } = useProjetCourant();
  const document = useModeDocument();
  const simulateur = useMemo(() => lienSimulateurPret(simulationDepuisResultats(r)), [r]);

  return (
    <Page>
      <TitrePage taille="volet">{T.titre}</TitrePage>

      <Carte>
        <TitreCarte action={<LienBouton to={simulateur}>{T.simuler}</LienBouton>}>
          {T.pret}
        </TitreCarte>
        {document ? (
          <LignesHypotheses groupe={GROUPE_FINANCEMENT} />
        ) : (
          <GrilleHypotheses key={enregistre.id} groupe={GROUPE_FINANCEMENT} />
        )}
      </Carte>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 print:grid-cols-2">
        <CarteCout r={r} />
        <CarteCouverture r={r} />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 print:grid-cols-2">
        <CarteOrigine r={r} />
        <TableauAnnuel f={r.financement} />
      </div>
    </Page>
  );
}
