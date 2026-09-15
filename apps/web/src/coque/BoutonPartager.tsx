import { Check, Share2, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type JSX } from 'react';

import { capacitesDuNavigateur, donneesPartage, estAnnulation, modePartage } from '@/application';
import { Bouton } from '@/composants/ui';
import {
  lienReutilisable,
  liensDuProjet,
  memoriserLien,
  oublierLiens,
} from '@/stockage/liens-partage';
import { usePartage } from '@/stockage/PartageContext';
import { lienPartageCompresse, lienPartageCourt } from '@/stockage/partage';
import type { ProjetEnregistre } from '@/stockage/projets';
import { AVERTISSEMENT_PARTAGE, TEXTES_PARTAGE_PROJET as T } from '@/textes/partage';

type Copie = 'en-cours' | 'copie' | 'refusee';
type Arret = 'aucun' | 'en-cours' | 'fait' | 'echec';

interface LienPret {
  readonly url: string;
  readonly forme: 'court' | 'long';
}

/**
 * Partage le lien du projet : le bouton ouvre une boîte qui prépare le lien court (réutilisé tant
 * que le projet n'a pas changé), ou le lien long compressé si l'API ne répond pas, puis le copie ;
 * si le presse-papiers refuse, il reste à sélectionner à la main. Au doigt, « Envoyer » ouvre en plus
 * la feuille de partage du téléphone. « Arrêter le partage » éteint les liens courts du projet.
 */
export function BoutonPartager({ enregistre }: { enregistre: ProjetEnregistre }): JSX.Element {
  const { client, stockage } = usePartage();
  const [ouverte, setOuverte] = useState(false);
  const [lien, setLien] = useState<LienPret | null>(null);
  const [copie, setCopie] = useState<Copie>('en-cours');
  const [envoye, setEnvoye] = useState(false);
  const [arret, setArret] = useState<Arret>('aucun');
  const cadreRef = useRef<HTMLDivElement>(null);
  const champRef = useRef<HTMLInputElement>(null);
  // Chaque ouverture a son numéro : un lien préparé pour une ouverture précédente est ignoré.
  const ouverture = useRef(0);
  const titreId = useId();
  const auDoigt = modePartage(capacitesDuNavigateur(window)) === 'natif';

  const copier = async (url: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url);
      setCopie('copie');
    } catch {
      setCopie('refusee');
    }
  };

  const preparer = async (): Promise<LienPret> => {
    const origine = window.location.origin;
    const existant = lienReutilisable(stockage, enregistre, new Date().toISOString());
    if (existant !== null) return { url: lienPartageCourt(origine, existant.id), forme: 'court' };
    if (navigator.onLine) {
      const cree = await client.creer(enregistre);
      if (cree.ok) {
        memoriserLien(stockage, enregistre.id, { ...cree.valeur, modifieLe: enregistre.modifieLe });
        return { url: lienPartageCourt(origine, cree.valeur.id), forme: 'court' };
      }
    }
    return { url: await lienPartageCompresse(origine, enregistre), forme: 'long' };
  };

  const ouvrir = (): void => {
    ouverture.current += 1;
    const numero = ouverture.current;
    setLien(null);
    setCopie('en-cours');
    setEnvoye(false);
    setArret('aucun');
    setOuverte(true);
    void preparer().then(async (pret) => {
      if (numero !== ouverture.current) return;
      setLien(pret);
      await copier(pret.url);
    });
  };

  // Fermée par le bouton ou Échap, la boîte rend le focus au bouton Partager.
  const fermer = (): void => {
    ouverture.current += 1;
    setOuverte(false);
    cadreRef.current?.querySelector<HTMLButtonElement>('button[aria-haspopup]')?.focus();
  };

  // Le lien est sélectionné dès qu'il est prêt ; Échap ou un clic ailleurs referment la boîte.
  useEffect(() => {
    if (!ouverte) return undefined;
    champRef.current?.focus();
    const touche = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      ouverture.current += 1;
      setOuverte(false);
      cadreRef.current?.querySelector<HTMLButtonElement>('button[aria-haspopup]')?.focus();
    };
    const clic = (e: PointerEvent): void => {
      if (e.target instanceof Node && cadreRef.current?.contains(e.target) === false) {
        ouverture.current += 1;
        setOuverte(false);
      }
    };
    document.addEventListener('keydown', touche);
    document.addEventListener('pointerdown', clic);
    return () => {
      document.removeEventListener('keydown', touche);
      document.removeEventListener('pointerdown', clic);
    };
  }, [ouverte, lien]);

  const envoyer = async (url: string): Promise<void> => {
    try {
      await navigator.share(donneesPartage(enregistre.nom, url));
      setEnvoye(true);
    } catch (erreur) {
      // Feuille fermée sans choisir : rien à dire. Refusée : le lien reste à copier dans la boîte.
      if (!estAnnulation(erreur)) champRef.current?.focus();
    }
  };

  const arreter = async (): Promise<void> => {
    setArret('en-cours');
    const liens = liensDuProjet(stockage, enregistre.id);
    const resultats = await Promise.all(liens.map((l) => client.supprimer(l.id, l.jeton)));
    // Un lien déjà expiré ou arrêté ailleurs est introuvable : il est éteint, on l'oublie aussi.
    const eteints = liens
      .filter((_, i) => {
        const r = resultats[i];
        return r !== undefined && (r.ok || r.code === 'introuvable');
      })
      .map((l) => l.id);
    oublierLiens(stockage, enregistre.id, eteints);
    setArret(eteints.length === liens.length ? 'fait' : 'echec');
  };

  const statut = envoye
    ? T.partage
    : arret === 'fait'
      ? T.arrete
      : arret === 'echec'
        ? T.arretImpossible
        : copie === 'copie'
          ? T.copie
          : copie === 'refusee'
            ? T.copieRefusee
            : '';
  const statutVisible = copie === 'refusee' || envoye || arret === 'fait' || arret === 'echec';

  return (
    <div ref={cadreRef} className="md:relative">
      <Bouton
        variante="primaire"
        title={AVERTISSEMENT_PARTAGE}
        ouvre={ouverte}
        onClick={() => {
          if (ouverte) fermer();
          else ouvrir();
        }}
      >
        <Share2 size={18} className="shrink-0" aria-hidden="true" />
        {T.partager}
      </Bouton>
      {ouverte && (
        <div
          role="dialog"
          aria-labelledby={titreId}
          aria-busy={lien === null}
          className="fixed inset-x-4 bottom-4 z-30 flex flex-col gap-3 rounded-carte border border-bordure bg-surface p-4 shadow-carte md:absolute md:inset-x-auto md:top-full md:right-0 md:bottom-auto md:mt-2 md:w-[400px]"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 id={titreId} className="m-0 font-display text-lg font-semibold">
              {T.titre}
            </h2>
            <button
              type="button"
              aria-label={T.fermer}
              onClick={fermer}
              className="inline-flex size-11 items-center justify-center rounded-full text-encre-3 survol-fond hover:text-encre"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <input
            ref={champRef}
            readOnly
            aria-label={T.lien}
            value={lien?.url ?? T.preparation}
            onFocus={(e) => {
              e.currentTarget.select();
            }}
            className="min-h-[44px] w-full min-w-0 rounded-full border border-bordure bg-fond px-3 text-xs text-encre-2 pointer-coarse:text-base"
          />
          {/* Toujours présent pour être annoncé ; « Lien copié » se lit déjà sur le bouton. */}
          <p
            role="status"
            className={
              statutVisible
                ? `m-0 text-sm font-semibold ${envoye || arret === 'fait' ? 'text-bon-texte' : 'text-probleme-texte'}`
                : 'sr-only'
            }
          >
            {statut}
          </p>
          <div className="flex flex-wrap gap-2">
            <Bouton
              disabled={lien === null}
              onClick={() => {
                if (lien !== null) void copier(lien.url);
              }}
            >
              {copie === 'copie' && <Check size={18} className="shrink-0" aria-hidden="true" />}
              {copie === 'copie' ? T.copie : T.copier}
            </Bouton>
            {auDoigt && lien !== null && (
              <Bouton variante="primaire" onClick={() => void envoyer(lien.url)}>
                <Share2 size={18} className="shrink-0" aria-hidden="true" />
                {T.envoyer}
              </Bouton>
            )}
            {lien?.forme === 'court' && arret !== 'fait' && (
              <Bouton disabled={arret === 'en-cours'} onClick={() => void arreter()}>
                {T.arreter}
              </Bouton>
            )}
          </div>
          <p className="m-0 text-xs text-encre-3">
            {lien?.forme === 'long' ? T.avertissementLong : T.avertissement}
          </p>
        </div>
      )}
    </div>
  );
}
