import type { ContenuDecompte, ContenuRegularisation, ContenuRestitution } from '@loupe/gestion';
import type { JSX, ReactNode } from 'react';

import { dateEnLettres, montant } from '@/gestion/format';
import { CATEGORIES_TEXTE } from '@/textes/gerer-argent';
import { faitLe, locatairesTitre, logementEnLettres } from '@/textes/gerer-documents';
import {
  periodeEnLettres,
  quotePartEnLettres,
  TEXTES_DECOMPTE as D,
  titreDecompte,
} from '@/textes/gerer-fin-bail';

function Bloc({ titre, children }: { titre: string; children: ReactNode }): JSX.Element {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="m-0 text-xs font-bold tracking-wider text-encre-3 uppercase">{titre}</h2>
      {children}
    </section>
  );
}

function LigneTableau({
  libelle,
  valeur,
  fort = false,
}: {
  libelle: string;
  valeur: string;
  fort?: boolean;
}): JSX.Element {
  return (
    <tr className={fort ? 'font-bold' : ''}>
      <th scope="row" className="border-t border-bordure-douce py-2 text-left font-[inherit]">
        {libelle}
      </th>
      <td className="border-t border-bordure-douce py-2 text-right tabular-nums">{valeur}</td>
    </tr>
  );
}

function Restitution({ contenu: c }: { readonly contenu: ContenuRestitution }): JSX.Element {
  return (
    <>
      <table className="w-full border-collapse text-[15px]">
        <tbody>
          <LigneTableau libelle={D.entree} valeur={dateEnLettres(c.entree)} />
          <LigneTableau libelle={D.sortie} valeur={dateEnLettres(c.sortie)} />
          <LigneTableau libelle={D.clesLe} valeur={dateEnLettres(c.clesLe)} />
          <LigneTableau libelle={D.etatDesLieux} valeur={c.conforme ? D.conforme : D.nonConforme} />
          <LigneTableau libelle={D.depot} valeur={montant(c.depot)} />
          {c.retenues.map((retenue) => (
            <LigneTableau
              key={`${retenue.motif}-${String(retenue.montant)}`}
              libelle={retenue.motif}
              valeur={`− ${montant(retenue.montant)}`}
            />
          ))}
          {c.retenues.length > 0 && (
            <LigneTableau libelle={D.totalRetenues} valeur={montant(c.totalRetenues)} />
          )}
          <LigneTableau libelle={D.aRendre} valeur={montant(c.aRendre)} fort />
          <LigneTableau libelle={D.dateLimite} valeur={dateEnLettres(c.dateLimite)} />
        </tbody>
      </table>
      <p className="m-0 text-[15px] leading-relaxed">{D.sourceDepot}</p>
    </>
  );
}

function Regularisation({ contenu: c }: { readonly contenu: ContenuRegularisation }): JSX.Element {
  return (
    <>
      <table className="w-full border-collapse text-[15px]">
        <tbody>
          <LigneTableau libelle={D.periode} valeur={periodeEnLettres(c.debut, c.fin)} />
          <LigneTableau libelle={D.quotePart} valeur={quotePartEnLettres(c)} />
          {c.charges.map((charge) => (
            <LigneTableau
              key={charge.categorie}
              libelle={CATEGORIES_TEXTE[charge.categorie]}
              valeur={montant(charge.montant)}
            />
          ))}
          <LigneTableau libelle={D.charges} valeur={montant(c.totalCharges)} fort />
          <LigneTableau libelle={D.provisions} valeur={montant(c.provisions)} />
          <LigneTableau
            libelle={c.solde < 0 ? D.aRembourser : D.aDemander}
            valeur={montant(Math.abs(c.solde))}
            fort
          />
        </tbody>
      </table>
      <p className="m-0 text-[15px] leading-relaxed">{D.sourceCharges}</p>
    </>
  );
}

/** La page A4 d'un décompte (dépôt de garantie ou charges), écrite depuis son contenu figé. */
export function DocumentDecompte({ contenu }: { readonly contenu: ContenuDecompte }): JSX.Element {
  return (
    <article className="document flex flex-col gap-6 p-6 text-encre sm:p-10">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="m-0 font-display text-[28px] font-semibold">
          {titreDecompte(contenu.type)}
        </h1>
        <p className="m-0 text-sm text-encre-3 tabular-nums">{`${D.numero} ${contenu.numero}`}</p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2 print:grid-cols-2">
        <Bloc titre={D.bailleur}>
          <p className="m-0 font-semibold">{contenu.bailleur.nom}</p>
          <p className="m-0 text-encre-2">{contenu.bailleur.adresse}</p>
        </Bloc>
        <Bloc titre={locatairesTitre(contenu.locataires.length)}>
          {contenu.locataires.map((l) => (
            <p key={`${l.prenom} ${l.nom}`} className="m-0 font-semibold">
              {`${l.prenom} ${l.nom}`}
            </p>
          ))}
        </Bloc>
        <Bloc titre={D.logement}>
          <p className="m-0 text-encre-2">{logementEnLettres(contenu.logement)}</p>
        </Bloc>
      </div>

      {contenu.type === 'restitution' ? (
        <Restitution contenu={contenu} />
      ) : (
        <Regularisation contenu={contenu} />
      )}

      <footer className="flex flex-col gap-1 text-sm text-encre-3">
        <p className="m-0">{faitLe(contenu.emisLe)}</p>
      </footer>
    </article>
  );
}
