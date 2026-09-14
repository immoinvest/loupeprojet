import { useEffect, useState, type JSX } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import {
  annoncePartagee,
  construireProjet,
  lireFragmentCapture,
  nomDuProjet,
  resoudreAnnonce,
  type AnnonceResolue,
  type CaptureImportee,
  type SaisieProjet,
} from '@/annonces';
import { annonceLue } from '@/annonces/fiche';
import { Chapo, Page, TitrePage } from '@/composants/mise-en-page';
import { Bouton, Carte, Pastille } from '@/composants/ui';
import { useClientWorker } from '@/coque/ClientWorker';
import { completerAvecIa, enrichirSaisie, lireAnnonce, type ModeLecture } from '@/enrichissement';
import { useProjets } from '@/stockage/ProjetsContext';

import { FormulaireProjet, valeursDepuisChamps, type OptionsFormulaire } from './FormulaireProjet';
import { EtatLectureAuto, useLectureAutomatique } from './nouveau-projet/LectureAuto';
import { PastillesLien } from './nouveau-projet/PastillesLien';

type Etape = 'lien' | 'texte' | 'verifier';

const CHEMIN = '/projets/nouveau';

function pluriel(n: number, mot: string): string {
  return `${String(n)} ${mot}${n > 1 ? 's' : ''}`;
}

export function NouveauProjet(): JSX.Element {
  const { creer } = useProjets();
  const naviguer = useNavigate();
  const { hash, search } = useLocation();
  // Le fragment est lu une seule fois, au premier rendu, puis effacé de l'adresse (effet ci-dessous).
  const [fragment] = useState(() => lireFragmentCapture(hash));
  // Annonce partagée depuis l'app d'un portail : lue au premier rendu, ignorée si une capture arrive.
  const [partage] = useState(() => annoncePartagee(fragment.statut !== 'absente', search));
  const capture: CaptureImportee | null = fragment.statut === 'lue' ? fragment.capture : null;
  const [importee, setImportee] = useState<CaptureImportee | null>(capture);
  const [url, setUrl] = useState(capture?.annonce.urlCanonique ?? partage.lien ?? '');
  const [texte, setTexte] = useState(partage.texte);
  const [etape, setEtape] = useState<Etape>(capture === null ? partage.etape : 'verifier');
  const [manuel, setManuel] = useState(false);
  const [initial, setInitial] = useState(() => valeursDepuisChamps(capture?.champs ?? {}));
  const [nbChamps, setNbChamps] = useState(
    capture === null ? 0 : Object.keys(capture.champs).length,
  );
  // Change à chaque lecture : le formulaire repart des nouvelles valeurs.
  const [version, setVersion] = useState(0);
  const client = useClientWorker();
  const [lecture, setLecture] = useState<ModeLecture | null>(null);
  const [enCours, setEnCours] = useState<'lecture' | 'creation' | null>(null);

  const annonce: AnnonceResolue | null = resoudreAnnonce(url);

  const appliquerCapture = (lue: CaptureImportee, mode: ModeLecture | null): void => {
    setImportee(lue);
    setInitial(valeursDepuisChamps(lue.champs));
    setNbChamps(Object.keys(lue.champs).length);
    setLecture(mode);
    setVersion((v) => v + 1);
    setEtape('verifier');
  };

  const auto = useLectureAutomatique(
    annonce,
    !manuel && importee === null,
    client,
    appliquerCapture,
  );

  // Capture ou partage lus : l'adresse redevient /projets/nouveau, rien n'en reste.
  useEffect(() => {
    if (fragment.statut !== 'absente' || partage.recue) void naviguer(CHEMIN, { replace: true });
  }, [fragment.statut, partage.recue, naviguer]);

  useEffect(() => {
    // Capture reçue par l'adresse (clic sur l'extension, favori) : l'IA complète les trous du texte.
    if (capture === null) return;
    let vivant = true;
    void completerAvecIa(capture, client).then((complete) => {
      if (vivant && complete.mode === 'ia') appliquerCapture(complete.capture, complete.mode);
    });
    return () => {
      vivant = false;
    };
    // Une seule fois, pour la capture du premier rendu.
  }, []);

  const lireTexte = async (): Promise<void> => {
    setEnCours('lecture');
    const { champs, mode } = await lireAnnonce(texte, client);
    setInitial(valeursDepuisChamps(champs));
    setNbChamps(Object.keys(champs).length);
    setLecture(mode);
    setVersion((v) => v + 1);
    setEnCours(null);
    setEtape('verifier');
  };

  const passerEnManuel = (): void => {
    setManuel(true);
    setInitial(valeursDepuisChamps({}));
    setEtape('verifier');
  };

  const creerProjet = async (saisie: SaisieProjet, options: OptionsFormulaire): Promise<void> => {
    setEnCours('creation');
    // Ventes réelles et loyers de la commune ; sans réponse, le projet est créé sans repère de marché.
    const enrichi = await enrichirSaisie(saisie, client);
    const nom = nomDuProjet(saisie);
    const source = construireProjet(saisie, 'a-remplacer', enrichi);
    // Photos et fiche de l'annonce lue suivent le projet ; rien en saisie manuelle.
    const annonce =
      manuel || importee === null
        ? undefined
        : annonceLue(importee.photos, importee.fiche ?? {}, new Date().toISOString());
    const enregistre = creer({
      nom,
      source,
      ...(annonce === undefined ? {} : { annonce }),
      ...(options.visiteFaite
        ? { visite: { faite: true, date: new Date().toISOString(), reponses: {} } }
        : {}),
    });
    void naviguer(`/projets/${enregistre.id}`);
  };

  const lectureEnCours = auto.lecture?.statut === 'en-cours';

  return (
    <Page espacement="large">
      <div className="flex flex-col gap-2">
        <TitrePage taille="accroche" className="max-w-[22ch]">
          Colle le lien de l'annonce, on s'occupe du reste.
        </TitrePage>
        <Chapo>
          Prix, surface, étage, DPE, charges : tout ce que l'annonce dit est lu pour vous. Vous
          vérifiez cinq chiffres, et le rapport est prêt.
        </Chapo>
      </div>

      {!manuel && (
        <Carte>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-encre-2">Lien de l'annonce</span>
            <input
              name="url"
              type="url"
              value={url}
              placeholder="https://www.leboncoin.fr/ad/ventes_immobilieres/…"
              onChange={(e) => {
                const nouvelle = resoudreAnnonce(e.target.value);
                setUrl(e.target.value);
                setEtape(nouvelle === null ? 'lien' : 'texte');
                if (importee !== null && nouvelle?.urlCanonique !== importee.annonce.urlCanonique) {
                  setImportee(null);
                }
              }}
              className="min-h-[52px] rounded-encart border border-bordure bg-surface px-4 text-[16px]"
            />
          </label>
          <PastillesLien
            annonce={annonce}
            url={url}
            importee={importee}
            captureIllisible={fragment.statut === 'illisible'}
            partagee={url === partage.lien}
          />
          {importee === null && (
            <EtatLectureAuto
              extension={auto.extension}
              lecture={auto.lecture}
              lienReconnu={annonce !== null}
              relancer={auto.relancer}
            />
          )}
        </Carte>
      )}

      {!manuel &&
        !lectureEnCours &&
        (etape === 'texte' || etape === 'verifier' || url.trim() !== '') && (
          <Carte>
            <div className="flex flex-col gap-1">
              <h2 className="m-0 font-display text-[22px] font-semibold">
                {importee === null ? "Le texte de l'annonce" : 'Il manque quelque chose ?'}
              </h2>
              <p className="m-0 text-sm text-encre-2">
                {importee === null ? (
                  <>
                    Avec l'
                    <Link to="/extension" className="font-bold text-accent">
                      extension Deklic
                    </Link>
                    , coller le lien suffit. Sinon : sur l'annonce, tout sélectionner (Ctrl+A),
                    copier (Ctrl+C), et coller ici.
                  </>
                ) : (
                  'Collez le texte de l’annonce pour compléter ce qui a été lu.'
                )}{' '}
                Le texte n'est pas conservé, seulement ce qu'on y lit.
              </p>
            </div>
            <textarea
              name="texte"
              value={texte}
              onChange={(e) => {
                setTexte(e.target.value);
              }}
              rows={7}
              placeholder="Appartement T3 de 65 m² au 3e étage… Prix 155 000 €… DPE D…"
              className="rounded-encart border border-bordure bg-surface p-3 text-[15px] pointer-coarse:text-base"
            />
            <div className="flex flex-wrap items-center gap-3">
              <Bouton
                variante="primaire"
                onClick={() => {
                  void lireTexte();
                }}
                disabled={texte.trim() === '' || enCours !== null}
              >
                {enCours === 'lecture' ? 'Lecture en cours…' : 'Lire le texte'}
              </Bouton>
              {etape === 'verifier' && enCours !== 'lecture' && (
                <span className="text-sm text-encre-2">
                  {nbChamps === 0
                    ? 'Rien de reconnu : remplissez le formulaire ci-dessous.'
                    : `${pluriel(nbChamps, 'champ')} ${nbChamps > 1 ? 'lus' : 'lu'} dans l'annonce${lecture === 'ia' ? " par l'IA" : ''}, à vérifier ci-dessous.`}
                </span>
              )}
            </div>
          </Carte>
        )}

      {etape !== 'verifier' && !manuel && !lectureEnCours && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-encre-3">
          <span>Pas de lien ?</span>
          <button
            type="button"
            onClick={passerEnManuel}
            className="font-bold text-accent pointer-coarse:min-h-11"
          >
            Je n'ai pas de lien, je saisis à la main
          </button>
        </div>
      )}

      {etape === 'verifier' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
            <h2 className="m-0 font-display text-2xl font-bold tracking-tight sm:text-[28px]">
              Vérifiez, corrigez, et c'est parti.
            </h2>
            <span className="text-sm text-encre-3">
              <Pastille ton="neutre" compacte>
                annonce
              </Pastille>{' '}
              lu dans l'annonce ·{' '}
              <Pastille ton="accent" compacte>
                à toi
              </Pastille>{' '}
              à confirmer
            </span>
          </div>
          <FormulaireProjet
            key={`${String(manuel)}-${String(version)}`}
            initial={initial}
            annonce={manuel ? null : annonce}
            onCreer={(saisie, options) => {
              if (enCours === null) void creerProjet(saisie, options);
            }}
          />
          {enCours === 'creation' && (
            <p role="status" className="m-0 text-sm text-encre-2">
              On cherche les ventes réelles et les loyers de la commune…
            </p>
          )}
        </div>
      )}
    </Page>
  );
}
