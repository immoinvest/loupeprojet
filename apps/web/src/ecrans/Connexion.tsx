import { useState, type JSX } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';

import { useCompte } from '@/compte/CompteContext';
import { cheminDeRetour, emailPlausible } from '@/compte/saisie';
import type { CodeErreurCompte, Fournisseurs, FournisseurSocial } from '@/compte/types';
import { LogotypeDeklic } from '@/marque/Logo';
import { TEXTES_LOGO } from '@/textes/accueil';
import { ERREURS_COMPTE } from '@/textes/compte';
import { echecFournisseur, TEXTES_CONNEXION } from '@/textes/connexion';

import { BoutonsFournisseurs } from './connexion/BoutonsFournisseurs';
import { FormulaireCode } from './connexion/FormulaireCode';
import { FormulaireEmail } from './connexion/FormulaireEmail';

type Etape = 'email' | 'code';

function Separateur(): JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="flex items-center gap-3 text-xs font-semibold tracking-wider text-encre-4 uppercase"
    >
      <span className="h-px flex-1 bg-bordure" />
      {TEXTES_CONNEXION.ou}
      <span className="h-px flex-1 bg-bordure" />
    </div>
  );
}

function aucuneMethode(f: Fournisseurs): boolean {
  return !f.email && !f.google && !f.apple;
}

/** La page de connexion : hors de la coque, une carte centrée, comme une connexion classique. */
export function Connexion(): JSX.Element {
  const compte = useCompte();
  const [parametres] = useSearchParams();
  const retour = cheminDeRetour(parametres.get('retour'));
  const [etape, setEtape] = useState<Etape>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState(() => echecFournisseur(parametres.get('fournisseur')));
  const [info, setInfo] = useState<string | null>(null);

  if (compte.etat === 'connecte') return <Navigate to={retour} replace />;

  const commencer = (): void => {
    setOccupe(true);
    setErreur(null);
    setInfo(null);
  };
  const echouer = (codeErreur: CodeErreurCompte): void => {
    setOccupe(false);
    setErreur(ERREURS_COMPTE[codeErreur]);
  };

  const envoyer = async (renvoi: boolean): Promise<void> => {
    if (!emailPlausible(email)) {
      echouer('email_invalide');
      return;
    }
    commencer();
    const r = await compte.demanderCode(email.trim());
    if (!r.ok) {
      echouer(r.code);
      return;
    }
    setOccupe(false);
    setEtape('code');
    setCode('');
    if (renvoi) setInfo(TEXTES_CONNEXION.codeRenvoye);
  };

  // Une connexion réussie fait passer le compte à « connecté » : la page redirige alors vers `retour`.
  const verifier = async (): Promise<void> => {
    commencer();
    const r = await compte.verifierCode(email.trim(), code);
    if (!r.ok) echouer(r.code);
  };

  // En cas de succès, le navigateur quitte la page pour Google ou Apple.
  const choisir = async (fournisseur: FournisseurSocial): Promise<void> => {
    commencer();
    const r = await compte.continuerAvec(fournisseur, retour);
    if (!r.ok) echouer(r.code);
  };

  const revenirAuEmail = (): void => {
    setEtape('email');
    setCode('');
    setErreur(null);
    setInfo(null);
  };

  const f = compte.fournisseurs;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-fond py-10 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))]">
      <div className="flex w-full max-w-[440px] flex-col gap-6">
        <Link
          to="/"
          aria-label={TEXTES_LOGO}
          className="self-center rounded-encart px-2 py-1 survol-fond pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
        >
          <LogotypeDeklic hauteur={32} />
        </Link>

        <section className="flex flex-col gap-5 rounded-carte border border-bordure bg-surface p-5 shadow-carte sm:p-8">
          <div className="flex flex-col gap-1.5 text-center">
            <h1 className="m-0 font-display text-[28px] leading-tight font-bold tracking-tight">
              {etape === 'code' ? TEXTES_CONNEXION.titreCode : TEXTES_CONNEXION.titre}
            </h1>
            {etape === 'email' && (
              <p className="m-0 text-[15px] text-encre-2">{TEXTES_CONNEXION.sousTitre}</p>
            )}
          </div>

          {erreur !== null && (
            <p
              role="alert"
              className="m-0 rounded-encart bg-probleme-fond p-3 text-sm text-probleme-texte"
            >
              {erreur}
            </p>
          )}
          {info !== null && (
            <p role="status" className="m-0 rounded-encart bg-bon-fond p-3 text-sm text-bon-texte">
              {info}
            </p>
          )}

          {f === null ? (
            <p className="m-0 text-center text-sm text-encre-3">{TEXTES_CONNEXION.chargement}</p>
          ) : aucuneMethode(f) ? (
            <p className="m-0 text-center text-sm text-encre-2">{ERREURS_COMPTE.indisponible}</p>
          ) : etape === 'email' ? (
            <>
              <BoutonsFournisseurs
                fournisseurs={f}
                occupe={occupe}
                onChoisir={(fournisseur) => {
                  void choisir(fournisseur);
                }}
              />
              {f.email && (f.google || f.apple) && <Separateur />}
              {f.email && (
                <FormulaireEmail
                  email={email}
                  occupe={occupe}
                  onEmail={setEmail}
                  onEnvoyer={() => {
                    void envoyer(false);
                  }}
                />
              )}
            </>
          ) : (
            <FormulaireCode
              email={email.trim()}
              code={code}
              occupe={occupe}
              onCode={setCode}
              onVerifier={() => {
                void verifier();
              }}
              onRenvoyer={() => {
                void envoyer(true);
              }}
              onChangerAdresse={revenirAuEmail}
            />
          )}
        </section>

        <div className="flex flex-col items-center gap-2 text-center">
          <Link
            to="/"
            className="text-[15px] font-bold pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
          >
            {TEXTES_CONNEXION.sansCompte}
          </Link>
          <p className="m-0 max-w-[40ch] text-xs text-encre-3">{TEXTES_CONNEXION.mentions}</p>
        </div>
      </div>
    </main>
  );
}
