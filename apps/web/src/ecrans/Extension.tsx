import { useEffect, useRef, useState, type JSX } from 'react';
import { Link } from 'react-router';

import { Carte, Pastille } from '@/composants/ui';

const README_EXTENSION =
  'https://github.com/immoinvest/loupeprojet/tree/master/apps/extension#charger-lextension-non-empaquetée';

type EtatFavori = 'chargement' | 'pret' | 'indisponible';

/** Récupère le code du bouton-favori servi par le site et le transforme en URL `javascript:`. */
async function chargerFavori(): Promise<string> {
  const reponse = await fetch('/capture.js');
  if (!reponse.ok) throw new Error(`capture.js : ${String(reponse.status)}`);
  return `javascript:${encodeURIComponent(await reponse.text())}`;
}

export function Extension(): JSX.Element {
  const [etat, setEtat] = useState<EtatFavori>('chargement');
  const lien = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    let actif = true;
    chargerFavori()
      .then((href) => {
        if (!actif) return;
        // React refuse les URL javascript: dans les props ; le favori est posé directement sur le lien.
        lien.current?.setAttribute('href', href);
        setEtat('pret');
      })
      .catch(() => {
        if (actif) setEtat('indisponible');
      });
    return () => {
      actif = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6 px-10 pt-8 pb-10">
      <div className="flex flex-col gap-2">
        <h1 className="m-0 max-w-[22ch] font-display text-[40px] leading-[1.1] font-bold tracking-tight text-balance">
          Lisez une annonce en un clic.
        </h1>
        <p className="m-0 max-w-[64ch] text-[17px] text-encre-2">
          Sur une annonce LeBonCoin, SeLoger, Bien'ici, PAP ou Logic-Immo, un clic lit la page dans
          votre navigateur et ouvre Deklic avec le formulaire pré-rempli. La page n'est jamais lue
          par nos serveurs.
        </p>
      </div>

      <Carte>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="m-0 font-display text-[22px] font-semibold">
            Le bouton-favori, sans rien installer
          </h2>
          <Pastille ton="bon" compacte>
            tous les navigateurs d'ordinateur
          </Pastille>
        </div>
        <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 text-[15px] text-encre-2">
          <li>Affichez votre barre de favoris (Ctrl+Maj+B sur Windows, Cmd+Maj+B sur Mac).</li>
          <li>Glissez le bouton ci-dessous dans cette barre.</li>
          <li>Sur une annonce, cliquez-le : Deklic s'ouvre, pré-rempli.</li>
        </ol>
        <div className="flex flex-wrap items-center gap-3">
          <a
            ref={lien}
            draggable
            title="Glissez-moi dans votre barre de favoris"
            onClick={(e) => {
              // Cliqué ici, le favori n'a pas d'annonce à lire : on n'exécute rien.
              e.preventDefault();
            }}
            className={`inline-flex min-h-[44px] cursor-grab items-center gap-2 rounded-full border-2 border-dashed border-accent px-4 text-sm font-semibold text-accent ${
              etat === 'pret' ? '' : 'pointer-events-none opacity-50'
            }`}
          >
            Analyser dans Deklic
          </a>
          <span className="text-sm text-encre-3">
            {etat === 'chargement' && 'Préparation du bouton…'}
            {etat === 'pret' && 'Un clic ici ne fait rien : glissez-le dans la barre de favoris.'}
            {etat === 'indisponible' &&
              "Le bouton-favori n'est pas disponible sur cette version du site."}
          </span>
        </div>
      </Carte>

      <Carte>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="m-0 font-display text-[22px] font-semibold">L'extension navigateur</h2>
          <Pastille ton="neutre" compacte>
            Chrome · Edge · Firefox
          </Pastille>
        </div>
        <p className="m-0 text-[15px] text-encre-2">
          Même lecture, avec une icône dans la barre d'outils. Elle n'est pas encore sur les
          boutiques d'extensions : il faut la construire et la charger « non empaquetée », en
          suivant{' '}
          <a href={README_EXTENSION} className="font-bold text-accent" rel="noopener">
            le guide du dépôt
          </a>
          .
        </p>
      </Carte>

      <Carte>
        <h2 className="m-0 font-display text-[22px] font-semibold">Ce qui reste chez vous</h2>
        <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-[15px] text-encre-2">
          <li>La page de l'annonce est lue dans votre navigateur, jamais par nos serveurs.</li>
          <li>
            Seuls les chiffres lus (prix, surface, étage, DPE, charges…) sont transmis à Deklic,
            dans l'adresse de la page, qui ne quitte pas votre navigateur.
          </li>
          <li>Le texte de l'annonce sert à remplir le formulaire, puis il est oublié.</li>
          <li>Aucune permission permanente, aucun suivi, aucune donnée sur vous.</li>
        </ul>
        <p className="m-0 text-sm text-encre-3">
          Sans extension ni favori, ça marche aussi :{' '}
          <Link to="/projets/nouveau" className="font-bold text-accent">
            collez le texte de l'annonce
          </Link>{' '}
          dans Nouveau projet.
        </p>
      </Carte>
    </div>
  );
}
