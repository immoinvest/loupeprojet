import { useEffect, useMemo, useState, type JSX } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';

import { Chapo, Page, TitrePage } from '@/composants/mise-en-page';
import { Bouton, Carte } from '@/composants/ui';
import { FournisseurProjet } from '@/coque/ProjetLayout';
import { dateCourte } from '@/formatage/nombres';
import { usePartage } from '@/stockage/PartageContext';
import { useProjets } from '@/stockage/ProjetsContext';
import {
  decoderPartage,
  decoderPartageCompresse,
  lireFragmentPartage,
  type Decodage,
} from '@/stockage/partage';
import type { ProjetEnregistre } from '@/stockage/projets';
import {
  RAISONS_PARTAGE,
  RAISONS_PARTAGE_COURT,
  TEXTES_PARTAGE_PROJET as T,
} from '@/textes/partage';

import { DocumentProjet } from './document/DocumentProjet';

function LienIllisible({ message }: { message: string }): JSX.Element {
  return (
    <Page espacement="moyen">
      <TitrePage>Lien de partage illisible</TitrePage>
      <Chapo>{message}</Chapo>
      <p className="m-0 text-[15px]">
        <Link to="/projets" className="inline-flex min-h-11 items-center">
          Retour à mes projets
        </Link>
      </p>
    </Page>
  );
}

function Chargement(): JSX.Element {
  return (
    <Page espacement="moyen">
      <p role="status" className="m-0 text-[15px] text-encre-2">
        {T.chargement}
      </p>
    </Page>
  );
}

/** Un projet reçu, en lecture seule. Rien n'est enregistré tant que la personne ne clique pas « Ajouter ». */
function VueProjetPartage({ enregistre }: { enregistre: ProjetEnregistre }): JSX.Element {
  const { creer } = useProjets();
  const naviguer = useNavigate();

  const ajouter = (): void => {
    // L'adresse exacte, la visite (anciens liens complets) et l'annonce lue suivent le projet.
    const nouveau = creer({
      nom: enregistre.nom,
      source: enregistre.projet,
      ...(enregistre.adresse === undefined ? {} : { adresse: enregistre.adresse }),
      ...(enregistre.visite === undefined ? {} : { visite: enregistre.visite }),
      ...(enregistre.annonce === undefined ? {} : { annonce: enregistre.annonce }),
    });
    void naviguer(`/projets/${nouveau.id}`);
  };

  return (
    <Page>
      <Carte className="border-accent-bordure bg-accent-fond sm:flex-row sm:items-center sm:gap-5">
        <div className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-bold tracking-wider text-accent uppercase">
            Projet partagé
          </span>
          <span className="font-display text-[22px] font-bold">{enregistre.nom}</span>
          <span className="text-sm text-encre-2">
            Version du {dateCourte(enregistre.modifieLe)}, reçue par lien. Rien n'est enregistré sur
            cet appareil tant que vous ne l'ajoutez pas.
          </span>
        </div>
        <Bouton variante="primaire" onClick={ajouter}>
          Ajouter à mes projets
        </Bouton>
      </Carte>
      <FournisseurProjet enregistre={enregistre}>
        <div className="document-page rounded-carte border border-bordure bg-surface shadow-carte">
          <DocumentProjet libelleDate="Version du" date={enregistre.modifieLe} />
        </div>
      </FournisseurProjet>
    </Page>
  );
}

/** Le décodage d'un fragment : immédiat pour `#p=`, asynchrone (décompression) pour `#z=`. */
function useDecodageFragment(hash: string): Decodage | null {
  const fragment = useMemo(() => lireFragmentPartage(hash), [hash]);
  const immediat = useMemo<Decodage | null>(() => {
    if (fragment === null) return { ok: false, raison: 'vide' };
    return fragment.format === 'complet' ? decoderPartage(fragment.texte) : null;
  }, [fragment]);
  const [compresse, setCompresse] = useState<{ texte: string; decodage: Decodage } | null>(null);

  useEffect(() => {
    if (fragment?.format !== 'compresse') return undefined;
    let actif = true;
    void decoderPartageCompresse(fragment.texte).then((decodage) => {
      if (actif) setCompresse({ texte: fragment.texte, decodage });
    });
    return () => {
      actif = false;
    };
  }, [fragment]);

  if (immediat !== null) return immediat;
  return compresse !== null && compresse.texte === fragment?.texte ? compresse.decodage : null;
}

/** `/partage#p=…` (ancien lien complet) ou `/partage#z=…` (lien compressé de repli). */
export function Partage(): JSX.Element {
  const { hash } = useLocation();
  const decodage = useDecodageFragment(hash);
  if (decodage === null) return <Chargement />;
  if (!decodage.ok) return <LienIllisible message={RAISONS_PARTAGE[decodage.raison]} />;
  return <VueProjetPartage enregistre={decodage.enregistre} />;
}

type LectureCourte =
  | { readonly id: string; readonly etat: 'pret'; readonly enregistre: ProjetEnregistre }
  | { readonly id: string; readonly etat: 'erreur'; readonly message: string };

/** `/p/:id` : un lien court, lu auprès de l'API des comptes. */
export function PartageCourt(): JSX.Element {
  const { id = '' } = useParams();
  const { client } = usePartage();
  const [lecture, setLecture] = useState<LectureCourte | null>(null);

  useEffect(() => {
    let actif = true;
    void client.lire(id).then((resultat) => {
      if (!actif) return;
      setLecture(
        resultat.ok
          ? { id, etat: 'pret', enregistre: resultat.valeur.projet }
          : {
              id,
              etat: 'erreur',
              message:
                resultat.code === 'introuvable' || resultat.code === 'invalide'
                  ? RAISONS_PARTAGE_COURT.introuvable
                  : RAISONS_PARTAGE_COURT.indisponible,
            },
      );
    });
    return () => {
      actif = false;
    };
  }, [client, id]);

  if (lecture?.id !== id) return <Chargement />;
  if (lecture.etat === 'erreur') return <LienIllisible message={lecture.message} />;
  return <VueProjetPartage enregistre={lecture.enregistre} />;
}
