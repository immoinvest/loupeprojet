import { jourLocal, periodeDe, type EtatArgent, type EtatGestion } from '@loupe/gestion';
import type { JSX } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';

import { Page, TitrePage } from '@/composants/mise-en-page';
import { Carte, LienBouton, Ligne, TitreCarte } from '@/composants/ui';
import { useArgent } from '@/gestion/argent/ArgentContext';
import {
  bienDuFiltre,
  bilanDeLaVue,
  categoriesDuBilan,
  courbeDeLaVue,
  donneesArgent,
  periodesDuChoix,
  TOUS_LES_BIENS,
  vueDepuisRecherche,
  type Vue,
} from '@/gestion/argent/page';
import { moisEnLettres, montant } from '@/gestion/format';
import { useGestion } from '@/gestion/GestionContext';
import { cheminDe, lienArgent, lienNouvelleDepense } from '@/gestion/parcours';
import {
  CATEGORIES_TEXTE,
  nomDeLaVue,
  phraseArgent,
  TEXTES_ARGENT as T,
} from '@/textes/gerer-argent';
import { avecMajuscule } from '@/textes/gerer-ecrans';

import { EcranAttente } from '../EcranAttente';
import { AttenteArgent } from './AttenteArgent';
import { LignesDeFlux } from './CarteArgent';
import { Courbe } from './Courbe';
import { ListeChoix } from './ListeChoix';
import { DepensesDeLaPeriode, ParBien } from './ListesArgent';

type TypeVue = Vue['type'];

function PageArgent({
  gestion,
  argent,
}: {
  readonly gestion: EtatGestion;
  readonly argent: EtatArgent;
}): JSX.Element {
  const [recherche] = useSearchParams();
  const naviguer = useNavigate();
  const ici = cheminDe(useLocation());
  const aujourdhui = jourLocal(new Date());
  const vue = vueDepuisRecherche(recherche, aujourdhui);
  const bienId = bienDuFiltre(recherche, gestion.biens);
  const tout = donneesArgent(gestion, argent);
  const bilan = bilanDeLaVue(tout, vue, bienId);
  const biens = [...gestion.biens].sort((a, b) =>
    a.nom.localeCompare(b.nom, 'fr', { numeric: true }),
  );

  const aller = (suivante: Vue, bien: string | undefined): void => {
    void naviguer(
      lienArgent({
        ...(suivante.type === 'mois' ? { periode: suivante.periode } : { annee: suivante.annee }),
        bienId: bien,
      }),
      { replace: true },
    );
  };
  const changerType = (type: TypeVue): void => {
    aller(
      type === 'mois'
        ? { type, periode: periodeDe(aujourdhui) }
        : { type, annee: Number(aujourdhui.slice(0, 4)) },
      bienId,
    );
  };

  return (
    <Page espacement="large" className="max-w-[1000px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-bold tracking-wider text-encre-3 uppercase">{T.titre}</span>
          <TitrePage taille="accroche">{phraseArgent(vue, bilan.cashflow)}</TitrePage>
        </div>
        <LienBouton variante="primaire" to={lienNouvelleDepense({ bienId, retour: ici })}>
          {T.ajouterDepense}
        </LienBouton>
      </div>

      <div className="grid items-end gap-4 sm:grid-cols-[auto_1fr_1fr]">
        <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
          <legend className="mb-1.5 text-sm font-semibold text-encre-2">{T.vue}</legend>
          <div className="inline-flex self-start rounded-full bg-bordure-douce p-1">
            {(['mois', 'annee'] as const).map((type) => (
              <label
                key={type}
                className={`flex min-h-11 cursor-pointer items-center rounded-full px-4 text-sm font-bold whitespace-nowrap has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent ${
                  vue.type === type
                    ? 'bg-surface text-encre shadow-carte'
                    : 'text-encre-3 survol-discret'
                }`}
              >
                <input
                  type="radio"
                  name="argent-vue"
                  value={type}
                  checked={vue.type === type}
                  onChange={() => {
                    changerType(type);
                  }}
                  className="sr-only"
                />
                {type === 'mois' ? T.unMois : T.uneAnnee}
              </label>
            ))}
          </div>
        </fieldset>
        <ListeChoix
          libelle={vue.type === 'mois' ? T.mois : T.annee}
          valeur={vue.type === 'mois' ? vue.periode : String(vue.annee)}
          options={periodesDuChoix(vue, aujourdhui).map((p) => ({
            valeur: p,
            libelle: vue.type === 'mois' ? avecMajuscule(moisEnLettres(p)) : p,
          }))}
          onChoix={(p) => {
            aller(
              vue.type === 'mois'
                ? { type: 'mois', periode: p }
                : { type: 'annee', annee: Number(p) },
              bienId,
            );
          }}
        />
        <ListeChoix
          libelle={T.bien}
          valeur={bienId ?? TOUS_LES_BIENS}
          options={[
            { valeur: TOUS_LES_BIENS, libelle: T.tousLesBiens },
            ...biens.map((b) => ({ valeur: b.id, libelle: b.nom })),
          ]}
          onChoix={(id) => {
            aller(vue, id === TOUS_LES_BIENS ? undefined : id);
          }}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Carte>
          <TitreCarte>{avecMajuscule(nomDeLaVue(vue))}</TitreCarte>
          <LignesDeFlux flux={bilan} cashflow={bilan.cashflow} />
          {categoriesDuBilan(bilan).length > 0 && (
            <div>
              {categoriesDuBilan(bilan).map((c) => (
                <Ligne
                  key={c.categorie}
                  libelle={<span className="text-encre-3">{CATEGORIES_TEXTE[c.categorie]}</span>}
                  valeur={<span className="text-encre-3">{montant(c.montant)}</span>}
                />
              ))}
            </div>
          )}
          <p className="m-0 text-sm text-encre-3">{T.explication}</p>
        </Carte>
        <Carte>
          <TitreCarte>{T.courbe}</TitreCarte>
          <Courbe points={courbeDeLaVue(tout, vue, bienId)} />
        </Carte>
      </div>

      {bienId === undefined && bilan.parBien.length > 0 && (
        <ParBien bilan={bilan} gestion={gestion} />
      )}
      <DepensesDeLaPeriode bilan={bilan} gestion={gestion} ici={ici} />
    </Page>
  );
}

/** /gerer/argent : ce que les biens rapportent vraiment, pour un mois ou une année, par bien. */
export function Argent(): JSX.Element {
  const { statut, donnees } = useGestion();
  const argent = useArgent();
  if (statut !== 'pret' || donnees === null) return <EcranAttente />;
  if (argent.donnees === null) return <AttenteArgent titre={T.titre} />;
  return <PageArgent gestion={donnees} argent={argent.donnees} />;
}
