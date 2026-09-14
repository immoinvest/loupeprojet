import 'leaflet/dist/leaflet.css';

import * as L from 'leaflet';
import { useEffect, useRef, type JSX } from 'react';

import {
  ATTRIBUTION_IGN,
  RAYONS_CARTE_METRES,
  URL_TUILES_IGN,
  ZOOM_MAX_IGN,
  type PointCarte,
} from '@/enrichissement';
import { libelleVenteCarte } from '@/textes/carte';

export interface ProprietesCarteVentes {
  readonly lat: number;
  readonly lon: number;
  readonly points: readonly PointCarte[];
  readonly libelle: string;
}

/** Marge autour du cercle le plus large quand la carte cadre le quartier, en mètres. */
const MARGE_CADRAGE_METRES = 40;

/**
 * La carte Leaflet : fond Plan IGN, cercles de l'analyse, le bien au centre, une pastille par vente.
 * Chargée à la demande (onglet Estimation seulement). La molette ne capture pas le défilement de la page ;
 * au doigt, glisser fait défiler la page et les boutons + et − zooment.
 */
export default function CarteVentes({
  lat,
  lon,
  points,
  libelle,
}: ProprietesCarteVentes): JSX.Element {
  const conteneur = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = conteneur.current;
    if (element === null) return undefined;
    const auDoigt =
      typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    const centre = L.latLng(lat, lon);
    const carte = L.map(element, { scrollWheelZoom: false, dragging: !auDoigt });
    carte.attributionControl.setPrefix('Leaflet');
    L.tileLayer(URL_TUILES_IGN, { maxZoom: ZOOM_MAX_IGN, attribution: ATTRIBUTION_IGN }).addTo(
      carte,
    );
    for (const rayon of RAYONS_CARTE_METRES) {
      L.circle(centre, { radius: rayon, className: 'carte-cercle', interactive: false }).addTo(
        carte,
      );
    }
    for (const point of points) {
      L.circleMarker([point.lat, point.lon], {
        radius: 7,
        className: `carte-vente carte-vente-${point.classe}`,
      })
        .bindTooltip(libelleVenteCarte(point))
        .addTo(carte);
    }
    L.circleMarker(centre, { radius: 9, className: 'carte-bien', interactive: false }).addTo(carte);
    const rayonMax = RAYONS_CARTE_METRES[RAYONS_CARTE_METRES.length - 1] ?? 300;
    carte.fitBounds(centre.toBounds((rayonMax + MARGE_CADRAGE_METRES) * 2));
    return () => {
      carte.remove();
    };
  }, [lat, lon, points]);

  return (
    <div
      ref={conteneur}
      role="img"
      aria-label={libelle}
      className="h-[280px] w-full overflow-hidden rounded-encart border border-bordure sm:h-[380px]"
    />
  );
}
