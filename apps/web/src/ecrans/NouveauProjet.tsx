import { useState, type JSX } from 'react';
import { useNavigate } from 'react-router';

import {
  PORTAILS,
  construireProjet,
  extraireChamps,
  nomDuProjet,
  resoudreAnnonce,
  type AnnonceResolue,
  type SaisieProjet,
} from '@/annonces';
import { Bouton, Carte, Pastille } from '@/composants/ui';
import { useProjets } from '@/stockage/ProjetsContext';

import { FormulaireProjet, valeursDepuisChamps } from './FormulaireProjet';

type Etape = 'lien' | 'texte' | 'verifier';

export function NouveauProjet(): JSX.Element {
  const { creer } = useProjets();
  const naviguer = useNavigate();
  const [url, setUrl] = useState('');
  const [texte, setTexte] = useState('');
  const [etape, setEtape] = useState<Etape>('lien');
  const [manuel, setManuel] = useState(false);
  const [initial, setInitial] = useState(() => valeursDepuisChamps({}));
  const [nbChamps, setNbChamps] = useState(0);

  const annonce: AnnonceResolue | null = resoudreAnnonce(url);

  const lireTexte = (): void => {
    const champs = extraireChamps(texte);
    setInitial(valeursDepuisChamps(champs));
    setNbChamps(Object.keys(champs).length);
    setEtape('verifier');
  };

  const passerEnManuel = (): void => {
    setManuel(true);
    setInitial(valeursDepuisChamps({}));
    setEtape('verifier');
  };

  const creerProjet = (saisie: SaisieProjet): void => {
    const nom = nomDuProjet(saisie);
    const source = construireProjet(saisie, 'a-remplacer');
    const enregistre = creer({ nom, source });
    void naviguer(`/projets/${enregistre.id}`);
  };

  return (
    <div className="flex flex-col gap-6 px-10 pt-8 pb-10">
      <div className="flex flex-col gap-2">
        <h1 className="m-0 max-w-[22ch] font-display text-[40px] leading-[1.1] font-bold tracking-tight text-balance">
          Colle le lien de l'annonce, on s'occupe du reste.
        </h1>
        <p className="m-0 max-w-[64ch] text-[17px] text-encre-2">
          Prix, surface, étage, DPE, charges : tout ce que l'annonce dit est lu pour vous. Vous
          vérifiez cinq chiffres, et le rapport est prêt.
        </p>
      </div>

      {!manuel && (
        <Carte>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-encre-2">Lien de l'annonce</span>
            <input
              name="url"
              type="url"
              value={url}
              placeholder="https://www.leboncoin.fr/ad/ventes_immobilieres/…"
              onChange={(e) => {
                setUrl(e.target.value);
                setEtape(resoudreAnnonce(e.target.value) === null ? 'lien' : 'texte');
              }}
              className="min-h-[52px] rounded-encart border border-bordure bg-surface px-4 text-[16px]"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {annonce !== null ? (
              <>
                <Pastille ton="bon" compacte>
                  {PORTAILS[annonce.portail]} reconnu
                </Pastille>
                <Pastille ton="neutre" compacte>
                  annonce {annonce.id}
                </Pastille>
              </>
            ) : url.trim() !== '' ? (
              <Pastille ton="surveiller" compacte>
                Site non reconnu : collez le texte ci-dessous, ça marche aussi
              </Pastille>
            ) : (
              <span className="text-sm text-encre-3">
                LeBonCoin, SeLoger, Bien'ici, PAP, Logic-Immo.
              </span>
            )}
          </div>
        </Carte>
      )}

      {!manuel && (etape === 'texte' || etape === 'verifier' || url.trim() !== '') && (
        <Carte>
          <div className="flex flex-col gap-1">
            <h2 className="m-0 font-display text-[22px] font-semibold">Le texte de l'annonce</h2>
            <p className="m-0 text-sm text-encre-2">
              L'extension Deklic lira la page à votre place, bientôt. En attendant : sur l'annonce,
              tout sélectionner (Ctrl+A), copier (Ctrl+C), et coller ici. Le texte n'est pas
              conservé, seulement ce qu'on y lit.
            </p>
          </div>
          <textarea
            name="texte"
            value={texte}
            onChange={(e) => {
              setTexte(e.target.value);
            }}
            rows={7}
            placeholder="Appartement T3 de 65 m² au 3e étage… Prix 155 000 €… DPE D…"
            className="rounded-encart border border-bordure bg-surface p-3 text-[15px]"
          />
          <div className="flex items-center gap-3">
            <Bouton variante="primaire" onClick={lireTexte} disabled={texte.trim() === ''}>
              Lire le texte
            </Bouton>
            {etape === 'verifier' && (
              <span className="text-sm text-encre-2">
                {nbChamps === 0
                  ? 'Rien de reconnu : remplissez le formulaire ci-dessous.'
                  : `${String(nbChamps)} champ${nbChamps > 1 ? 's' : ''} lu${nbChamps > 1 ? 's' : ''} dans l'annonce, à vérifier ci-dessous.`}
              </span>
            )}
          </div>
        </Carte>
      )}

      {etape !== 'verifier' && !manuel && (
        <div className="flex items-center gap-3 text-sm text-encre-3">
          <span>Pas de lien ?</span>
          <button type="button" onClick={passerEnManuel} className="font-bold text-accent">
            Je n'ai pas de lien, je saisis à la main
          </button>
        </div>
      )}

      {etape === 'verifier' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline gap-3">
            <h2 className="m-0 font-display text-[28px] font-bold tracking-tight">
              Vérifiez, corrigez, et c'est parti.
            </h2>
            <span className="text-sm text-encre-3">
              <Pastille ton="neutre" compacte>
                annonce
              </Pastille>{' '}
              lu dans l'annonce ·{' '}
              <Pastille ton="accent" compacte>
                à toi
              </Pastille>{' '}
              à confirmer
            </span>
          </div>
          <FormulaireProjet
            key={`${String(manuel)}-${String(nbChamps)}-${texte.length.toString()}`}
            initial={initial}
            annonce={manuel ? null : annonce}
            onCreer={creerProjet}
          />
        </div>
      )}
    </div>
  );
}
