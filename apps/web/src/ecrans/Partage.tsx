import { useMemo, type JSX } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { Bouton, Carte } from '@/composants/ui';
import { FournisseurProjet } from '@/coque/ProjetLayout';
import { dateCourte } from '@/formatage/nombres';
import { useProjets } from '@/stockage/ProjetsContext';
import { decoderPartage, lireFragment } from '@/stockage/partage';
import { RAISONS_PARTAGE, type RaisonPartage } from '@/textes/partage';

import { DocumentProjet } from './document/DocumentProjet';

function LienIllisible({ raison }: { raison: RaisonPartage }): JSX.Element {
  return (
    <div className="flex flex-col gap-4 p-10">
      <h1 className="m-0 font-display text-3xl font-bold">Lien de partage illisible</h1>
      <p className="m-0 max-w-[60ch] text-[17px] text-encre-2">{RAISONS_PARTAGE[raison]}</p>
      <p className="m-0 text-[15px]">
        <Link to="/projets">Retour à mes projets</Link>
      </p>
    </div>
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
    <div className="flex flex-col gap-5 px-10 pt-8 pb-10">
      <Carte className="flex-row items-center gap-5 border-accent-bordure bg-accent-fond">
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
    </div>
  );
}
