import { useState, type JSX } from 'react';

import { PORTAILS, resoudreAnnonce } from '@/annonces';
import { surUnPortail } from '@/annonces/fiche';
import { Carte, Pastille, TitreCarte } from '@/composants/ui';
import { useProjetCourant } from '@/coque/ProjetLayout';
import { pastillesFiche, TEXTES_FICHE } from '@/textes/fiche-bien';

/**
 * « Le bien » : les photos et les caractéristiques de l'annonce lue à la création du projet. Les
 * photos sont affichées depuis le portail (jamais copiées), sans transmettre l'adresse de Deklic ;
 * une image qui ne se charge plus disparaît. Rien pour un projet saisi à la main.
 */
export function CarteBien(): JSX.Element | null {
  const { enregistre } = useProjetCourant();
  const [cassees, setCassees] = useState<ReadonlySet<string>>(() => new Set());
  const annonce = enregistre.annonce;
  if (annonce === undefined) return null;

  const photos = (annonce.photos ?? []).filter((url) => surUnPortail(url) && !cassees.has(url));
  const pastilles = pastillesFiche(annonce.fiche);
  // Le lien n'est proposé que vers une annonce reconnue d'un des cinq portails, en https.
  const source = enregistre.projet.source;
  const lien =
    source !== undefined && surUnPortail(source.url) ? resoudreAnnonce(source.url) : null;
  if (photos.length === 0 && pastilles.length === 0) return null;

  return (
    <Carte>
      <TitreCarte>{TEXTES_FICHE.titre}</TitreCarte>
      {photos.length > 0 && (
        <ul
          aria-label={TEXTES_FICHE.photos}
          className="m-0 flex list-none snap-x snap-mandatory gap-2 overflow-x-auto p-0 pb-1 print:hidden"
        >
          {photos.map((url, index) => (
            <li key={url} className="shrink-0 snap-start">
              <img
                src={url}
                alt={TEXTES_FICHE.photo(index + 1, photos.length)}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => {
                  setCassees((avant) => new Set([...avant, url]));
                }}
                className="h-40 w-56 rounded-encart bg-accent-fond object-cover sm:h-48 sm:w-72"
              />
            </li>
          ))}
        </ul>
      )}
      {pastilles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pastilles.map((libelle) => (
            <Pastille key={libelle} ton="neutre" compacte>
              {libelle}
            </Pastille>
          ))}
        </div>
      )}
      {lien !== null && (
        <a
          href={lien.urlCanonique}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center text-sm font-bold text-accent print:hidden"
        >
          {TEXTES_FICHE.voir(PORTAILS[lien.portail])}
        </a>
      )}
    </Carte>
  );
}
