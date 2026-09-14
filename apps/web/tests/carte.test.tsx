import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Carte } from '@/composants/ui';

function classesDe(contenu: string): string[] {
  const section = screen.getByText(contenu).closest('section');
  return (section?.className ?? '').split(/\s+/);
}

describe('Carte', () => {
  it('garde le fond et la bordure par défaut sans surcharge', () => {
    render(<Carte className="flex-row gap-5">simple</Carte>);
    const classes = classesDe('simple');
    expect(classes).toContain('bg-surface');
    expect(classes).toContain('border-bordure');
  });

  // Le bloc Leviers du rapport était blanc sur blanc : bg-surface l'emportait sur bg-accent.
  it('laisse le fond et la bordure de l’appelant remplacer les valeurs par défaut', () => {
    render(<Carte className="border-accent bg-accent text-white">leviers</Carte>);
    const classes = classesDe('leviers');
    expect(classes).not.toContain('bg-surface');
    expect(classes).not.toContain('border-bordure');
    expect(classes).toContain('bg-accent');
    expect(classes).toContain('border-accent');
  });

  it('une épaisseur de bordure ne retire pas la couleur par défaut', () => {
    render(<Carte className="border-2">epaisse</Carte>);
    expect(classesDe('epaisse')).toContain('border-bordure');
  });
});
