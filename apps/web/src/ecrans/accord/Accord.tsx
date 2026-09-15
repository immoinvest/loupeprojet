import type { LectureAccord } from '@loupe/gestion';
import { useEffect, useState, type JSX } from 'react';
import { Link, useLocation } from 'react-router';

import { Bouton } from '@/composants/ui';
import { useEnvois } from '@/gestion/envois/EnvoisContext';
import { jetonDuFragment } from '@/gestion/envois/logique';
import type { CodeErreurEnvois, TypeReponseAccord } from '@/gestion/envois/types';
import { LogotypeDeklic } from '@/marque/Logo';
import { TEXTES_LOGO } from '@/textes/accueil';
import { bonjour, propositionAccord, TEXTES_ACCORD as T } from '@/textes/gerer-envois';

type Etape =
  | { readonly type: 'chargement' }
  | { readonly type: 'question'; readonly lecture: LectureAccord }
  | { readonly type: 'repondu'; readonly reponse: TypeReponseAccord }
  | { readonly type: 'echec'; readonly code: CodeErreurEnvois };

function Message({ etape }: { readonly etape: Etape }): JSX.Element | null {
  if (etape.type === 'repondu') {
    return (
      <p role="status" className="m-0 rounded-encart bg-bon-fond p-3 text-[15px] text-bon-texte">
        {etape.reponse === 'accorde' ? T.merciOui : T.merciNon}
      </p>
    );
  }
  if (etape.type !== 'echec') return null;
  const texte =
    etape.code === 'lien_invalide'
      ? T.invalide
      : etape.code === 'indisponible'
        ? T.indisponible
        : T.erreur;
  return (
    <p role="alert" className="m-0 text-[15px] text-encre-2">
      {texte}
    </p>
  );
}

/**
 * /accord#<jeton> : hors de la coque et sans compte, le locataire accepte ou refuse les quittances
 * par e-mail (G2-1). Ouvrir la page ne consomme rien ; seul un bouton répond (ADR-G41).
 */
export function Accord(): JSX.Element {
  const { accord } = useEnvois();
  const { hash } = useLocation();
  const jeton = jetonDuFragment(hash);
  const [etape, setEtape] = useState<Etape>(
    jeton === null ? { type: 'echec', code: 'lien_invalide' } : { type: 'chargement' },
  );
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    if (jeton === null) return undefined;
    let actif = true;
    void accord.lire(jeton).then((r) => {
      if (!actif) return;
      setEtape(r.ok ? { type: 'question', lecture: r.valeur } : { type: 'echec', code: r.code });
    });
    return () => {
      actif = false;
    };
  }, [accord, jeton]);

  const repondre = async (reponse: TypeReponseAccord): Promise<void> => {
    if (jeton === null) return;
    setOccupe(true);
    const r = await accord.repondre(jeton, reponse);
    setOccupe(false);
    setEtape(
      r.ok ? { type: 'repondu', reponse: r.valeur.statut } : { type: 'echec', code: r.code },
    );
  };

  const invalide = etape.type === 'echec' && etape.code === 'lien_invalide';

  return (
    <main className="flex min-h-dvh items-center justify-center bg-fond py-10 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))]">
      <div className="flex w-full max-w-[480px] flex-col gap-6">
        <Link
          to="/"
          aria-label={TEXTES_LOGO}
          data-logo
          className="self-center rounded-encart px-2 py-1 pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
        >
          <LogotypeDeklic hauteur={32} />
        </Link>

        <section className="flex flex-col gap-5 rounded-carte border border-bordure bg-surface p-5 shadow-carte sm:p-8">
          <h1 className="m-0 text-center font-display text-[26px] leading-tight font-bold tracking-tight">
            {invalide ? T.invalideTitre : T.titre}
          </h1>

          {etape.type === 'chargement' && (
            <p className="m-0 text-center text-sm text-encre-3">{T.chargement}</p>
          )}

          {etape.type === 'question' && (
            <>
              <div className="flex flex-col gap-2 text-[16px] text-encre-2">
                <p className="m-0">{bonjour(etape.lecture.prenom)}</p>
                <p className="m-0">{propositionAccord(etape.lecture)}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
                <Bouton
                  variante="primaire"
                  disabled={occupe}
                  onClick={() => void repondre('accorde')}
                >
                  {T.oui}
                </Bouton>
                <Bouton disabled={occupe} onClick={() => void repondre('refuse')}>
                  {T.non}
                </Bouton>
              </div>
              <p className="m-0 text-sm text-encre-3">{T.loi}</p>
            </>
          )}

          <Message etape={etape} />
        </section>

        <Link
          to="/"
          className="self-center text-[15px] font-bold pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
        >
          {T.accueil}
        </Link>
      </div>
    </main>
  );
}
