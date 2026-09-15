import 'leaflet/dist/leaflet.css';

import * as L from 'leaflet';
import { useEffect, useRef, useState, type JSX } from 'react';

import {
  COUCHE_PARCELLES,
  COUCHES_FOND,
  glisserActif,
  RAYONS_CARTE_METRES,
  ZOOM_MAX_IGN,
  type FondCarte,
  type PointColore,
  type RayonCarte,
} from '@/enrichissement';
import { ficheVente, PHRASES_CARTE } from '@/textes/carte';

import { elementBulle } from './bulle-vente';
import { dessinerCercles, dessinerPoints } from './calques-carte';

export interface ProprietesCarteVentes {
  readonly lat: number;
  readonly lon: number;
  readonly points: readonly PointColore[];
  readonly fond: FondCarte;
  readonly parcelles: boolean;
  readonly pleinEcran: boolean;
  /** Écran tactile : hors plein écran, un doigt fait défiler la page et deux doigts déplacent la carte. */
  readonly auDoigt: boolean;
  /** Compteur : chaque hausse ramène le cadrage sur le bien. */
  readonly recentrage: number;
  readonly selection: string | null;
  /** Compteur : chaque hausse centre la carte sur la vente sélectionnée (« Sur la carte » du tableau). */
  readonly centrage: number;
  readonly rayon: RayonCarte | null;
  readonly onSelection: (cle: string | null) => void;
  readonly onVoirTableau: (cle: string) => void;
  readonly onRayon: (rayon: RayonCarte) => void;
}

/** Marge autour du cercle le plus large quand la carte cadre le quartier, en mètres. */
const MARGE_CADRAGE_METRES = 40;
/** Zoom minimal quand la carte se centre sur une vente : l'immeuble se distingue. */
const ZOOM_CENTRAGE = 18;

/**
 * La carte Leaflet : fond IGN au choix, parcelles, cercles cliquables, le bien au centre, les ventes en pastilles
 * (regroupées au même point) et la bulle de la vente sélectionnée. Chargée à la demande (onglet Estimation).
 * Les gestes qui ne doivent pas atteindre la carte sont arrêtés par `CarteQuartier`.
 */
export default function CarteVentes(props: ProprietesCarteVentes): JSX.Element {
  const { lat, lon, points, fond, parcelles, pleinEcran, auDoigt } = props;
  const { recentrage, selection, centrage, rayon } = props;
  const conteneur = useRef<HTMLDivElement>(null);
  const carteRef = useRef<L.Map | null>(null);
  const couches = useRef<{
    fond: L.TileLayer | null;
    parcelles: L.TileLayer | null;
    cercles: L.LayerGroup | null;
    points: L.LayerGroup | null;
    bulle: L.Popup | null;
  }>({ fond: null, parcelles: null, cercles: null, points: null, bulle: null });
  const positions = useRef<ReadonlyMap<string, L.LatLng>>(new Map());
  const groupeOuvert = useRef<string | null>(null);
  const fermetureProgrammee = useRef(false);
  /** Vente dont la bulle affiche la fiche. */
  const contenuBulle = useRef<PointColore | null>(null);
  const dernierCentrage = useRef(centrage);
  const [redessin, setRedessin] = useState(0);
  // Les rappels les plus récents, lus par les écouteurs Leaflet posés une seule fois.
  const rappels = useRef(props);
  rappels.current = props;

  const cadrer = (carte: L.Map): void => {
    const rayonMax = RAYONS_CARTE_METRES[RAYONS_CARTE_METRES.length - 1] ?? 300;
    carte.fitBounds(L.latLng(lat, lon).toBounds((rayonMax + MARGE_CADRAGE_METRES) * 2));
  };

  useEffect(() => {
    const element = conteneur.current;
    if (element === null) return undefined;
    // Zoom par quarts de niveau : au niveau entier inférieur, le cercle de 300 m n'occupait que 45 % de la carte.
    const carte = L.map(element, {
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      maxZoom: ZOOM_MAX_IGN,
      zoomControl: false,
      dragging: glisserActif(rappels.current.auDoigt, rappels.current.pleinEcran),
    });
    carteRef.current = carte;
    L.control
      .zoom({ zoomInTitle: PHRASES_CARTE.zoomer, zoomOutTitle: PHRASES_CARTE.dezoomer })
      .addTo(carte);
    carte.attributionControl.setPrefix('Leaflet');
    carte.createPane('bien').style.zIndex = '450';
    couches.current.cercles = L.layerGroup().addTo(carte);
    couches.current.points = L.layerGroup().addTo(carte);
    L.circleMarker([lat, lon], {
      radius: 9,
      className: 'carte-bien',
      interactive: false,
      pane: 'bien',
    }).addTo(carte);
    couches.current.bulle = L.popup({ maxWidth: 280, autoPanPadding: [16, 16] });
    carte.on('popupopen', (e) => {
      const fermer = e.popup.getElement()?.querySelector('.leaflet-popup-close-button');
      fermer?.setAttribute('aria-label', PHRASES_CARTE.fermerBulle);
      fermer?.setAttribute('title', PHRASES_CARTE.fermerBulle);
    });
    carte.on('popupclose', () => {
      if (!fermetureProgrammee.current) rappels.current.onSelection(null);
    });
    carte.on('zoomend', () => {
      setRedessin((n) => n + 1);
    });
    carte.on('click', () => {
      if (groupeOuvert.current === null) return;
      groupeOuvert.current = null;
      setRedessin((n) => n + 1);
    });
    cadrer(carte);
    return () => {
      carte.remove();
      carteRef.current = null;
      couches.current = { fond: null, parcelles: null, cercles: null, points: null, bulle: null };
    };
  }, [lat, lon]);

  useEffect(() => {
    const carte = carteRef.current;
    if (carte === null) return;
    couches.current.fond?.remove();
    const { url, attribution } = COUCHES_FOND[fond];
    couches.current.fond = L.tileLayer(url, { maxZoom: ZOOM_MAX_IGN, attribution }).addTo(carte);
  }, [fond, lat, lon]);

  useEffect(() => {
    const carte = carteRef.current;
    if (carte === null) return;
    couches.current.parcelles?.remove();
    couches.current.parcelles = parcelles
      ? L.tileLayer(COUCHE_PARCELLES.url, {
          maxZoom: ZOOM_MAX_IGN,
          attribution: COUCHE_PARCELLES.attribution,
          className: 'carte-parcelles',
          zIndex: 2,
        }).addTo(carte)
      : null;
  }, [parcelles, lat, lon]);

  useEffect(() => {
    const carte = carteRef.current;
    if (carte === null) return;
    carte.invalidateSize();
    if (glisserActif(auDoigt, pleinEcran)) carte.dragging.enable();
    else carte.dragging.disable();
  }, [pleinEcran, auDoigt, lat, lon]);

  useEffect(() => {
    const carte = carteRef.current;
    if (carte !== null && recentrage > 0) cadrer(carte);
  }, [recentrage]);

  useEffect(() => {
    const calque = couches.current.cercles;
    if (calque === null) return;
    dessinerCercles(calque, L.latLng(lat, lon), rayon, (r) => {
      rappels.current.onRayon(r);
    });
  }, [rayon, lat, lon]);

  useEffect(() => {
    const carte = carteRef.current;
    const calque = couches.current.points;
    if (carte === null || calque === null) return;
    const dessin = dessinerPoints({
      carte,
      calque,
      points,
      selection,
      groupeOuvert: groupeOuvert.current,
      onPoint: (cle) => {
        rappels.current.onSelection(cle);
      },
      onGroupe: (cle) => {
        groupeOuvert.current = cle;
        setRedessin((n) => n + 1);
      },
    });
    positions.current = dessin.positions;
    groupeOuvert.current = dessin.groupeOuvert;
  }, [points, selection, redessin, lat, lon]);

  // La bulle suit la sélection : ouverte sur la vente, fermée sans vente ou si la vente est filtrée.
  useEffect(() => {
    const carte = carteRef.current;
    const bulle = couches.current.bulle;
    if (carte === null || bulle === null) return;
    const point = points.find((p) => p.cle === selection);
    const position = point === undefined ? undefined : positions.current.get(point.cle);
    if (point === undefined || position === undefined) {
      fermetureProgrammee.current = true;
      carte.closePopup(bulle);
      fermetureProgrammee.current = false;
      return;
    }
    if (centrage !== dernierCentrage.current) {
      dernierCentrage.current = centrage;
      carte.setView(position, Math.max(carte.getZoom(), ZOOM_CENTRAGE));
    }
    bulle.setLatLng(position);
    // Le contenu n'est reconstruit que pour une autre vente : un zoom ne fait perdre ni le focus ni un clic en cours.
    if (!carte.hasLayer(bulle) || contenuBulle.current !== point) {
      contenuBulle.current = point;
      const voirTableau =
        point.vente === null
          ? null
          : () => {
              rappels.current.onVoirTableau(point.cle);
            };
      // La fiche tient dans la carte, même petite (280 px au téléphone) : au-delà, elle défile.
      const taille = carte.getSize();
      bulle.options.maxWidth = Math.min(280, Math.max(160, taille.x - 72));
      bulle.options.maxHeight = Math.max(120, taille.y - 90);
      bulle.setContent(elementBulle(ficheVente(point), voirTableau));
    }
    if (!carte.hasLayer(bulle)) bulle.openOn(carte);
  }, [points, selection, centrage, redessin, lat, lon]);

  return (
    <div
      ref={conteneur}
      className="carte-quartier h-full w-full overflow-hidden rounded-encart border border-bordure"
    />
  );
}
