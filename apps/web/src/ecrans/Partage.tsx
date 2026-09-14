import { useMemo, type JSX } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { Chapo, Page, TitrePage } from '@/composants/mise-en-page';
import { Bouton, Carte } from '@/composants/ui';
import { FournisseurProjet } from '@/coque/ProjetLayout';
import { dateCourte } from '@/formatage/nombres';
import { useProjets } from '@/stockage/ProjetsContext';
import { decoderPartage, lireFragment } from '@/stockage/partage';
import { RAISONS_PARTAGE, type RaisonPartage } from '@/textes/partage';

import { DocumentProjet } from './document/DocumentProjet';

function LienIllisible({ raison }: { raison: RaisonPartage }): JSX.Element {
  return (
    <Page espacement="moyen">
      <TitrePage>Lien de partage illisible</TitrePage>
      <Chapo>{RAISONS_PARTAGE[raison]}</Chapo>
      <p className="m-0 text-[15px]">
        <Link to="/projets" className="inline-flex min-h-11 items-center">
          Retour à mes projets
        </Link>
      </p>
    </Page>
  );
}

/**
 * `/partage#p=…` : un projet reçu par lien, en lecture seule. Rien n'est enregistré tant que
 * la personne ne clique pas « Ajouter à mes projets ».
 */
export function Partage(): JSX.Element {
  const { hash } = useLocation();
  const { creer } = useProjets();
  const naviguer = useNavigate();
  const decodage = useMemo(() => decoderPartage(lireFragment(hash) ?? ''), [hash]);

  if (!decodage.ok) return <LienIllisible raison={decodage.raison} />;
  const { enregistre } = decodage;

  const ajouter = (): void => {
    const nouveau = creer({ nom: enregistre.nom, source: enregistre.projet });
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
