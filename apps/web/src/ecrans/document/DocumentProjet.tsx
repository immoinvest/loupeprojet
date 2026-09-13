import type { JSX } from 'react';

import { ModeDocument } from '@/composants/document';
import { useProjetCourant } from '@/coque/ProjetLayout';
import { dateCourte, euros, nombre } from '@/formatage/nombres';
import { Fiscalite } from '@/ecrans/Fiscalite';
import { Rapport } from '@/ecrans/Rapport';
import { Revente } from '@/ecrans/Revente';
import { Visite } from '@/ecrans/Visite';
import { LogotypeDeklic } from '@/marque/Logo';
import { MODES } from '@/textes/regimes';

const VOLETS: readonly { readonly titre: string; readonly Volet: () => JSX.Element }[] = [
  { titre: 'Rapport', Volet: Rapport },
  { titre: 'Fiscalité', Volet: Fiscalite },
  { titre: 'Revente', Volet: Revente },
  { titre: 'Visite', Volet: Visite },
];

/**
 * Le projet complet en un seul document : en-tête, les quatre volets (un par page à
 * l'impression), pied de page. Rendu en mode document : lecture seule, explications visibles.
 */
export function DocumentProjet({
  date,
  libelleDate = 'Imprimé le',
}: {
  date?: string;
  libelleDate?: string;
}): JSX.Element {
  const { enregistre, resultats: r } = useProjetCourant();
  const { bien, hypotheses, source } = enregistre.projet;
  const jour = dateCourte(date ?? new Date().toISOString());

  return (
    <ModeDocument>
      <div className="document">
        <header className="flex items-end justify-between gap-6 border-b border-bordure px-10 pt-8 pb-5">
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-2 font-display text-sm font-bold text-encre-3">
              <LogotypeDeklic hauteur={20} />· dossier d'analyse locative
            </span>
            <h1 className="m-0 font-display text-[28px] leading-tight font-bold">
              {enregistre.nom}
            </h1>
            <span className="text-[15px] text-encre-2">
              {euros(hypotheses.achat.prix)} · {MODES[hypotheses.location.mode]} ·{' '}
              {nombre(bien.surface)} m² · département {bien.departement}
            </span>
          </div>
          <dl className="m-0 flex flex-col gap-0.5 text-right text-[13px] text-encre-3">
            <div>
              <dt className="inline">{libelleDate} </dt>
              <dd className="inline font-semibold text-encre-2">{jour}</dd>
            </div>
            <div>
              <dt className="inline">Règles fiscales </dt>
              <dd className="inline font-semibold text-encre-2">
                {r.meta.versionRegles} ({dateCourte(r.meta.dateReference)})
              </dd>
            </div>
          </dl>
        </header>

        {VOLETS.map(({ titre, Volet }, index) => (
          <article key={titre} className={index === 0 ? '' : 'document-volet'}>
            <div className="px-10 pt-6 text-xs font-bold tracking-wider text-encre-4 uppercase">
              {index + 1} · {titre} · {enregistre.nom}
            </div>
            <Volet />
          </article>
        ))}

        <footer className="flex flex-col gap-1 border-t border-bordure px-10 py-5 text-xs text-encre-3">
          <span>
            Deklic est un outil d'aide à la décision, pas un conseil en investissement ni un conseil
            fiscal. Règles connues au {dateCourte(r.meta.dateReference)} (version{' '}
            {r.meta.versionRegles}). Tout est calculé dans le navigateur ; rien n'est envoyé à un
            serveur.
          </span>
          {source !== undefined && (
            <span>
              Annonce d'origine : {source.portail} n° {source.id} · {source.url}
            </span>
          )}
        </footer>
      </div>
    </ModeDocument>
  );
}
