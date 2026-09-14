import { Landmark, PencilLine, ReceiptText } from 'lucide-react';
import type { JSX, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';

import { Chapo, Page, TitrePage } from '@/composants/mise-en-page';
import { Bouton, Carte, Pastille } from '@/composants/ui';
import { useProjets } from '@/stockage/ProjetsContext';
import { STATUTS, type ProjetEnregistre, type StatutProjet } from '@/stockage/projets';
import { TEXTES_GERER as T } from '@/textes/gerer-ecrans';

/** Au plus trois projets proposés, les offres faites d'abord ; les projets écartés ne le sont pas. */
const PROJETS_PROPOSES = 3;
const ORDRE: Readonly<Partial<Record<StatutProjet, number>>> = { offre: 0, visite: 1 };

export function projetsAReprendre(projets: readonly ProjetEnregistre[]): ProjetEnregistre[] {
  return projets
    .filter((p) => p.statut !== 'ecarte')
    .sort((a, b) => (ORDRE[a.statut] ?? 2) - (ORDRE[b.statut] ?? 2))
    .slice(0, PROJETS_PROPOSES);
}

function Porte({
  icone,
  titre,
  texte,
  children,
}: {
  icone: ReactNode;
  titre: string;
  texte: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <Carte className="h-full">
      <span
        aria-hidden="true"
        className="flex h-11 w-11 items-center justify-center rounded-encart bg-accent-doux text-accent"
      >
        {icone}
      </span>
      <h2 className="m-0 font-display text-[19px] font-semibold">{titre}</h2>
      <p className="m-0 text-[15px] text-encre-2">{texte}</p>
      <div className="mt-auto flex flex-col gap-2 pt-2">{children}</div>
    </Carte>
  );
}

/** Premier accès connecté : trois portes, chacune commence par un seul bouton. */
export function Portes(): JSX.Element {
  const { projets } = useProjets();
  const naviguer = useNavigate();
  const proposes = projetsAReprendre(projets);

  return (
    <Page espacement="large">
      <div className="flex flex-col gap-1.5">
        <TitrePage taille="accroche">{T.portesTitre}</TitrePage>
        <Chapo>{T.portesSous}</Chapo>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Porte
          icone={<ReceiptText size={22} />}
          titre={T.porteAchatTitre}
          texte={T.porteAchatTexte}
        >
          {proposes.length === 0 ? (
            <p className="m-0 text-sm text-encre-3">{T.porteAchatVide}</p>
          ) : (
            proposes.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-encart border border-bordure p-2.5"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-bold">{p.nom}</span>
                  <span className="text-xs text-encre-3">{STATUTS[p.statut]}</span>
                </span>
                <Bouton
                  variante="primaire"
                  title={`${T.porteAchatBouton} : ${p.nom}`}
                  onClick={() => {
                    void naviguer(`/gerer/pret/${p.id}`);
                  }}
                >
                  {T.porteAchatBouton}
                </Bouton>
              </div>
            ))
          )}
        </Porte>
        <Porte icone={<Landmark size={22} />} titre={T.porteBanqueTitre} texte={T.porteBanqueTexte}>
          <span className="self-start">
            <Pastille ton="neutre" compacte>
              {T.bientot}
            </Pastille>
          </span>
        </Porte>
        <Porte icone={<PencilLine size={22} />} titre={T.porteMainTitre} texte={T.porteMainTexte}>
          <Link
            to="/gerer/ajouter"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-bordure bg-surface px-4 text-sm font-semibold text-encre-2 no-underline hover:bg-accent-fond"
          >
            {T.porteMainTitre}
          </Link>
        </Porte>
      </div>
    </Page>
  );
}
