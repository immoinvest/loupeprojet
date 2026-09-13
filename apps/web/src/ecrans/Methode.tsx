import { VERSION_REGLES_COURANTE, obtenirRegles } from '@loupe/moteur';
import { useMemo, type JSX } from 'react';
import { Link } from 'react-router';

import { defautsDuMoteur } from '@/analyses';
import { Chapo, Page, TitrePage } from '@/composants/mise-en-page';
import { Carte, Pastille } from '@/composants/ui';
import { dateCourte } from '@/formatage/nombres';
import { sectionsMethode, type SectionMethode } from '@/textes/methode';

function Section({ s }: { s: SectionMethode }): JSX.Element {
  return (
    <Carte id={s.code}>
      <h2 className="m-0 font-display text-[22px] font-semibold">{s.titre}</h2>
      <p className="m-0 text-[15px] leading-relaxed text-encre-2">{s.resume}</p>
      {s.etapes.length > 0 && (
        <ol className="m-0 flex flex-col gap-1.5 pl-5 text-[15px] leading-relaxed">
          {s.etapes.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ol>
      )}
      {s.constantes.length > 0 && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-encre-3">
              <th className="py-1.5 pr-3 font-semibold">Constante</th>
              <th className="py-1.5 pr-3 font-semibold">Valeur</th>
              <th className="py-1.5 font-semibold">Source</th>
            </tr>
          </thead>
          <tbody>
            {s.constantes.map((c) => (
              <tr key={c.libelle} className="border-t border-bordure-douce align-top">
                <td className="py-2 pr-3">{c.libelle}</td>
                <td className="py-2 pr-3 font-semibold">
                  {c.valeur}
                  {c.aConfirmer === true && (
                    <>
                      {' '}
                      <Pastille ton="surveiller" compacte>
                        à confirmer
                      </Pastille>
                    </>
                  )}
                </td>
                <td className="py-2 text-encre-3">{c.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Carte>
  );
}

export function Methode(): JSX.Element {
  const regles = obtenirRegles(VERSION_REGLES_COURANTE);
  const sections = useMemo(() => sectionsMethode(regles, defautsDuMoteur()), [regles]);
  const aConfirmer = sections.flatMap((s) =>
    s.constantes.filter((c) => c.aConfirmer === true).map((c) => `${s.titre} : ${c.libelle}`),
  );

  return (
    <Page>
      <div className="flex flex-col gap-2">
        <TitrePage>Comment c'est calculé</TitrePage>
        <Chapo>
          Règles du {dateCourte(regles.dateReference)} (version {regles.version}). Tout se calcule
          dans votre navigateur, à partir des textes officiels et de barèmes écrits une fois ; l'IA
          ne calcule jamais. Chaque valeur se change dans l'onglet Hypothèses d'un projet.
        </Chapo>
      </div>

      <nav aria-label="Sommaire" className="flex flex-wrap gap-2">
        {sections.map((s) => (
          <a
            key={s.code}
            href={`#${s.code}`}
            className="min-h-[36px] rounded-full border border-bordure bg-surface px-3 py-1.5 text-sm font-semibold text-encre-2 no-underline hover:bg-accent-fond"
          >
            {s.titre}
          </a>
        ))}
      </nav>

      {aConfirmer.length > 0 && (
        <Carte className="border-surveiller/40 bg-surveiller-fond">
          <p className="m-0 text-[15px] text-encre-2">
            <strong>{aConfirmer.length} valeurs attendent une source officielle consolidée</strong>{' '}
            ({aConfirmer.join(' ; ')}). Elles sont marquées « à confirmer » et restent modifiables.
          </p>
        </Carte>
      )}

      {sections.map((s) => (
        <Section key={s.code} s={s} />
      ))}

      <Carte>
        <h2 className="m-0 font-display text-[22px] font-semibold">Ce que le moteur simplifie</h2>
        <ul className="m-0 flex flex-col gap-1.5 pl-5 text-[15px] leading-relaxed">
          {regles.simplifications.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </Carte>

      <p className="m-0 text-xs text-encre-3">
        Outil d'aide à la décision, pas un conseil en investissement ni un conseil fiscal.{' '}
        <Link to="/projets">Retour à mes projets</Link>.
      </p>
    </Page>
  );
}
