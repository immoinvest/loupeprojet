import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SelecteurStatut } from '@/coque/SelecteurStatut';
import type { StatutProjet } from '@/stockage/projets';

function Temoin({
  initial = 'analyse',
  onChange,
}: {
  initial?: StatutProjet;
  onChange: (s: StatutProjet) => void;
}): JSX.Element {
  const [statut, setStatut] = useState<StatutProjet>(initial);
  return (
    <div>
      <SelecteurStatut
        statut={statut}
        onChange={(s) => {
          onChange(s);
          setStatut(s);
        }}
      />
      <p>Ailleurs</p>
    </div>
  );
}

function monter(initial?: StatutProjet): {
  onChange: ReturnType<typeof vi.fn>;
  bouton: HTMLElement;
} {
  const onChange = vi.fn();
  render(<Temoin onChange={onChange} {...(initial === undefined ? {} : { initial })} />);
  return { onChange, bouton: screen.getByLabelText('Statut du projet') };
}

function optionActive(): string | null {
  const liste = screen.getByRole('listbox');
  const id = liste.getAttribute('aria-activedescendant');
  return id === null ? null : (document.getElementById(id)?.textContent ?? null);
}

describe('SelecteurStatut : liste de choix aux couleurs de Deklic', () => {
  it('fermé : un bouton de liste nommé par le statut, dans sa couleur', () => {
    const { bouton } = monter('offre');
    expect(bouton.tagName).toBe('BUTTON');
    expect(bouton).toHaveAccessibleName('Statut du projet Offre faite');
    expect(bouton).toHaveAttribute('aria-haspopup', 'listbox');
    expect(bouton).toHaveAttribute('aria-expanded', 'false');
    expect(bouton).toHaveClass('bg-flash-fond', 'survol-pastille', 'min-h-[44px]');
    expect(bouton.querySelector('svg')).toHaveClass('print:hidden');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.querySelector('select')).toBeNull();
  });

  it('ouvert : le parcours puis Scénario et Écarté à part, le statut actuel coché', async () => {
    const utilisateur = userEvent.setup();
    const { bouton } = monter('visite');
    await utilisateur.click(bouton);

    const liste = screen.getByRole('listbox', { name: 'Statut du projet' });
    expect(liste).toHaveFocus();
    expect(bouton).toHaveAttribute('aria-expanded', 'true');
    expect(bouton).toHaveAttribute('aria-controls', liste.id);
    const [parcours, aCote] = within(liste).getAllByRole('group');
    expect(parcours).toHaveAccessibleName('Le parcours d’achat');
    expect(aCote).toHaveAccessibleName('À côté');
    expect(
      within(parcours!)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['En analyse', 'Visite prévue', 'Offre faite', 'Acheté']);
    expect(
      within(aCote!)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Scénariopour comparer', 'Écartéon n’y va pas']);
    const cochees = within(liste).getAllByRole('option', { selected: true });
    expect(cochees.map((o) => o.textContent)).toEqual(['Visite prévue']);
    expect(optionActive()).toBe('Visite prévue');
  });

  it('un clic sur une option la choisit, ferme la liste et rend le focus au bouton', async () => {
    const utilisateur = userEvent.setup();
    const { bouton, onChange } = monter();
    await utilisateur.click(bouton);
    await utilisateur.click(screen.getByRole('option', { name: 'Offre faite' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith('offre');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(bouton).toHaveFocus();
    expect(bouton).toHaveAccessibleName('Statut du projet Offre faite');
  });

  it('choisir le statut déjà choisi n’enregistre rien', async () => {
    const utilisateur = userEvent.setup();
    const { bouton, onChange } = monter();
    await utilisateur.click(bouton);
    await utilisateur.click(screen.getByRole('option', { name: 'En analyse' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('clavier : flèche bas ouvre, flèches, Début, Fin, lettre tapée, Entrée choisit', async () => {
    const utilisateur = userEvent.setup();
    const { bouton, onChange } = monter();
    bouton.focus();
    await utilisateur.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toHaveFocus();
    expect(optionActive()).toBe('En analyse');

    await utilisateur.keyboard('{ArrowDown}{ArrowDown}');
    expect(optionActive()).toBe('Offre faite');
    await utilisateur.keyboard('{End}');
    expect(optionActive()).toBe('Écartéon n’y va pas');
    await utilisateur.keyboard('{ArrowDown}');
    expect(optionActive()).toBe('Écartéon n’y va pas');
    await utilisateur.keyboard('{Home}{ArrowUp}');
    expect(optionActive()).toBe('En analyse');
    await utilisateur.keyboard('a');
    expect(optionActive()).toBe('Acheté');
    await utilisateur.keyboard('e');
    expect(optionActive()).toBe('Écartéon n’y va pas');
    // Une lettre avec Ctrl ne cherche pas ; une lettre sans option ne bouge rien.
    await utilisateur.keyboard('{Control>}v{/Control}z');
    expect(optionActive()).toBe('Écartéon n’y va pas');

    await utilisateur.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledExactlyOnceWith('ecarte');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(bouton).toHaveFocus();
  });

  it('clavier : flèche haut ouvre, Espace choisit', async () => {
    const utilisateur = userEvent.setup();
    const { bouton, onChange } = monter('offre');
    bouton.focus();
    await utilisateur.keyboard('{ArrowUp}');
    expect(optionActive()).toBe('Offre faite');
    await utilisateur.keyboard('{ArrowUp}[Space]');
    expect(onChange).toHaveBeenCalledExactlyOnceWith('visite');
  });

  it('Échap et Tab ferment sans choisir et rendent le focus au bouton', async () => {
    const utilisateur = userEvent.setup();
    const { bouton, onChange } = monter();
    await utilisateur.click(bouton);
    await utilisateur.keyboard('{ArrowDown}{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(bouton).toHaveFocus();

    await utilisateur.keyboard('{Enter}');
    expect(screen.getByRole('listbox')).toHaveFocus();
    // Rouvrir repart du statut choisi.
    expect(optionActive()).toBe('En analyse');
    await utilisateur.keyboard('{Tab}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(bouton).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('souris : le survol désigne l’option active ; un clic dehors, sur le voile ou sur le bouton ferme', async () => {
    const utilisateur = userEvent.setup();
    const { bouton, onChange } = monter();
    await utilisateur.click(bouton);
    fireEvent.pointerMove(screen.getByRole('option', { name: 'Acheté' }));
    expect(optionActive()).toBe('Acheté');

    await utilisateur.click(screen.getByText('Ailleurs'));
    expect(screen.queryByRole('listbox')).toBeNull();

    await utilisateur.click(bouton);
    await utilisateur.click(bouton);
    expect(screen.queryByRole('listbox')).toBeNull();

    await utilisateur.click(bouton);
    const voile = screen.getByRole('listbox').previousElementSibling;
    expect(voile).toHaveClass('fixed', 'inset-0', 'sm:hidden');
    await utilisateur.click(voile as HTMLElement);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('feuille du bas sous 640 px, options de 48 px ; au-dessus du bouton si la place manque dessous', async () => {
    const utilisateur = userEvent.setup();
    const { bouton } = monter();
    const hauteur = window.innerHeight;
    vi.spyOn(bouton, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 0, y: hauteur - 50, width: 140, height: 44 }),
    );
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(320);
    await utilisateur.click(bouton);
    const liste = screen.getByRole('listbox');
    expect(liste).toHaveClass('max-sm:fixed', 'max-sm:bottom-0', 'sm:bottom-full');
    expect(screen.getByRole('option', { name: 'Acheté' })).toHaveClass('max-sm:min-h-12');
    vi.restoreAllMocks();
  });
});
