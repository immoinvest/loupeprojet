import { jourLocal } from '@loupe/gestion';
import { Building2, CalendarCheck, Landmark, Receipt, Users, Wallet } from 'lucide-react';
import type { JSX } from 'react';
import { NavLink } from 'react-router';

import { useCompte } from '@/compte/CompteContext';
import { useGestion } from '@/gestion/GestionContext';
import { retardsDuMois } from '@/gestion/menu';
import { CHEMIN_ARGENT, CHEMIN_DECLARATION } from '@/gestion/parcours';
import { loyersEnRetard, TEXTES_MENU } from '@/textes/gerer';

import { LigneAvecAjout } from './LigneAvecAjout';
import { CLASSE_ETIQUETTE, CLASSE_SECTION, classeLien } from './liens';

/**
 * Section « Gérer » : « Mes biens · N » et son « + » (ajouter un bien) sur une ligne, les loyers du
 * mois (avec les loyers en retard), tous les loyers mois par mois et tous les locataires. Sans compte, une seule ligne vers la
 * page qui explique pourquoi il en faut un. Puis l'argent des biens (G5-1).
 */
export function SectionGerer(): JSX.Element {
  const { etat } = useCompte();
  const { donnees } = useGestion();
  const retards = retardsDuMois(donnees, jourLocal(new Date()));

  return (
    <nav aria-label={TEXTES_MENU.gerer} className={CLASSE_SECTION}>
      <div className={CLASSE_ETIQUETTE}>{TEXTES_MENU.gerer}</div>
      {etat === 'connecte' ? (
        <>
          {/* La fiche d'un bien (/gerer/biens/:id) garde la ligne active ; le « + » ajoute un bien. */}
          <LigneAvecAjout
            vers="/gerer/biens"
            end={false}
            icone={Building2}
            libelle={TEXTES_MENU.mesBiens}
            nombre={donnees === null ? null : donnees.biens.length}
            versAjout="/gerer/ajouter"
            libelleAjout={TEXTES_MENU.ajouterBien}
          />
          <NavLink to="/gerer" end className={classeLien}>
            <CalendarCheck size={18} aria-hidden="true" />
            <span className="flex-1">{TEXTES_MENU.loyersDuMois}</span>
            {retards > 0 && (
              <span
                aria-label={loyersEnRetard(retards)}
                className="flex h-5 min-w-[22px] items-center justify-center rounded-full bg-probleme-fond px-1.5 text-xs font-bold text-probleme-texte"
              >
                {retards}
              </span>
            )}
          </NavLink>
          <NavLink to="/gerer/loyers" className={classeLien}>
            <Receipt size={18} aria-hidden="true" />
            {TEXTES_MENU.tousLesLoyers}
          </NavLink>
          <NavLink to="/gerer/locataires" className={classeLien}>
            <Users size={18} aria-hidden="true" />
            {TEXTES_MENU.mesLocataires}
          </NavLink>
          <NavLink to={CHEMIN_ARGENT} className={classeLien}>
            <Wallet size={18} aria-hidden="true" />
            {TEXTES_MENU.argent}
          </NavLink>
          <NavLink to={CHEMIN_DECLARATION} className={classeLien}>
            <Landmark size={18} aria-hidden="true" />
            {TEXTES_MENU.declaration}
          </NavLink>
        </>
      ) : (
        <NavLink to="/gerer" className={classeLien}>
          <Building2 size={18} aria-hidden="true" />
          {TEXTES_MENU.gererSansCompte}
        </NavLink>
      )}
    </nav>
  );
}
