import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Curseur, bornerAuPas, valeurApresTouche } from '@/composants/Curseur';
import { ModeDocument } from '@/composants/document';

const ans = (v: number): string => `${String(v)} ans`;
const dans = (v: number): string => `Dans ${String(v)} ans`;

/** Le curseur est contrôlé : ce parent tient la valeur, comme un écran le ferait. */
function Harnais({
  depart = 12,
  min = 1,
  max = 30,
  pas = 1,
  onChangement,
  onValidation,
}: {
  depart?: number;
  min?: number;
  max?: number;
  pas?: number;
  onChangement?: (v: number) => void;
  onValidation?: (v: number) => void;
}): JSX.Element {
  const [valeur, setValeur] = useState(depart);
  return (
    <Curseur
      libelle="Revente dans"
      valeur={valeur}
      min={min}
      max={max}
      pas={pas}
      formater={ans}
      texteValeur={dans}
      reperes={[5, 10, 15, 20, 25, 30]}
      seuils={[
        { valeur: 22, libelle: "plus d'impôt sur le revenu" },
        { valeur: 30, libelle: 'plus de prélèvements sociaux' },
      ]}
      onChangement={(v) => {
        setValeur(v);
        onChangement?.(v);
      }}
      {...(onValidation === undefined ? {} : { onValidation })}
    />
  );
}

describe('Curseur', () => {
  it('rend un slider nommé, borné, avec la valeur formatée et aria-valuetext', () => {
    render(<Harnais />);
    const slider = screen.getByRole('slider', { name: 'Revente dans' });
    expect(slider).toHaveAttribute('min', '1');
    expect(slider).toHaveAttribute('max', '30');
    expect(slider).toHaveAttribute('step', '1');
    expect(slider).toHaveValue('12');
    expect(slider).toHaveAttribute('aria-valuetext', 'Dans 12 ans');
    expect(screen.getByText('12 ans')).toBeInTheDocument();
    // Remplissage de la piste jusqu'au pouce : 11 / 29 de l'étendue.
    expect(slider.style.getPropertyValue('--curseur-part')).toBe(`${String((11 / 29) * 100)}%`);
  });

  it('place les repères proportionnellement et signale les seuils avec une légende', () => {
    const { container } = render(<Harnais />);
    const reperes = [...container.querySelectorAll<HTMLElement>('[data-repere]')];
    expect(reperes.map((r) => r.textContent)).toEqual(['5', '10', '15', '20', '25', '30']);
    expect(reperes[0]?.style.left).toBe(`${String((4 / 29) * 100)}%`);
    expect(reperes[5]?.style.left).toBe('100%');
    const seuils = [...container.querySelectorAll<HTMLElement>('[data-seuil]')];
    expect(seuils.map((s) => s.style.left)).toEqual([`${String((21 / 29) * 100)}%`, '100%']);
    expect(
      screen.getByText(
        "22 ans : plus d'impôt sur le revenu · 30 ans : plus de prélèvements sociaux",
      ),
    ).toBeInTheDocument();
  });

  it('sans repères ni seuils, ne rend ni graduation ni légende', () => {
    const { container } = render(
      <Curseur
        libelle="Négociation"
        valeur={-5}
        min={-15}
        max={0}
        pas={0.5}
        formater={(v) => `${String(v)} %`}
        onChangement={() => undefined}
      />,
    );
    expect(container.querySelector('[data-repere]')).toBeNull();
    expect(container.querySelector('[data-seuil]')).toBeNull();
    expect(screen.getByRole('slider', { name: 'Négociation' })).toHaveAttribute(
      'aria-valuetext',
      '-5 %',
    );
  });

  it('signale chaque mouvement, puis la validation au relâchement du pointeur', () => {
    const changement = vi.fn<(v: number) => void>();
    const validation = vi.fn<(v: number) => void>();
    render(<Harnais onChangement={changement} onValidation={validation} />);
    const slider = screen.getByRole('slider');

    fireEvent.input(slider, { target: { value: '15' } });
    expect(changement).toHaveBeenLastCalledWith(15);
    expect(slider).toHaveValue('15');
    expect(validation).not.toHaveBeenCalled();

    // Relâchement : l'événement `change` natif, sans nouvelle valeur.
    fireEvent(slider, new Event('change', { bubbles: true }));
    expect(validation).toHaveBeenCalledExactlyOnceWith(15);
    expect(changement).toHaveBeenCalledTimes(1);
  });

  it('se pilote au clavier : flèches, Page, Début et Fin, validation au relâchement', async () => {
    const changement = vi.fn<(v: number) => void>();
    const validation = vi.fn<(v: number) => void>();
    render(<Harnais onChangement={changement} onValidation={validation} />);
    const utilisateur = userEvent.setup();
    const slider = screen.getByRole('slider');
    slider.focus();

    await utilisateur.keyboard('{ArrowRight}{ArrowUp}');
    expect(changement.mock.calls.map((c) => c[0])).toEqual([13, 14]);
    await utilisateur.keyboard('{ArrowLeft}{ArrowDown}');
    expect(changement.mock.calls.map((c) => c[0])).toEqual([13, 14, 13, 12]);
    await utilisateur.keyboard('{End}{Home}');
    expect(changement.mock.calls.slice(-2).map((c) => c[0])).toEqual([30, 1]);
    // Un dixième de 29 arrondi au pas : 3.
    await utilisateur.keyboard('{PageUp}');
    expect(changement).toHaveBeenLastCalledWith(4);
    await utilisateur.keyboard('{PageDown}');
    expect(changement).toHaveBeenLastCalledWith(1);
    expect(slider).toHaveValue('1');
    // Chaque relâchement de touche valide la valeur affichée ; Tab ne valide rien.
    expect(validation).toHaveBeenCalledTimes(8);
    expect(validation).toHaveBeenLastCalledWith(1);
    await utilisateur.keyboard('{Tab}');
    expect(validation).toHaveBeenCalledTimes(8);
  });

  it('ne dépasse pas les bornes et respecte un pas décimal', async () => {
    const changement = vi.fn<(v: number) => void>();
    render(<Harnais depart={30} onChangement={changement} />);
    const utilisateur = userEvent.setup();
    screen.getByRole('slider').focus();
    await utilisateur.keyboard('{ArrowRight}{PageUp}');
    expect(changement).not.toHaveBeenCalled();

    const negociation = vi.fn<(v: number) => void>();
    render(<Harnais depart={-5} min={-15} max={0} pas={0.5} onChangement={negociation} />);
    const sliders = screen.getAllByRole('slider');
    sliders[1]!.focus();
    await utilisateur.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    expect(negociation.mock.calls.map((c) => c[0])).toEqual([-5.5, -6, -6.5]);
    await utilisateur.keyboard('{PageDown}');
    // Un dixième de 15 = 1,5, déjà un multiple du pas.
    expect(negociation).toHaveBeenLastCalledWith(-8);
  });

  it('en mode document, ne rend que le texte', () => {
    render(
      <ModeDocument>
        <Harnais />
      </ModeDocument>,
    );
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.getByText('Revente dans').closest('p')).toHaveTextContent('Revente dans 12 ans');
  });
});

describe('bornerAuPas et valeurApresTouche', () => {
  it('efface les erreurs d’arrondi et borne', () => {
    expect(bornerAuPas(0.1 + 0.2, 0, 1, 0.1)).toBe(0.3);
    expect(bornerAuPas(31, 1, 30, 1)).toBe(30);
    expect(bornerAuPas(-20, -15, 0, 0.5)).toBe(-15);
  });

  it('ignore les touches qui ne concernent pas le curseur', () => {
    expect(valeurApresTouche('Tab', 12, 1, 30, 1)).toBeNull();
    expect(valeurApresTouche('a', 12, 1, 30, 1)).toBeNull();
    expect(valeurApresTouche('PageUp', 1, 1, 30, 1)).toBe(4);
    expect(valeurApresTouche('PageDown', 0, -15, 0, 0.5)).toBe(-1.5);
  });
});
