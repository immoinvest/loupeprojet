import type { JSX } from 'react';

import { Page, TitrePage } from '@/composants/mise-en-page';
import { Bouton, Carte } from '@/composants/ui';
import { useArgent } from '@/gestion/argent/ArgentContext';
import { ERREURS_ARGENT, TEXTES_ARGENT as T } from '@/textes/gerer-argent';

/**
 * Tant que dépenses et prêts ne sont pas là : « Chargement… », « Bientôt disponible » (migration 0007
 * pas encore appliquée, le reste de Gérer marche), ou l'erreur et « Réessayer ».
 */
export function EtatArgentAbsent(): JSX.Element {
  const { statut, erreur, recharger } = useArgent();
  if (statut === 'indisponible') {
    return (
      <div className="flex flex-col gap-1">
        <p className="m-0 font-semibold text-encre">{T.bientot}</p>
        <p className="m-0 text-sm text-encre-2">{T.bientotTexte}</p>
      </div>
    );
  }
  if (statut === 'erreur') {
    return (
      <div className="flex flex-col gap-3">
        <p role="alert" className="m-0 text-encre-2">
          {ERREURS_ARGENT[erreur ?? 'inconnue']}
        </p>
        <div>
          <Bouton onClick={recharger}>{T.reessayer}</Bouton>
        </div>
      </div>
    );
  }
  return <p className="m-0 text-encre-3">{T.chargement}</p>;
}

/** Une page d'Argent (Argent, Nouvelle dépense, Modifier) avant que ses données soient là. */
export function AttenteArgent({ titre }: { readonly titre: string }): JSX.Element {
  return (
    <Page className="max-w-[760px]">
      <TitrePage>{titre}</TitrePage>
      <Carte>
        <EtatArgentAbsent />
      </Carte>
    </Page>
  );
}
