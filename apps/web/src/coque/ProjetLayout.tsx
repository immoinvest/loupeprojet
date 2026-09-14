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
import { useProjets } from '@/stockage/ProjetsContext';
import { STATUTS, StatutProjetSchema, type ProjetEnregistre } from '@/stockage/projets';
import { libellePrixEnTete } from '@/textes/achat';
import { MODES } from '@/textes/regimes';
import { visiteDe } from '@/visite';

import { BoutonPartager } from './BoutonPartager';
import { defilementPourVoir } from './defilement';
import { useMesuresEnTete } from './entete';

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
  // Sur le projet, pas sur l'enregistrement : une réponse de visite ne recalcule rien.
  const resultats = useMemo(() => calculerProjet(enregistre.projet), [enregistre.projet]);
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
  { to: 'adresse', libelle: 'Estimation' },
  { to: 'hypotheses', libelle: 'Hypothèses' },
  { to: 'fiscalite', libelle: 'Fiscalité' },
  { to: 'revente', libelle: 'Revente' },
  { to: 'visite', libelle: 'Visite' },
] as const;

/** Un volet occupe toute la hauteur de sa bande : son trait actif se pose sur celui de l'en-tête. */
const onglet = ({ isActive }: { isActive: boolean }): string =>
  `flex h-full shrink-0 items-center border-b-2 px-4 text-[15px] font-semibold whitespace-nowrap ${
    isActive ? 'border-accent text-accent' : 'border-transparent text-encre-3 hover:text-encre'
  }`;

/** Sous 1 536 px, la bande des volets va d'un bord à l'autre de l'en-tête et défile au doigt. */
const BANDE_ONGLETS =
  'defilement-discret relative order-last -mx-4 flex h-11 gap-1 overflow-x-auto px-4 sm:-mx-6 sm:px-6 md:col-span-2 lg:-mx-10 lg:px-10 2xl:order-none 2xl:mx-0 2xl:h-14 2xl:overflow-visible 2xl:px-0';

/**
 * L'en-tête reste collé en haut du contenu qui défile. Sous 768 px, son `top` négatif (mesuré :
 * le début de la bande) ne laisse en vue que la bande des volets ; au-delà, tout l'en-tête.
 */
const EN_TETE =
  'sticky top-[calc(-1*var(--decalage-entete,0px))] z-20 grid gap-x-4 border-b border-bordure bg-surface md:top-0 md:grid-cols-[minmax(0,1fr)_auto] md:items-center 2xl:flex 2xl:items-stretch print:static print:hidden';

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
 * Compact, pour ne pas manger l'écran une fois collé. Téléphone : nom (fil d'Ariane, prix · mode),
 * puis les actions, puis la bande des volets. De 768 à 1 535 px : nom · prix · mode et actions sur
 * une rangée de 48 px, volets dessous (44 px). À partir de 1 536 px : une seule rangée de 56 px.
 */
function EnTete(): JSX.Element {
  const { enregistre, resultats } = useProjetCourant();
  const { changerStatut } = useProjets();
  const naviguer = useNavigate();
  const bandeRef = useOngletActifEnVue();
  const { location } = enregistre.projet.hypotheses;
  const enTeteRef = useRef<HTMLElement>(null);
  useMesuresEnTete(enTeteRef, bandeRef);
  // Visite faite : l'onglet quitte la bande ; la page reste ouverte par le lien du Rapport.
  const onglets = ONGLETS.filter((o) => o.to !== 'visite' || !visiteDe(enregistre).faite);

  return (
    <header ref={enTeteRef} className={`${EN_TETE} ${MARGES_LATERALES}`}>
      <div className="flex min-w-0 flex-col justify-center gap-0.5 py-2 md:h-12 md:flex-row md:items-center md:gap-2 md:py-0 2xl:h-14">
        <span className="min-w-0 text-[13px] break-words text-encre-3 md:truncate">
          <Link
            to="/projets"
            className="text-encre-3 no-underline hover:text-accent pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
          >
            Mes projets
          </Link>
          {' / '}
          <span className="font-display text-[17px] font-bold text-encre">{enregistre.nom}</span>
        </span>
        <span className="shrink-0 font-display text-lg font-bold md:text-[15px] md:font-semibold md:text-encre-2">
          {libellePrixEnTete(resultats.achat)} · {MODES[location.mode]}
        </span>
      </div>
      <div className="hidden 2xl:block 2xl:flex-1" />
      <nav ref={bandeRef} aria-label="Volets du rapport" className={BANDE_ONGLETS}>
        {onglets.map((o) => (
          <NavLink key={o.to} to={o.to} end={o.to === ''} className={onglet}>
            {o.libelle}
          </NavLink>
        ))}
      </nav>
      <div className="hidden 2xl:block 2xl:flex-1" />
      <div className="flex min-h-11 flex-wrap items-center gap-2 pb-2 md:h-12 md:flex-nowrap md:justify-end md:pb-0 2xl:h-14">
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
      {/* Le cadre porte les variables publiées par l'en-tête : décalage et hauteur collée. */}
      <div data-cadre-projet>
        <EnTete />
        <Outlet />
      </div>
    </FournisseurProjet>
  );
}
