import type { QuestionPosee } from '@loupe/moteur';
import { useState, type JSX } from 'react';

import { Pastille, type TonPastille } from '@/composants/ui';
import type { EtatReponse, ReponseVisite } from '@/stockage/projets';
import { ETATS_REPONSE, texteQuestion } from '@/textes/visite';
import { descripteurDeValeur } from '@/visite';

import { ChampValeur } from './ChampValeur';
import { ChoixEtat } from './ChoixEtat';

const TON_ETAT: Readonly<Record<EtatReponse, TonPastille>> = {
  a_verifier: 'neutre',
  ok: 'bon',
  probleme: 'probleme',
  sans_objet: 'inconnu',
};

function Note({
  id,
  texte,
  note,
  onChange,
}: {
  id: string;
  texte: string;
  note: string | undefined;
  onChange: (note: string) => void;
}): JSX.Element {
  const [ouverte, setOuverte] = useState(note !== undefined);
  const [saisie, setSaisie] = useState(note ?? '');
  if (!ouverte) {
    return (
      <button
        type="button"
        onClick={() => {
          setOuverte(true);
        }}
        className="self-start text-sm font-bold text-accent pointer-coarse:min-h-11"
      >
        Ajouter une note
      </button>
    );
  }
  return (
    <input
      name={`note-${id}`}
      aria-label={`Note : ${texte}`}
      value={saisie}
      placeholder="Ce que vous avez vu ou entendu"
      autoFocus={note === undefined}
      onChange={(e) => {
        setSaisie(e.target.value);
        onChange(e.target.value);
      }}
      className="min-h-[44px] w-full max-w-[560px] rounded-encart border border-bordure bg-surface px-3 text-[15px] pointer-coarse:text-base"
    />
  );
}

/**
 * Une question de la liste : texte et source, puis la réponse (quatre boutons ou, en lecture
 * seule, une pastille), le champ à valeur s'il y en a un, et la note.
 */
export function QuestionVisite({
  question,
  reponse,
  lectureSeule,
  aCocherSurPapier,
  onEtat,
  onNote,
}: {
  question: QuestionPosee;
  reponse: ReponseVisite;
  /** Visite faite ou mode document : plus de boutons, l'état et la note en texte. */
  lectureSeule: boolean;
  /** Document d'une visite à faire : une case vide devant chaque question. */
  aCocherSurPapier: boolean;
  onEtat: (etat: EtatReponse) => void;
  onNote: (note: string) => void;
}): JSX.Element {
  const texte = texteQuestion(question);
  const descripteur = descripteurDeValeur(question);
  return (
    <li className="flex flex-col gap-2 border-b border-bordure-douce py-3 last:border-b-0">
      <div className="flex gap-3">
        {aCocherSurPapier && (
          <span
            aria-hidden="true"
            className="mt-0.5 inline-block h-4 w-4 shrink-0 rounded-[4px] border border-encre-3"
          />
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="m-0 text-[15px] leading-snug">{texte}</p>
          <span className="text-xs text-encre-4">Source : {question.source}</span>
        </div>
      </div>
      {lectureSeule ? (
        !aCocherSurPapier && (
          <Pastille ton={TON_ETAT[reponse.etat]} compacte>
            {ETATS_REPONSE[reponse.etat]}
          </Pastille>
        )
      ) : (
        <ChoixEtat id={question.id} texte={texte} etat={reponse.etat} onChange={onEtat} />
      )}
      {!lectureSeule && descripteur !== null && (
        <ChampValeur question={question} descripteur={descripteur} />
      )}
      {lectureSeule ? (
        reponse.note !== undefined && (
          <p className="m-0 text-sm text-encre-2 italic">{reponse.note}</p>
        )
      ) : (
        <Note id={question.id} texte={texte} note={reponse.note} onChange={onNote} />
      )}
    </li>
  );
}
