import type {
  Declaration,
  GroupeDeclaration,
  LigneCharges2044,
  RegimeFoncier,
  RegimeMeuble,
} from '@loupe/gestion';
import type { Regime } from '@loupe/moteur';
import type { JSX, ReactNode } from 'react';
import { Link } from 'react-router';

import { Carte, Ligne, TitreCarte } from '@/composants/ui';
import { dateEnLettres, montant } from '@/gestion/format';
import { lienFicheBien } from '@/gestion/parcours';
import { CATEGORIES_TEXTE, montantSigne } from '@/textes/gerer-argent';
import {
  caseFoncier,
  caseMicroBic,
  LIBELLES_LIGNES,
  ligne2044,
  NOMS_REGIMES_DECLARATION,
  plafondDeficit,
  plafondDuRegime,
  RAISONS_NON_REPORTEES,
  tauxEntier,
  TEXTES_DECLARATION as T,
} from '@/textes/gerer-declaration';

const ORDRE_CHARGES: readonly LigneCharges2044[] = [
  'fraisGestion',
  'forfaitGestion',
  'assurance',
  'travaux',
  'taxeFonciere',
  'copropriete',
];

/** « T2 Lices · Studio Baille », chaque nom menant à la fiche du bien. */
function BiensDuGroupe({
  groupe,
}: {
  readonly groupe: GroupeDeclaration<{ readonly regime: Regime }>;
}): JSX.Element {
  return (
    <p className="m-0 flex flex-wrap gap-x-3 text-sm">
      {groupe.biens.map((bien) => (
        <Link
          key={bien.id}
          to={lienFicheBien(bien.id)}
          className="inline-flex items-center text-encre-2 survol-texte pointer-coarse:min-h-11"
        >
          {bien.nom}
        </Link>
      ))}
    </p>
  );
}

/** Un régime : son nom, la pastille « choisi dans ton analyse », ses lignes. */
function BlocRegime({
  regime,
  retenu,
  children,
}: {
  readonly regime: Regime;
  readonly retenu: boolean;
  readonly children: ReactNode;
}): JSX.Element {
  const id = `regime-${regime}`;
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-2 border-t border-bordure-douce pt-3 first-of-type:border-t-0 first-of-type:pt-0"
    >
      <h3 id={id} className="m-0 flex flex-wrap items-center gap-2 text-base font-bold">
        {NOMS_REGIMES_DECLARATION[regime]}
        {retenu && (
          <span className="rounded-full bg-accent-doux px-2 py-0.5 text-xs font-bold text-accent-fonce">
            {T.retenu}
          </span>
        )}
      </h3>
      {children}
    </section>
  );
}

function Micro({
  libelleRecettes,
  caseRecettes,
  recettes,
  abattementTaux,
  abattement,
  imposable,
  plafond,
  depassePlafond,
}: {
  readonly libelleRecettes: string;
  readonly caseRecettes: string;
  readonly recettes: number;
  readonly abattementTaux: number;
  readonly abattement: number;
  readonly imposable: number;
  readonly plafond: number;
  readonly depassePlafond: boolean;
}): JSX.Element {
  return (
    <>
      <div>
        <Ligne fort libelle={`${libelleRecettes} · ${caseRecettes}`} valeur={montant(recettes)} />
        <Ligne
          libelle={`${T.abattement} (${tauxEntier(abattementTaux)})`}
          valeur={montant(abattement)}
        />
        <Ligne libelle={T.imposable} valeur={montant(imposable)} />
      </div>
      <p className="m-0 text-sm text-encre-3">
        {plafondDuRegime(plafond)}. {T.plafondFoyer}
      </p>
      {depassePlafond && (
        <p role="alert" className="m-0 text-sm font-semibold text-probleme-texte">
          {T.plafondDepasse}
        </p>
      )}
    </>
  );
}

export function BlocFoncier({
  groupe,
  verifiee,
}: {
  readonly groupe: GroupeDeclaration<RegimeFoncier>;
  readonly verifiee: boolean;
}): JSX.Element {
  return (
    <Carte>
      <TitreCarte>{T.foncierTitre}</TitreCarte>
      <BiensDuGroupe groupe={groupe} />
      {groupe.regimes.map((r) => (
        <BlocRegime key={r.regime} regime={r.regime} retenu={r.regime === groupe.retenu}>
          {r.regime === 'micro_foncier' ? (
            <Micro
              libelleRecettes={T.recettes}
              caseRecettes={caseFoncier('microFoncier', verifiee)}
              {...r}
            />
          ) : (
            <>
              <div>
                <Ligne
                  libelle={`${T.recettes} · ${ligne2044('loyers', verifiee)}`}
                  valeur={montant(r.loyers)}
                />
                {ORDRE_CHARGES.map((cle) => (
                  <Ligne
                    key={cle}
                    libelle={`${LIBELLES_LIGNES[cle]} · ${ligne2044(cle, verifiee)}`}
                    valeur={montant(r.charges[cle])}
                  />
                ))}
                <Ligne libelle={T.totalCharges} valeur={montant(r.totalCharges)} />
                <Ligne
                  libelle={`${T.interets} · ${ligne2044('interets', verifiee)}`}
                  valeur={montant(r.interets)}
                />
                <Ligne fort libelle={T.resultat} valeur={montantSigne(r.resultat)} />
              </div>
              <div>
                <p className="m-0 text-xs font-bold tracking-wider text-encre-3 uppercase">
                  {T.aReporter}
                </p>
                {r.benefice > 0 || r.resultat === 0 ? (
                  <Ligne
                    fort
                    libelle={caseFoncier('benefice', verifiee)}
                    valeur={montant(r.benefice)}
                  />
                ) : (
                  <>
                    <Ligne
                      fort
                      libelle={caseFoncier('deficitRevenuGlobal', verifiee)}
                      valeur={montant(r.deficitRevenuGlobal)}
                    />
                    <Ligne
                      fort
                      libelle={caseFoncier('deficitRevenusFonciers', verifiee)}
                      valeur={montant(r.deficitRevenusFonciers)}
                    />
                  </>
                )}
              </div>
              <p className="m-0 text-sm text-encre-3">
                {T.deficitExplication} {plafondDeficit(r.plafondRevenuGlobal)}
              </p>
            </>
          )}
        </BlocRegime>
      ))}
    </Carte>
  );
}

export function BlocMeuble({
  groupe,
  verifiee,
}: {
  readonly groupe: GroupeDeclaration<RegimeMeuble>;
  readonly verifiee: boolean;
}): JSX.Element {
  return (
    <Carte>
      <TitreCarte>{T.meubleTitre}</TitreCarte>
      <BiensDuGroupe groupe={groupe} />
      {groupe.regimes.map((r) => (
        <BlocRegime key={r.regime} regime={r.regime} retenu={r.regime === groupe.retenu}>
          {r.regime === 'micro_bic' ? (
            <Micro
              libelleRecettes={T.recettesMeuble}
              caseRecettes={caseMicroBic(verifiee)}
              {...r}
            />
          ) : (
            <>
              <p className="m-0 text-sm text-encre-2">{T.lmnpReel}</p>
              <div>
                <Ligne fort libelle={T.recettesMeuble} valeur={montant(r.recettes)} />
              </div>
            </>
          )}
        </BlocRegime>
      ))}
    </Carte>
  );
}

export function NonReportees({ declaration }: { readonly declaration: Declaration }): JSX.Element {
  return (
    <Carte>
      <TitreCarte>{T.nonReporteesTitre}</TitreCarte>
      <p className="m-0 text-sm text-encre-2">{T.nonReporteesTexte}</p>
      <ul aria-label={T.nonReporteesTitre} className="m-0 flex list-none flex-col p-0">
        {declaration.nonReportees.map(({ depense, date, raison }) => (
          <li
            key={`${depense.id}-${date}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-bordure-douce py-2 first:border-t-0"
          >
            <div className="flex min-w-0 flex-1 basis-56 flex-col">
              <b>{depense.libelle ?? CATEGORIES_TEXTE[depense.categorie]}</b>
              <small className="text-sm text-encre-3">
                {dateEnLettres(date)} · {RAISONS_NON_REPORTEES[raison]}
              </small>
            </div>
            <b className="tabular-nums">{montant(depense.montant)}</b>
          </li>
        ))}
      </ul>
    </Carte>
  );
}
