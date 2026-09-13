import { calculerProjet, type Resultats } from '@loupe/moteur';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type JSX,
  type ReactNode,
  type RefObject,
} from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router';

import { MARGES_LATERALES, Page, TitrePage } from '@/composants/mise-en-page';
import { Bouton } from '@/composants/ui';
import { euros } from '@/formatage/nombres';
import { useProjets } from '@/stockage/ProjetsContext';
import { STATUTS, StatutProjetSchema, type ProjetEnregistre } from '@/stockage/projets';
import { MODES } from '@/textes/regimes';

import { BoutonPartager } from './BoutonPartager';
import { defilementPourVoir } from './defilement';

export interface ContexteProjet {
  readonly enregistre: ProjetEnregistre;
  readonly resultats: Resultats;
}

const Contexte = createContext<ContexteProjet | null>(null);

export function useProjetCourant(): ContexteProjet {
  const c = useContext(Contexte);
  if (c === null) throw new Error('useProjetCourant hors de ProjetLayout');
  return c;
}

/** Met un projet (enregistré ou partagé) et ses résultats à disposition des écrans. */
export function FournisseurProjet({
  enregistre,
  children,
}: {
  enregistre: ProjetEnregistre;
  children: ReactNode;
}): JSX.Element {
  const resultats = useMemo(() => calculerProjet(enregistre.projet), [enregistre]);
  return <Contexte.Provider value={{ enregistre, resultats }}>{children}</Contexte.Provider>;
}

export function ProjetIntrouvable(): JSX.Element {
  return (
    <Page espacement="serre">
      <TitrePage>Projet introuvable</TitrePage>
      <p className="m-0 text-[17px] text-encre-2">
        Il a peut-être été supprimé. <Link to="/projets">Retour à mes projets</Link>.
      </p>
    </Page>
  );
}

const ONGLETS = [
  { to: '', libelle: 'Rapport' },
  { to: 'hypotheses', libelle: 'Hypothèses' },
  { to: 'fiscalite', libelle: 'Fiscalité' },
  { to: 'revente', libelle: 'Revente' },
  { to: 'visite', libelle: 'Visite' },
] as const;

const onglet = ({ isActive }: { isActive: boolean }): string =>
  `shrink-0 border-b-2 px-4 py-3 text-[15px] font-semibold whitespace-nowrap ${
    isActive ? 'border-accent text-accent' : 'border-transparent text-encre-3 hover:text-encre'
  }`;

/** Sous 1 536 px, la bande des volets va d'un bord à l'autre de l'en-tête et défile au doigt. */
const BANDE_ONGLETS =
  'defilement-discret relative order-last -mx-4 flex gap-1 overflow-x-auto px-4 sm:-mx-6 sm:px-6 md:col-span-2 lg:-mx-10 lg:px-10 2xl:order-none 2xl:mx-0 2xl:overflow-visible 2xl:px-0';

/** Ramène l'onglet actif dans la partie visible de la bande, par exemple un volet ouvert directement. */
function useOngletActifEnVue(): RefObject<HTMLElement | null> {
  const bandeRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    const bande = bandeRef.current;
    const actif = bande?.querySelector<HTMLElement>('[aria-current="page"]') ?? null;
    if (bande === null || actif === null) return;
    bande.scrollLeft = defilementPourVoir(
      { debut: actif.offsetLeft, largeur: actif.offsetWidth },
      { defilement: bande.scrollLeft, largeurVisible: bande.clientWidth },
    );
  }, [pathname]);

  return bandeRef;
}

/**
 * Téléphone : nom et prix, puis les actions qui passent à la ligne, puis la bande des volets.
 * De 768 à 1 535 px : nom et actions sur une rangée, volets dessous. À partir de 1 536 px : une
 * seule rangée ; en dessous, elle écraserait le nom du projet sur quelques mots par ligne.
 */
function EnTete(): JSX.Element {
  const { enregistre } = useProjetCourant();
  const { changerStatut } = useProjets();
  const naviguer = useNavigate();
  const bandeRef = useOngletActifEnVue();
  const { achat, location } = enregistre.projet.hypotheses;

  return (
    <header
      className={`grid gap-x-4 gap-y-2 border-b border-bordure bg-surface pt-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end 2xl:flex 2xl:pt-4 ${MARGES_LATERALES} print:hidden`}
    >
      <div className="flex min-w-0 flex-col gap-1 2xl:pb-3.5">
        <span className="text-[13px] break-words text-encre-3">
          <Link
            to="/projets"
            className="text-encre-3 no-underline hover:text-accent pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
          >
            Mes projets
          </Link>{' '}
          / {enregistre.nom}
        </span>
        <span className="font-display text-lg font-bold sm:text-xl">
          {euros(achat.prix)} · {MODES[location.mode]}
        </span>
      </div>
      <div className="hidden 2xl:block 2xl:flex-1" />
      <nav ref={bandeRef} aria-label="Volets du rapport" className={BANDE_ONGLETS}>
        {ONGLETS.map((o) => (
          <NavLink key={o.to} to={o.to} end={o.to === ''} className={onglet}>
            {o.libelle}
          </NavLink>
        ))}
      </nav>
      <div className="hidden 2xl:block 2xl:flex-1" />
      <div className="flex flex-wrap items-center gap-2 md:justify-end 2xl:flex-nowrap 2xl:pb-3">
        <label className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-bordure bg-surface px-3.5 text-sm font-semibold text-encre-2">
          <span className="sr-only">Statut du projet</span>
          <select
            value={enregistre.statut}
            onChange={(e) => {
              changerStatut(enregistre.id, StatutProjetSchema.parse(e.target.value));
            }}
            className="bg-transparent font-semibold outline-none pointer-coarse:text-base"
          >
            {StatutProjetSchema.options.map((s) => (
              <option key={s} value={s}>
                {STATUTS[s]}
              </option>
            ))}
          </select>
        </label>
        <Bouton
          onClick={() => {
            void naviguer(`/projets/${enregistre.id}/imprimer`, { state: { imprimer: true } });
          }}
        >
          PDF
        </Bouton>
        <BoutonPartager enregistre={enregistre} />
      </div>
    </header>
  );
}

export function ProjetLayout(): JSX.Element {
  const { id } = useParams();
  const { trouver } = useProjets();
  const enregistre = trouver(id);

  if (enregistre === undefined) return <ProjetIntrouvable />;

  return (
    <FournisseurProjet enregistre={enregistre}>
      <EnTete />
      <Outlet />
    </FournisseurProjet>
  );
}
