import { useEffect, useState, type JSX } from 'react';
import { useLocation, useNavigate } from 'react-router';

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
import { Carte, Pastille } from '@/composants/ui';
import { useClientWorker } from '@/coque/ClientWorker';
import { completerAvecIa, enrichirSaisie, lireAnnonce } from '@/enrichissement';
import { useProjets } from '@/stockage/ProjetsContext';

import { FormulaireProjet, valeursDepuisChamps, type OptionsFormulaire } from './FormulaireProjet';
import { EtatLectureAuto, useLectureAutomatique } from './nouveau-projet/LectureAuto';
import { PastillesLien } from './nouveau-projet/PastillesLien';

type Etape = 'lien' | 'verifier';

const CHEMIN = '/projets/nouveau';

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
  const [etape, setEtape] = useState<Etape>(capture === null ? 'lien' : 'verifier');
  const [manuel, setManuel] = useState(false);
  const [initial, setInitial] = useState(() => valeursDepuisChamps(capture?.champs ?? {}));
  // Change à chaque lecture : le formulaire repart des nouvelles valeurs.
  const [version, setVersion] = useState(0);
  const client = useClientWorker();
  const [enCours, setEnCours] = useState<'lecture' | 'creation' | null>(
    partage.texte === '' ? null : 'lecture',
  );

  const annonce: AnnonceResolue | null = resoudreAnnonce(url);

  const appliquerCapture = (lue: CaptureImportee): void => {
    setImportee(lue);
    setInitial(valeursDepuisChamps(lue.champs));
    setVersion((v) => v + 1);
    setEtape('verifier');
  };

  const auto = useLectureAutomatique(
    annonce,
    !manuel && importee === null && etape === 'lien',
    client,
    appliquerCapture,
  );

  // Capture ou partage lus : l'adresse redevient /projets/nouveau, rien n'en reste.
  useEffect(() => {
    if (fragment.statut !== 'absente' || partage.recue) void naviguer(CHEMIN, { replace: true });
  }, [fragment.statut, partage.recue, naviguer]);

  useEffect(() => {
    let vivant = true;
    // Capture reçue par l'adresse (clic sur l'extension, favori) : l'IA complète les trous du texte.
    if (capture !== null) {
      void completerAvecIa(capture, client).then((complete) => {
        if (vivant && complete.mode === 'ia') appliquerCapture(complete.capture);
      });
    } else if (partage.texte !== '') {
      // Texte partagé sans lien : lu tout de suite, puis oublié ; seul le formulaire en garde les chiffres.
      void lireAnnonce(partage.texte, client).then(({ champs }) => {
        if (!vivant) return;
        setInitial(valeursDepuisChamps(champs));
        setVersion((v) => v + 1);
        setEnCours(null);
        setEtape('verifier');
      });
    }
    return () => {
      vivant = false;
    };
    // Une seule fois, pour la capture ou le partage du premier rendu.
  }, []);

  /** Sans lien : formulaire vide, sans annonce. */
  const passerEnManuel = (): void => {
    setManuel(true);
    setInitial(valeursDepuisChamps({}));
    setEtape('verifier');
  };

  /** Lecture impossible : le lien reste (source du projet), les chiffres se saisissent à la main. */
  const saisirALaMain = (): void => {
    setInitial(valeursDepuisChamps({}));
    setVersion((v) => v + 1);
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
                // Même annonce que celle déjà lue : le formulaire reste ; sinon on repart du lien.
                if (
                  nouvelle?.urlCanonique !== importee?.annonce.urlCanonique ||
                  importee === null
                ) {
                  setImportee(null);
                  setEtape('lien');
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
          {importee === null && etape === 'lien' && (
            <EtatLectureAuto
              extension={auto.extension}
              lecture={auto.lecture}
              relancer={auto.relancer}
              lireSansExtension={auto.lireSansExtension}
              annuler={auto.annuler}
              saisirALaMain={saisirALaMain}
            />
          )}
        </Carte>
      )}

      {enCours === 'lecture' && (
        <p role="status" className="m-0 text-sm text-encre-2">
          On lit l'annonce partagée…
        </p>
      )}

      {etape === 'lien' && !manuel && annonce === null && enCours === null && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-encre-3">
          <span>Pas de lien ?</span>
          <button
            type="button"
            onClick={passerEnManuel}
            className="font-bold text-accent survol-texte pointer-coarse:min-h-11"
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
