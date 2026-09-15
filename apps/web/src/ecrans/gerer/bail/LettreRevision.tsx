import type { ContenuLettreRevision } from '@loupe/gestion';
import type { JSX, ReactNode } from 'react';

import { montant } from '@/gestion/format';
import {
  indiceEnLettres,
  lettreCalcul,
  lettreEffet,
  lettreFaitLe,
  lettreIndice,
  lettreIntroduction,
  lettreSource,
  numeroLettreEnLettres,
  TEXTES_LETTRE as L,
  variationEnLettres,
} from '@/textes/gerer-bail';
import { TEXTES_DOCUMENT } from '@/textes/gerer-documents';
import { locatairesTitre, logementEnLettres } from '@/textes/gerer-documents';

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

/** La page A4 de la lettre de révision, écrite depuis son contenu figé. */
export function LettreRevision({
  contenu: c,
}: {
  readonly contenu: ContenuLettreRevision;
}): JSX.Element {
  return (
    <article className="document flex flex-col gap-6 p-6 text-encre sm:p-10">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="m-0 font-display text-[28px] font-semibold">{L.titre}</h1>
        <p className="m-0 text-sm text-encre-3 tabular-nums">{numeroLettreEnLettres(c.numero)}</p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2 print:grid-cols-2">
        <Bloc titre={L.bailleur}>
          <p className="m-0 font-semibold">{c.bailleur.nom}</p>
          <p className="m-0 text-encre-2">{c.bailleur.adresse}</p>
        </Bloc>
        <Bloc titre={locatairesTitre(c.locataires.length)}>
          {c.locataires.map((l) => (
            <p key={`${l.prenom} ${l.nom}`} className="m-0 font-semibold">
              {`${l.prenom} ${l.nom}`}
            </p>
          ))}
        </Bloc>
        <Bloc titre={L.logement}>
          <p className="m-0 text-encre-2">{logementEnLettres(c.logement)}</p>
        </Bloc>
      </div>

      <p className="m-0 text-[15px]">{L.salutation}</p>
      <p className="m-0 text-[15px] leading-relaxed">{lettreIntroduction(c)}</p>

      <table className="w-full border-collapse text-[15px]">
        <tbody>
          <LigneTableau libelle={L.loyerActuel} valeur={montant(c.loyerActuel)} />
          <LigneTableau
            libelle={lettreIndice(c.indiceAncien.trimestre, true)}
            valeur={indiceEnLettres(c.indiceAncien.valeur)}
          />
          <LigneTableau
            libelle={lettreIndice(c.indiceNouveau.trimestre, false)}
            valeur={indiceEnLettres(c.indiceNouveau.valeur)}
          />
          <LigneTableau libelle={L.variation} valeur={variationEnLettres(c.variationPourcent)} />
          <LigneTableau libelle={L.nouveauLoyer} valeur={montant(c.nouveauLoyer)} fort />
          <LigneTableau libelle={L.charges} valeur={montant(c.charges)} />
          <LigneTableau
            libelle={L.nouveauTotal}
            valeur={montant(c.nouveauLoyer + c.charges)}
            fort
          />
        </tbody>
      </table>

      <p className="m-0 text-[15px] tabular-nums">{lettreCalcul(c)}</p>
      <p className="m-0 text-[15px] leading-relaxed">{lettreEffet(c)}</p>
      <p className="m-0 text-[15px]">{L.formule}</p>

      <footer className="flex flex-col gap-1 text-sm text-encre-3">
        <p className="m-0">{lettreFaitLe(c.emisLe)}</p>
        <p className="m-0 break-words">{lettreSource(c)}</p>
        <p className="m-0">
          {TEXTES_DOCUMENT.gratuit
            .replace('article 21', 'article 17-1')
            .replace('Document délivré gratuitement', 'Lettre établie')}
        </p>
      </footer>
    </article>
  );
}
