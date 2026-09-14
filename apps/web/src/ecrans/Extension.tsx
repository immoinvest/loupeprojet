import { useEffect, useRef, useState, type JSX } from 'react';
import { Link } from 'react-router';

import { NOM_FAVORI, codeFavori } from '@/bookmarklet/favori';
import { Chapo, Page, TitrePage } from '@/composants/mise-en-page';
import { Bouton, Carte, Pastille } from '@/composants/ui';

import { CarteTelephone } from './extension/CarteTelephone';

const README_EXTENSION =
  'https://github.com/immoinvest/loupeprojet/tree/master/apps/extension#charger-lextension-non-empaquetée';

/**
 * Sur écran tactile, la carte « Sur téléphone et tablette » passe en tête (ordre visuel) ; à la
 * souris, elle suit les cartes de l'ordinateur, dans l'ordre du document.
 */
const APRES_AU_DOIGT = 'pointer-coarse:order-2';
const D_ABORD_AU_DOIGT = 'pointer-coarse:order-1';

type EtatCopie = 'initial' | 'copie' | 'echec';

async function copier(texte: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    return false;
  }
}

export function Extension(): JSX.Element {
  const [href] = useState(() => codeFavori(window.location.origin));
  const [copie, setCopie] = useState<EtatCopie>('initial');
  const lien = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    // React refuse les URL javascript: dans les props ; le favori est posé directement sur le lien.
    lien.current?.setAttribute('href', href);
  }, [href]);

  const copierFavori = (): void => {
    void copier(href).then((ok) => {
      setCopie(ok ? 'copie' : 'echec');
    });
  };

  return (
    <Page espacement="large">
      <div className="flex flex-col gap-2">
        <TitrePage taille="accroche" className="max-w-[22ch]">
          Lisez une annonce en un clic.
        </TitrePage>
        <Chapo>
          Sur une annonce LeBonCoin, SeLoger, Bien'ici, PAP ou Logic-Immo, un clic lit la page dans
          votre navigateur et ouvre Deklic avec le formulaire pré-rempli. La page n'est jamais lue
          par nos serveurs.
        </Chapo>
      </div>

      <Carte className={APRES_AU_DOIGT}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h2 className="m-0 font-display text-[22px] font-semibold">
            Le bouton-favori, sans rien installer
          </h2>
          <Pastille ton="bon" compacte>
            tous les navigateurs d'ordinateur
          </Pastille>
        </div>
        <p className="m-0 text-[15px] text-encre-2">
          Un favori s'ajoute à la main, aucun site ne peut le faire à votre place. Deux façons, au
          choix :
        </p>
        <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 text-[15px] text-encre-2">
          <li>
            <strong>Glisser</strong> le bouton ci-dessous dans votre barre de favoris (Ctrl+Maj+B
            sur Windows, Cmd+Maj+B sur Mac pour l'afficher).
          </li>
          <li>
            Ou <strong>copier</strong> le favori, puis clic droit sur la barre de favoris, « Ajouter
            une page… » (Chrome, Edge) ou « Nouveau marque-page » (Firefox) : nom « {NOM_FAVORI} »,
            adresse : collez.
          </li>
        </ol>
        <div className="flex flex-wrap items-center gap-3">
          <a
            ref={lien}
            draggable
            title="Glissez-moi dans votre barre de favoris"
            onClick={(e) => {
              // Cliqué ici, le favori n'a pas d'annonce à lire : on copie plutôt son adresse.
              e.preventDefault();
              copierFavori();
            }}
            className="inline-flex min-h-[44px] cursor-grab items-center gap-2 rounded-full border-2 border-dashed border-accent px-4 text-sm font-semibold text-accent"
          >
            {NOM_FAVORI}
          </a>
          <Bouton onClick={copierFavori}>Copier le favori</Bouton>
          <span className="text-sm text-encre-3" aria-live="polite">
            {copie === 'copie' && 'Favori copié : ajoutez-le à vos favoris en collant son adresse.'}
            {copie === 'echec' &&
              'Copie impossible ici : sélectionnez et copiez le texte ci-dessous.'}
          </span>
        </div>
        {copie === 'echec' && (
          <textarea
            readOnly
            aria-label="Adresse du favori"
            value={href}
            rows={3}
            className="w-full rounded-encart border border-bordure bg-surface p-3 font-mono text-xs pointer-coarse:text-base"
          />
        )}
        <p className="m-0 text-sm text-encre-3">
          Ensuite, sur une annonce, cliquez le favori : Deklic s'ouvre, pré-rempli. Le favori charge
          son code depuis Deklic à chaque clic, donc il reste à jour ; si un site bloque ce
          chargement, il vous le dit et l'extension prend le relais.
        </p>
      </Carte>

      <Carte className={APRES_AU_DOIGT}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h2 className="m-0 font-display text-[22px] font-semibold">L'extension navigateur</h2>
          <Pastille ton="neutre" compacte>
            ordinateur : Chrome · Edge · Firefox
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

      <Carte className={APRES_AU_DOIGT}>
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
            collez le lien de l'annonce
          </Link>{' '}
          dans Nouveau projet.
        </p>
      </Carte>

      <CarteTelephone className={D_ABORD_AU_DOIGT} />
    </Page>
  );
}
