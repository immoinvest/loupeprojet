import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { Curseur } from '@/composants/Curseur';
import { ModeDocument } from '@/composants/document';
import { ChampMontant } from '@/composants/saisie/ChampMontant';
import { Compteur } from '@/composants/saisie/Compteur';
import { EchelleEnergie } from '@/composants/saisie/EchelleEnergie';
import { ESPACE_MILLIERS } from '@/composants/saisie/montant';
import { pasAdaptatif } from '@/composants/saisie/pas';
import { Tuiles } from '@/composants/saisie/Tuiles';

/** Garde la valeur d'une commande contrôlée et l'expose au test par `data-valeur`. */
function Banc({
  initial = '',
  enfant,
}: {
  initial?: string;
  enfant: (valeur: string, changer: (v: string) => void) => JSX.Element;
}): JSX.Element {
  const [valeur, setValeur] = useState(initial);
  return (
    <div data-testid="banc" data-valeur={valeur}>
      <span id="libelle">Libellé</span>
      <label htmlFor="champ">Champ</label>
      {enfant(valeur, setValeur)}
    </div>
  );
}

const valeurDuBanc = (): string | null => screen.getByTestId('banc').getAttribute('data-valeur');

describe('Tuiles', () => {
  const OUI_NON = [
    { valeur: 'oui', libelle: 'Oui' },
    { valeur: 'non', libelle: 'Non' },
  ] as const;

  it('choisit au clic ; effaçable, un second clic revient à inconnu', async () => {
    const u = userEvent.setup();
    render(
      <Banc
        enfant={(v, changer) => (
          <Tuiles
            nom="t"
            idLibelle="libelle"
            options={OUI_NON}
            valeur={v as 'oui' | ''}
            onChange={changer}
            effacable
          />
        )}
      />,
    );
    const groupe = screen.getByRole('radiogroup', { name: 'Libellé' });
    await u.click(within(groupe).getByRole('radio', { name: 'Oui' }));
    expect(valeurDuBanc()).toBe('oui');
    expect(within(groupe).getByRole('radio', { name: 'Oui' })).toBeChecked();
    await u.click(within(groupe).getByRole('radio', { name: 'Oui' }));
    expect(valeurDuBanc()).toBe('');
  });

  it('non effaçable : le second clic garde le choix ; tuile désactivée ; nom par libelle', async () => {
    const u = userEvent.setup();
    render(
      <Banc
        initial="oui"
        enfant={(v, changer) => (
          <Tuiles
            nom="t"
            libelle="Réponse"
            options={[OUI_NON[0], { ...OUI_NON[1], desactivee: true }]}
            valeur={v as 'oui'}
            onChange={changer}
          />
        )}
      />,
    );
    const groupe = screen.getByRole('radiogroup', { name: 'Réponse' });
    await u.click(within(groupe).getByRole('radio', { name: 'Oui' }));
    expect(valeurDuBanc()).toBe('oui');
    expect(within(groupe).getByRole('radio', { name: 'Non' })).toBeDisabled();
  });

  it('en document : le libellé retenu, ou un tiret', () => {
    const { rerender } = render(
      <ModeDocument>
        <Tuiles nom="t" libelle="R" options={OUI_NON} valeur="non" onChange={() => undefined} />
      </ModeDocument>,
    );
    expect(screen.getByText('Non')).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    rerender(
      <ModeDocument>
        <Tuiles nom="t" libelle="R" options={OUI_NON} valeur="" onChange={() => undefined} />
      </ModeDocument>,
    );
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('Compteur', () => {
  const compteur = (props: Partial<Parameters<typeof Compteur>[0]> = {}): JSX.Element => (
    <Banc
      enfant={(v, changer) => (
        <Compteur
          id="champ"
          valeur={v}
          onChange={changer}
          min={0}
          max={2}
          nomMoins="Un de moins"
          nomPlus="Un de plus"
          suffixe={(n) => (n === 0 ? 'RDC' : undefined)}
          {...props}
        />
      )}
    />
  );

  it('− / + bornés, suffixe, saisie au clavier filtrée, vidable', async () => {
    const u = userEvent.setup();
    render(compteur());
    const plus = screen.getByRole('button', { name: 'Un de plus' });
    const moins = screen.getByRole('button', { name: 'Un de moins' });
    await u.click(plus);
    expect(screen.getByLabelText('Champ')).toHaveValue('0');
    expect(screen.getByText('RDC')).toBeInTheDocument();
    expect(moins).toBeDisabled();
    await u.click(plus);
    await u.click(plus);
    expect(valeurDuBanc()).toBe('2');
    expect(plus).toBeDisabled();
    await u.clear(screen.getByLabelText('Champ'));
    await u.type(screen.getByLabelText('Champ'), '1a');
    expect(valeurDuBanc()).toBe('1');
    await u.clear(screen.getByLabelText('Champ'));
    expect(valeurDuBanc()).toBe('');
  });

  it('pas adaptatif et document', () => {
    render(compteur({ max: 100, pas: pasAdaptatif(20, 10) }));
    render(
      <ModeDocument>
        <Compteur
          id="a"
          valeur="0"
          onChange={() => undefined}
          min={0}
          max={3}
          nomMoins="m"
          nomPlus="p"
          suffixe={() => 'RDC'}
        />
        <Compteur
          id="b"
          valeur=""
          onChange={() => undefined}
          min={0}
          max={3}
          nomMoins="m"
          nomPlus="p"
        />
        <Compteur
          id="c"
          valeur="3"
          onChange={() => undefined}
          min={0}
          max={3}
          nomMoins="m"
          nomPlus="p"
        />
      </ModeDocument>,
    );
    expect(screen.getByText('RDC')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});

describe('EchelleEnergie', () => {
  it('une lettre au clic, inconnu au second clic, flèches du clavier', async () => {
    const u = userEvent.setup();
    render(
      <Banc
        enfant={(v, changer) => (
          <EchelleEnergie
            nom="dpe"
            variante="dpe"
            idLibelle="libelle"
            valeur={v}
            onChange={changer}
          />
        )}
      />,
    );
    const echelle = screen.getByRole('radiogroup', { name: 'Libellé' });
    expect(within(echelle).getAllByRole('radio')).toHaveLength(7);
    await u.click(within(echelle).getByRole('radio', { name: 'E' }));
    expect(valeurDuBanc()).toBe('E');
    await u.keyboard('{ArrowRight}');
    expect(valeurDuBanc()).toBe('F');
    await u.click(within(echelle).getByRole('radio', { name: 'F' }));
    expect(valeurDuBanc()).toBe('');
  });

  it('en document : la lettre ou un tiret', () => {
    render(
      <ModeDocument>
        <EchelleEnergie
          nom="a"
          variante="ges"
          idLibelle="x"
          valeur="B"
          onChange={() => undefined}
        />
        <EchelleEnergie nom="b" variante="ges" idLibelle="x" valeur="" onChange={() => undefined} />
      </ModeDocument>,
    );
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('ChampMontant', () => {
  it('espace les milliers pendant la frappe et transmet la chaîne brute', async () => {
    const u = userEvent.setup();
    render(
      <Banc
        enfant={(v, changer) => <ChampMontant id="champ" valeur={v} onChange={changer} unite="€" />}
      />,
    );
    const champ = screen.getByLabelText('Champ');
    await u.type(champ, '155000');
    expect(champ).toHaveValue(`155${ESPACE_MILLIERS}000`);
    expect(valeurDuBanc()).toBe('155000');
    expect(screen.getByText('€')).toBeInTheDocument();
  });

  it('garde le curseur au même chiffre quand on corrige au milieu', async () => {
    const u = userEvent.setup();
    render(
      <Banc
        initial="15000"
        enfant={(v, changer) => <ChampMontant id="champ" valeur={v} onChange={changer} />}
      />,
    );
    const champ = screen.getByLabelText<HTMLInputElement>('Champ');
    // « 15 000 » : curseur après le 1, on tape 2 → « 125 000 », curseur après le 2.
    champ.focus();
    champ.setSelectionRange(1, 1);
    await u.keyboard('2');
    expect(champ).toHaveValue(`125${ESPACE_MILLIERS}000`);
    expect(champ.selectionStart).toBe(2);
  });

  it('décimales, collage et document', async () => {
    const u = userEvent.setup();
    render(
      <Banc
        enfant={(v, changer) => (
          <ChampMontant id="champ" valeur={v} onChange={changer} decimales={1} invalide />
        )}
      />,
    );
    await u.click(screen.getByLabelText('Champ'));
    await u.paste('32.57 m²');
    expect(valeurDuBanc()).toBe('32,5');
    expect(screen.getByLabelText('Champ')).toHaveAttribute('aria-invalid', 'true');
    render(
      <ModeDocument>
        <ChampMontant id="a" valeur="980" onChange={() => undefined} unite="€/mois" />
        <ChampMontant id="b" valeur="" onChange={() => undefined} />
        <ChampMontant id="c" valeur="12" onChange={() => undefined} />
      </ModeDocument>,
    );
    expect(screen.getByText('980 €/mois')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});

describe('Curseur sans valeur', () => {
  it('affiche « Je ne sais pas », puis la valeur au premier mouvement', async () => {
    const u = userEvent.setup();
    function Nuits(): JSX.Element {
      const [nuits, setNuits] = useState<number | null>(null);
      return (
        <Curseur
          libelle="Nuits"
          valeur={nuits}
          min={0}
          max={31}
          formater={(n) => `${String(n)} nuits`}
          onChangement={setNuits}
        />
      );
    }
    render(<Nuits />);
    expect(screen.getByText('Je ne sais pas')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Nuits' })).toHaveAttribute(
      'aria-valuetext',
      'Je ne sais pas',
    );
    screen.getByRole('slider').focus();
    await u.keyboard('{ArrowRight}');
    expect(screen.getByText('1 nuits')).toBeInTheDocument();
    render(
      <ModeDocument>
        <Curseur
          libelle="Doc"
          valeur={null}
          texteSansValeur="Inconnu"
          min={0}
          max={3}
          formater={String}
          onChangement={() => undefined}
        />
      </ModeDocument>,
    );
    expect(screen.getByText('Inconnu')).toBeInTheDocument();
  });
});
