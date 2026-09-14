import { questionsPourProjet } from '@loupe/moteur';
import { useMemo, type JSX } from 'react';
import { Link, useNavigate } from 'react-router';

import { useModeDocument } from '@/composants/document';
import { Chapo, Page, TitrePage } from '@/composants/mise-en-page';
import { Bouton, Carte, Pastille } from '@/composants/ui';
import { useProjetCourant } from '@/coque/ProjetLayout';
import { dateCourte } from '@/formatage/nombres';
import { useProjets } from '@/stockage/ProjetsContext';
import type { Visite as VisiteEnregistree } from '@/stockage/projets';
import { libelleFeu } from '@/textes/feux';
import { CATEGORIES_VISITE } from '@/textes/visite';
import {
  grouperParCategorie,
  marquerFaite,
  noter,
  progression,
  reponseDe,
  repondre,
  rouvrir,
  visiteDe,
} from '@/visite';

import { Progression } from './visite/Progression';
import { QuestionVisite } from './visite/QuestionVisite';

export function Visite(): JSX.Element {
  const { enregistre, resultats: r } = useProjetCourant();
  const { mettreAJour } = useProjets();
  const document = useModeDocument();
  const naviguer = useNavigate();
  const visite = visiteDe(enregistre);
  const questions = useMemo(() => questionsPourProjet(r.projet, r), [r]);
  const groupes = useMemo(() => grouperParCategorie(questions), [questions]);
  const compte = progression(questions, visite);
  const lectureSeule = document || visite.faite;

  const enregistrer = (suivante: VisiteEnregistree): void => {
    mettreAJour(enregistre.id, enregistre.projet, { visite: suivante });
  };
  const marquer = (): void => {
    enregistrer(marquerFaite(visite, new Date().toISOString()));
    void naviguer(`/projets/${enregistre.id}`);
  };

  return (
    <Page>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <TitrePage taille="volet">
            {visite.faite ? 'Compte rendu de visite' : 'Préparer la visite'}
          </TitrePage>
          <Chapo>
            {visite.faite ? (
              <>
                Visite faite{visite.date === undefined ? '' : ` le ${dateCourte(visite.date)}`}. Les
                réponses sont figées ; le rapport tient compte des valeurs relevées.
              </>
            ) : (
              <>
                {compte.total} questions pour ce bien, tirées des listes publiques et de ce que
                l'annonce dit. Répondez sur place : tout est enregistré avec le projet.
              </>
            )}
          </Chapo>
        </div>
        <Progression compte={compte} />
        <div className="flex flex-wrap gap-2.5" aria-label="Cinq feux">
          {r.verdict.feux.map((f) => (
            <Pastille key={f.axe} ton={f.feu} feu={f.feu} compacte>
              {libelleFeu(f)}
            </Pastille>
          ))}
        </div>
      </div>

      {groupes.map((g) => (
        <Carte key={g.categorie}>
          <h2 className="m-0 font-display text-[22px] font-semibold">
            {CATEGORIES_VISITE[g.categorie]}
          </h2>
          <ul className="m-0 flex list-none flex-col p-0">
            {g.questions.map((q) => (
              <QuestionVisite
                key={q.id}
                question={q}
                reponse={reponseDe(visite, q.id)}
                lectureSeule={lectureSeule}
                aCocherSurPapier={document && !visite.faite}
                onEtat={(etat) => {
                  enregistrer(repondre(visite, q.id, etat));
                }}
                onNote={(note) => {
                  enregistrer(noter(visite, q.id, note));
                }}
              />
            ))}
          </ul>
        </Carte>
      ))}

      {!document &&
        (visite.faite ? (
          <Carte className="border-accent-bordure bg-accent-fond sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0 text-[15px] text-encre-2">
              Une chose à corriger ? Rouvrez la visite : l'onglet revient, les réponses restent.
            </p>
            <Bouton
              onClick={() => {
                enregistrer(rouvrir(visite));
              }}
            >
              Rouvrir la visite
            </Bouton>
          </Carte>
        ) : (
          <Carte className="border-accent-bordure bg-accent-fond sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0 text-[15px] text-encre-2">
              Visite terminée ? L'onglet disparaît, le compte rendu reste dans le dossier. Les
              autres chiffres se corrigent dans{' '}
              <Link to={`/projets/${enregistre.id}/hypotheses`} className="font-bold">
                vos hypothèses
              </Link>
              .
            </p>
            <Bouton variante="primaire" onClick={marquer}>
              Marquer la visite comme faite
            </Bouton>
          </Carte>
        ))}
    </Page>
  );
}
