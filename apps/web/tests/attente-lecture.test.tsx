import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { INTERVALLE_ASTUCE_MS } from '@/annonces/attente';
import { AttenteLecture, RAFRAICHISSEMENT_MS } from '@/ecrans/nouveau-projet/AttenteLecture';
import { ASTUCES_ATTENTE } from '@/textes/attente';

describe('AttenteLecture', () => {
  const horloge = { t: 0 };
  const maintenant = (): number => horloge.t;

  beforeEach(() => {
    vi.useFakeTimers();
    horloge.t = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function avancer(ms: number): void {
    horloge.t += ms;
    act(() => {
      vi.advanceTimersByTime(RAFRAICHISSEMENT_MS);
    });
  }

  it('montre l’étape, la progression, le temps écoulé et une astuce, et avance', () => {
    render(
      <AttenteLecture portail="seloger" debut={0} annuler={vi.fn()} maintenant={maintenant} />,
    );
    expect(screen.getByText("Deklic lit l'annonce SeLoger")).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent("On ouvre l'annonce sur SeLoger");
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText(ASTUCES_ATTENTE[0] ?? '')).toBeInTheDocument();

    avancer(45_000);
    const valeur = Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'));
    expect(valeur).toBeGreaterThan(60);
    expect(valeur).toBeLessThan(90);
    expect(screen.getByRole('status')).toHaveTextContent(/photos et les détails/);
    expect(screen.getByText('45 s')).toBeInTheDocument();

    avancer(60_000);
    expect(screen.getByRole('status')).toHaveTextContent(/plus long que d'habitude/);
    expect(
      Number(screen.getByRole('progressbar').getAttribute('aria-valuenow')),
    ).toBeLessThanOrEqual(95);
  });

  it('change d’astuce toutes les 7 secondes', () => {
    render(<AttenteLecture portail="pap" debut={0} annuler={vi.fn()} maintenant={maintenant} />);
    avancer(INTERVALLE_ASTUCE_MS);
    expect(screen.getByText(ASTUCES_ATTENTE[1] ?? '')).toBeInTheDocument();
  });

  it('« Annuler » appelle annuler ; plus de minuterie après démontage', () => {
    const annuler = vi.fn();
    const { unmount } = render(
      <AttenteLecture portail="leboncoin" debut={0} annuler={annuler} maintenant={maintenant} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(annuler).toHaveBeenCalledTimes(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('sans horloge fournie : part de l’instant présent', () => {
    vi.setSystemTime(new Date('2026-09-14T12:00:10.000Z'));
    render(
      <AttenteLecture
        portail="bienici"
        debut={Date.parse('2026-09-14T12:00:00.000Z')}
        annuler={vi.fn()}
      />,
    );
    expect(screen.getByText('10 s')).toBeInTheDocument();
  });
});
