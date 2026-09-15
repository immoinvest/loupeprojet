import * as L from 'leaflet';

import {
  eventail,
  grouperPoints,
  RAYONS_CARTE_METRES,
  type PointColore,
  type RayonCarte,
} from '@/enrichissement';
import { libelleCercle, libelleGroupe, libelleVenteCarte } from '@/textes/carte';

/** Épaisseur du tracé invisible qui rend un cercle facile à toucher, en pixels. */
const EPAISSEUR_CIBLE_CERCLE = 16;

/**
 * Les cercles de l'analyse (100, 200, 300 m). Chacun a un tracé visible et un tracé invisible épais, cliquable :
 * un clic filtre le tableau sur ce rayon, un deuxième retire le filtre.
 */
export function dessinerCercles(
  calque: L.LayerGroup,
  centre: L.LatLng,
  rayon: RayonCarte | null,
  onRayon: (rayon: RayonCarte) => void,
): void {
  calque.clearLayers();
  for (const r of RAYONS_CARTE_METRES) {
    const actif = rayon === r;
    L.circle(centre, {
      radius: r,
      className: actif ? 'carte-cercle carte-cercle-actif' : 'carte-cercle',
      interactive: false,
    }).addTo(calque);
    L.circle(centre, {
      radius: r,
      className: 'carte-cercle-cible',
      weight: EPAISSEUR_CIBLE_CERCLE,
      opacity: 0,
      fill: false,
    })
      .bindTooltip(libelleCercle(r, actif), { sticky: true })
      .on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onRayon(r);
      })
      .addTo(calque);
  }
}

export interface DessinPoints {
  /** Où est dessinée chaque vente (décalée quand son groupe est ouvert en éventail). */
  readonly positions: ReadonlyMap<string, L.LatLng>;
  readonly groupeOuvert: string | null;
}

/**
 * Une pastille par vente, colorée selon son niveau ; les ventes au même point forment une pastille chiffrée qui
 * s'ouvre en éventail (un seul groupe ouvert, celui de la vente sélectionnée d'office).
 */
export function dessinerPoints({
  carte,
  calque,
  points,
  selection,
  groupeOuvert,
  onPoint,
  onGroupe,
}: {
  carte: L.Map;
  calque: L.LayerGroup;
  points: readonly PointColore[];
  selection: string | null;
  groupeOuvert: string | null;
  onPoint: (cle: string) => void;
  onGroupe: (cle: string) => void;
}): DessinPoints {
  calque.clearLayers();
  const groupes = grouperPoints(points);
  const ouvert =
    groupes.find((g) => g.points.length > 1 && g.points.some((p) => p.cle === selection))?.cle ??
    groupeOuvert;
  const positions = new Map<string, L.LatLng>();
  let choisi: L.CircleMarker | null = null;
  for (const groupe of groupes) {
    const centre = L.latLng(groupe.lat, groupe.lon);
    const nombre = groupe.points.length;
    if (nombre > 1 && groupe.cle !== ouvert) {
      const chiffre = document.createElement('span');
      chiffre.textContent = String(nombre);
      L.marker(centre, {
        icon: L.divIcon({ className: 'carte-groupe', html: chiffre, iconSize: [30, 30] }),
        title: libelleGroupe(nombre),
        alt: libelleGroupe(nombre),
        riseOnHover: true,
      })
        .on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onGroupe(groupe.cle);
        })
        .addTo(calque);
      continue;
    }
    const origine = carte.project(centre);
    const decalages = nombre > 1 ? eventail(nombre) : [];
    if (nombre > 1) {
      L.circleMarker(centre, { radius: 3, className: 'carte-eventail', interactive: false }).addTo(
        calque,
      );
    }
    groupe.points.forEach((point, i) => {
      const decalage = decalages[i];
      const position =
        decalage === undefined ? centre : carte.unproject(origine.add([decalage.x, decalage.y]));
      const estChoisi = point.cle === selection;
      const pastille = L.circleMarker(position, {
        radius: estChoisi ? 10 : 7,
        className: `carte-vente carte-vente-${point.niveau}${estChoisi ? ' carte-vente-selectionnee' : ''}`,
      })
        .bindTooltip(libelleVenteCarte(point))
        .on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onPoint(point.cle);
        })
        .addTo(calque);
      if (estChoisi) choisi = pastille;
      positions.set(point.cle, position);
    });
  }
  // La vente choisie passe devant les autres.
  (choisi as L.CircleMarker | null)?.bringToFront();
  return { positions, groupeOuvert: ouvert };
}
