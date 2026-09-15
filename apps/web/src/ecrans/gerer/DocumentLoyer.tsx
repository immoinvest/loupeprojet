import type { ContenuDocument } from '@loupe/gestion';
import type { JSX, ReactNode } from 'react';

import { montant } from '@/gestion/format';
import {
  declaration,
  faitLe,
  locatairesTitre,
  logementEnLettres,
  MENTIONS_DOCUMENT_TEXTES,
  numeroEnLettres,
  paiementEnLettres,
  periodeEnLettres,
  TEXTES_DOCUMENT as D,
  TITRES_DOCUMENT,
} from '@/textes/gerer-documents';

function Bloc({ titre, children }: { titre: string; children: ReactNode }): JSX.Element {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="m-0 text-xs font-bold tracking-wider text-encre-3 uppercase">{titre}</h2>
      {children}
    </section>
  );
}

function LigneMontant({
  libelle,
  centimes,
  fort = false,
}: {
  libelle: string;
  centimes: number;
  fort?: boolean;
}): JSX.Element {
  return (
    <tr className={fort ? 'font-bold' : ''}>
      <th scope="row" className="border-t border-bordure-douce py-2 text-left font-[inherit]">
        {libelle}
      </th>
      <td className="border-t border-bordure-douce py-2 text-right tabular-nums">
        {montant(centimes)}
      </td>
    </tr>
  );
}

/** La page A4 d'une quittance ou d'un reçu, écrite depuis son contenu figé. */
export function DocumentLoyer({ contenu }: { readonly contenu: ContenuDocument }): JSX.Element {
  const quittance = contenu.type === 'quittance';
  return (
    <article className="document flex flex-col gap-6 p-6 text-encre sm:p-10">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="m-0 font-display text-[28px] font-semibold">
          {TITRES_DOCUMENT[contenu.type]}
        </h1>
        <p className="m-0 text-sm text-encre-3 tabular-nums">{numeroEnLettres(contenu.numero)}</p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
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
        <Bloc titre={D.periode}>
          <p className="m-0 text-encre-2">{periodeEnLettres(contenu.debut, contenu.fin)}</p>
        </Bloc>
      </div>

      <table className="w-full border-collapse text-[15px]">
        <tbody>
          <LigneMontant libelle={D.loyer} centimes={contenu.loyerHorsCharges} />
          <LigneMontant libelle={D.charges} centimes={contenu.charges} />
          <LigneMontant libelle={D.total} centimes={contenu.total} fort />
          {contenu.apl !== undefined && (
            <>
              <LigneMontant libelle={D.apl} centimes={contenu.apl} />
              <LigneMontant libelle={D.partLocataire} centimes={contenu.total - contenu.apl} />
            </>
          )}
          {!quittance && <LigneMontant libelle={D.dejaRecu} centimes={contenu.dejaRecu} />}
          {!quittance && <LigneMontant libelle={D.resteDu} centimes={contenu.resteDu} fort />}
        </tbody>
      </table>

      <Bloc titre={quittance ? D.paiements : D.paiementAtteste}>
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
          {contenu.paiements.map((p, i) => (
            <li key={`${p.date}-${String(i)}`} className="tabular-nums">
              {paiementEnLettres(p)}
            </li>
          ))}
        </ul>
      </Bloc>

      <p className="m-0 text-[15px] leading-relaxed">{declaration(contenu)}</p>
      {contenu.mentions.map((m) => (
        <p key={m} className="m-0 text-[15px] font-semibold">
          {MENTIONS_DOCUMENT_TEXTES[m]}
        </p>
      ))}

      <footer className="flex flex-col gap-1 text-sm text-encre-3">
        <p className="m-0">{faitLe(contenu.emisLe)}</p>
        <p className="m-0">{D.gratuit}</p>
      </footer>
    </article>
  );
}
