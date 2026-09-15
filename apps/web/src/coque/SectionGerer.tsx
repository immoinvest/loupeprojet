import { jourLocal } from '@loupe/gestion';
import { Building2, House, Plus, Receipt, Users } from 'lucide-react';
import type { JSX } from 'react';
import { NavLink } from 'react-router';

import { useCompte } from '@/compte/CompteContext';
import { useGestion } from '@/gestion/GestionContext';
import { retardsDuMois } from '@/gestion/menu';
import { loyersEnRetard, mesBiens, TEXTES_MENU } from '@/textes/gerer';

import { CLASSE_ETIQUETTE, classeLien, classeLienCreation } from './liens';

/**
 * Section « Gérer » : ajouter un bien, les loyers du mois (avec les loyers en retard), tous les
 * loyers mois par mois, tous les biens et tous les locataires. Sans compte, une seule ligne vers la
 * page qui explique pourquoi il en faut un. La page Argent y entrera avec sa feature.
 */
export function SectionGerer(): JSX.Element {
  const { etat } = useCompte();
  const { donnees } = useGestion();
  const retards = retardsDuMois(donnees, jourLocal(new Date()));

  return (
    <nav aria-label={TEXTES_MENU.gerer} className="flex flex-col gap-1">
      <div className={CLASSE_ETIQUETTE}>{TEXTES_MENU.gerer}</div>
      {etat === 'connecte' ? (
        <>
          <NavLink to="/gerer/ajouter" className={classeLienCreation}>
            <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
            {TEXTES_MENU.ajouterBien}
          </NavLink>
          <NavLink to="/gerer" end className={classeLien}>
            <House size={18} aria-hidden="true" />
            <span className="flex-1">{TEXTES_MENU.loyersDuMois}</span>
            {retards > 0 && (
              <span
                aria-label={loyersEnRetard(retards)}
                className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-probleme-fond px-1.5 text-xs font-bold text-probleme-texte"
              >
                {retards}
              </span>
            )}
          </NavLink>
          <NavLink to="/gerer/loyers" className={classeLien}>
            <Receipt size={18} aria-hidden="true" />
            {TEXTES_MENU.tousLesLoyers}
          </NavLink>
          {/* La fiche d'un bien (/gerer/biens/:id) garde cette entrée active. */}
          <NavLink to="/gerer/biens" className={classeLien}>
            <Building2 size={18} aria-hidden="true" />
            <span className="flex-1 truncate">
              {mesBiens(donnees === null ? null : donnees.biens.length)}
            </span>
          </NavLink>
          <NavLink to="/gerer/locataires" className={classeLien}>
            <Users size={18} aria-hidden="true" />
            {TEXTES_MENU.mesLocataires}
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
