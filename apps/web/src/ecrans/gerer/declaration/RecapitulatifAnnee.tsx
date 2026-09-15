import {
  argentDeLAnnee,
  declarationDeLAnnee,
  jourLocal,
  lignesDeLAnnee,
  type EtatArgent,
  type EtatGestion,
} from '@loupe/gestion';
import type { JSX } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Bouton } from '@/composants/ui';
import { useArgent } from '@/gestion/argent/ArgentContext';
import { donneesArgent } from '@/gestion/argent/page';
import { champsDeLigne } from '@/gestion/declaration/csv';
import { anneeDepuisRecherche } from '@/gestion/declaration/page';
import { dateEnLettres, montant } from '@/gestion/format';
import { useGestion } from '@/gestion/GestionContext';
import { lienDeclaration } from '@/gestion/parcours';
import { montantSigne, TEXTES_ARGENT as A } from '@/textes/gerer-argent';
import { TEXTES_DECLARATION as T, titreDeclaration } from '@/textes/gerer-declaration';

import { AttenteArgent } from '../argent/AttenteArgent';
import { EcranAttente } from '../EcranAttente';
import { BlocFoncier, BlocMeuble } from './BlocsDeclaration';

const CELLULE = 'border-t border-bordure-douce px-2 py-1';

function Document({
  gestion,
  argent,
  annee,
}: {
  readonly gestion: EtatGestion;
  readonly argent: EtatArgent;
  readonly annee: number;
}): JSX.Element {
  const tout = donneesArgent(gestion, argent);
  const bilan = argentDeLAnnee(tout, annee);
  const declaration = declarationDeLAnnee(tout, annee);
  const lignes = lignesDeLAnnee(tout, annee);

  return (
    <div className="flex flex-col gap-6 p-6 sm:p-10">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 font-display text-[28px] font-semibold">
          {T.recapTitre} {annee}
        </h1>
        <p className="m-0 text-sm text-encre-3">{titreDeclaration(annee)}</p>
      </div>

      <section aria-labelledby="recap-par-bien" className="flex flex-col gap-2">
        <h2 id="recap-par-bien" className="m-0 text-lg font-bold">
          {T.recapParBien}
        </h2>
        <div className="relative overflow-x-auto print:overflow-visible">
          <table className="w-full min-w-[520px] border-collapse text-sm tabular-nums">
            <thead>
              <tr className="text-left text-xs text-encre-3">
                <th scope="col" className="px-2 py-1">
                  {A.bien}
                </th>
                <th scope="col" className="px-2 py-1 text-right">
                  {A.loyers}
                </th>
                <th scope="col" className="px-2 py-1 text-right">
                  {A.depenses}
                </th>
                <th scope="col" className="px-2 py-1 text-right">
                  {A.mensualites}
                </th>
                <th scope="col" className="px-2 py-1 text-right">
                  {A.cashflow}
                </th>
              </tr>
            </thead>
            <tbody>
              {bilan.parBien.map((ligne) => (
                <tr key={ligne.bienId}>
                  <th scope="row" className={`${CELLULE} text-left`}>
                    {gestion.biens.find((b) => b.id === ligne.bienId)?.nom}
                  </th>
                  <td className={`${CELLULE} text-right`}>{montant(ligne.loyers)}</td>
                  <td className={`${CELLULE} text-right`}>{montant(ligne.depenses)}</td>
                  <td className={`${CELLULE} text-right`}>{montant(ligne.mensualites)}</td>
                  <td className={`${CELLULE} text-right`}>{montantSigne(ligne.cashflow)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <th scope="row" className={`${CELLULE} text-left`}>
                  {A.tousLesBiens}
                </th>
                <td className={`${CELLULE} text-right`}>{montant(bilan.loyers)}</td>
                <td className={`${CELLULE} text-right`}>{montant(bilan.depenses)}</td>
                <td className={`${CELLULE} text-right`}>{montant(bilan.mensualites)}</td>
                <td className={`${CELLULE} text-right`}>{montantSigne(bilan.cashflow)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {declaration.foncier !== null && (
        <BlocFoncier groupe={declaration.foncier} verifiee={declaration.casesVerifiees} />
      )}
      {declaration.meuble !== null && (
        <BlocMeuble groupe={declaration.meuble} verifiee={declaration.casesVerifiees} />
      )}

      <section aria-labelledby="recap-mouvements" className="flex flex-col gap-2">
        <h2 id="recap-mouvements" className="m-0 text-lg font-bold">
          {T.recapMouvements}
        </h2>
        {lignes.length === 0 ? (
          <p className="m-0 text-encre-2">{T.aucunMouvement}</p>
        ) : (
          <div className="relative overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[620px] border-collapse text-sm tabular-nums">
              <tbody>
                {lignes.map((ligne, rang) => {
                  const [bien, categorie, libelle] = champsDeLigne(ligne, gestion);
                  return (
                    <tr key={`${ligne.date}-${String(rang)}`}>
                      <td className={CELLULE}>{dateEnLettres(ligne.date)}</td>
                      <td className={CELLULE}>{bien}</td>
                      <td className={CELLULE}>{categorie}</td>
                      <td className={CELLULE}>{libelle}</td>
                      <td className={`${CELLULE} text-right`}>{montantSigne(ligne.montant)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/** `/gerer/declaration/imprimer?annee=` : le récapitulatif de l'année, hors coque, à imprimer. */
export function RecapitulatifAnnee(): JSX.Element {
  const { statut, donnees } = useGestion();
  const argent = useArgent();
  const [recherche] = useSearchParams();
  if (statut !== 'pret' || donnees === null) return <EcranAttente />;
  if (argent.donnees === null) return <AttenteArgent titre={T.recapTitre} />;
  const annee = anneeDepuisRecherche(recherche, jourLocal(new Date()));

  return (
    <div className="min-h-dvh bg-fond pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <div className="no-print z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-bordure bg-surface px-4 py-3 sm:sticky sm:top-0 sm:flex-nowrap sm:px-6">
        <Link
          to={lienDeclaration({ annee })}
          className="inline-flex min-h-11 items-center text-sm font-semibold no-underline survol-texte"
        >
          ← {T.retour}
        </Link>
        <span className="order-last basis-full text-sm text-encre-3 sm:order-none sm:flex-1 sm:basis-auto">
          {T.apercu}
        </span>
        <Bouton
          variante="primaire"
          onClick={() => {
            window.print();
          }}
        >
          {T.imprimer}
        </Bouton>
      </div>
      <div className="document-page mx-2 my-4 max-w-[210mm] rounded-carte border border-bordure bg-surface shadow-carte sm:mx-auto sm:my-6">
        <Document gestion={donnees} argent={argent.donnees} annee={annee} />
      </div>
    </div>
  );
}
