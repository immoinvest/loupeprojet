import { VERSION_REGLES_COURANTE, obtenirRegles } from '@loupe/moteur';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ModeDocument } from '@/composants/document';
import { Terme } from '@/composants/Terme';
import { ChampHypothese } from '@/ecrans/hypotheses/ChampHypothese';
import { euros, pourcentage } from '@/formatage/nombres';
import { TOUS_LES_GROUPES, descripteurParChemin } from '@/hypotheses';
import {
  GLOSSAIRE,
  mentionAConfirmer,
  pct,
  texteDuTerme,
  type CodeTerme,
} from '@/textes/glossaire';

const R = obtenirRegles(VERSION_REGLES_COURANTE);

/** Les champs d'Hypothèses dont le libellé n'est pas du langage courant : chacun porte son ⓘ. */
const CHEMINS_TECHNIQUES: readonly string[] = [
  'bien.annee',
  'bien.dpe',
  'bien.venduLoue',
  'bien.copro.lots',
  'hypotheses.achat.honorairesChargeAcquereur',
  'hypotheses.achat.negociationTaux',
  'hypotheses.achat.travauxRenovationEnergetique',
  'hypotheses.achat.mobilier',
  'hypotheses.pret.apport',
  'hypotheses.pret.tauxNominal',
  'hypotheses.pret.tauxAssurance',
  'hypotheses.pret.fraisDossier',
  'hypotheses.pret.fraisGarantie',
  'hypotheses.pret.differeTotalMois',
  'hypotheses.pret.differePartielMois',
  'hypotheses.charges.coproAnnuel',
  'hypotheses.charges.pno',
  'hypotheses.charges.comptable',
  'hypotheses.charges.cfe',
  'hypotheses.charges.entretienTaux',
  'hypotheses.fiscalite.tmi',
  'hypotheses.fiscalite.regime',
  'hypotheses.fiscalite.psBic',
  'hypotheses.fiscalite.psFoncier',
  'hypotheses.revente.evolutionAnnuelle',
  'hypotheses.location.loyerHc',
  'marche.plafondLoyerMensuel',
  'hypotheses.location.loyerChambre',
  'hypotheses.location.forfaitChargesChambre',
  'hypotheses.location.forfaitCharges',
  'hypotheses.location.chargesLocataire',
  'hypotheses.location.vacanceSemaines',
  'hypotheses.location.gestionTaux',
  'hypotheses.location.conciergerieTaux',
  'hypotheses.location.plateformeTaux',
  'hypotheses.location.tourismeClasse',
];

describe('glossaire', () => {
  it('chaque entrée a un terme, une définition sans trou et, si citée, une source https', () => {
    for (const [code, entree] of Object.entries(GLOSSAIRE)) {
      expect(entree.terme, code).not.toBe('');
      expect(entree.definition.length, code).toBeGreaterThan(40);
      expect(entree.definition, code).not.toMatch(/undefined|NaN|\$\{/);
      if (entree.source !== undefined) expect(entree.source.url, code).toMatch(/^https:\/\//);
    }
  });

  it('les chiffres viennent des règles du moteur', () => {
    const { prelevementsSociaux: ps, microBic, microFoncier, deficitFoncier } = R.fiscalite;
    expect(GLOSSAIRE.prelevementsSociaux.definition).toContain(pourcentage(ps.foncier, 1));
    expect(GLOSSAIRE.prelevementsSociaux.definition).toContain(pourcentage(ps.bic, 1));
    expect(GLOSSAIRE.prelevementsSociaux.definition).toContain('(taux à confirmer)');
    expect(GLOSSAIRE.regimeFiscal.definition).toContain(pourcentage(microBic.abattement, 0));
    expect(GLOSSAIRE.regimeFiscal.definition).toContain(pourcentage(microFoncier.abattement, 0));
    expect(GLOSSAIRE.meubleTourismeClasse.definition).toContain(
      euros(microBic.plafondTourismeNonClasse),
    );
    expect(GLOSSAIRE.renovationEnergetique.definition).toContain(
      euros(deficitFoncier.plafondRenovationEnergetique),
    );
    const { G, F, E } = R.exploitation.interdictionLocationDpe;
    for (const annee of [G, F, E]) expect(GLOSSAIRE.dpe.definition).toContain(String(annee));
    expect(GLOSSAIRE.anneeConstruction.definition).toContain(String(R.visite.plombAvantAnnee));
    expect(GLOSSAIRE.venduLoue.definition).toContain(pourcentage(-R.estimation.occupation, 0));
  });

  it('pct et la mention « à confirmer »', () => {
    expect(pct(0.3)).toBe(pourcentage(0.3, 0));
    expect(pct(0.172)).toBe(pourcentage(0.172, 1));
    expect(mentionAConfirmer({ aConfirmer: ['a'] }, 'a')).toBe(' (taux à confirmer)');
    expect(mentionAConfirmer({ aConfirmer: [] }, 'a')).toBe('');
  });

  it('la bulle ajoute la source quand il y en a une', () => {
    expect(texteDuTerme('cfe')).toBe(`${GLOSSAIRE.cfe.definition} Source : impots.gouv.fr.`);
    expect(texteDuTerme('vacance')).toBe(GLOSSAIRE.vacance.definition);
  });

  it('chaque champ technique d’Hypothèses porte un terme connu du glossaire', () => {
    for (const chemin of CHEMINS_TECHNIQUES) {
      expect(descripteurParChemin(chemin).terme, chemin).toBeDefined();
    }
    const codes = new Set(Object.keys(GLOSSAIRE));
    for (const groupe of TOUS_LES_GROUPES) {
      for (const d of groupe.champs) {
        if (d.terme !== undefined) expect(codes.has(d.terme), d.chemin).toBe(true);
        else expect(CHEMINS_TECHNIQUES, d.chemin).not.toContain(d.chemin);
      }
    }
  });
});

describe('Terme et ChampHypothese', () => {
  it('Terme : le mot et son ⓘ ; en document, le mot seul', async () => {
    const u = userEvent.setup();
    const { unmount } = render(
      <p>
        Payez la <Terme code="cfe">CFE</Terme> chaque année.
      </p>,
    );
    await u.click(screen.getByRole('button', { name: 'Explication : CFE' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent(GLOSSAIRE.cfe.definition);
    unmount();
    render(
      <ModeDocument>
        <p>
          Payez la <Terme code={'cfe' satisfies CodeTerme}>CFE</Terme> chaque année.
        </p>
      </ModeDocument>,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(/Payez la CFE chaque année/)).toBeInTheDocument();
  });

  it('ChampHypothese : l’icône ouvre la bulle sans donner le focus à la saisie', async () => {
    const u = userEvent.setup();
    const cfe = descripteurParChemin('hypotheses.charges.cfe');
    render(
      <ChampHypothese descripteur={cfe} texte="120" badge={null} onChange={() => undefined} />,
    );
    const saisie = screen.getByLabelText('CFE');
    expect(saisie).toHaveValue('120');
    await u.click(screen.getByRole('button', { name: 'Explication : CFE' }));
    expect(screen.getByRole('tooltip')).toBeVisible();
    expect(saisie).not.toHaveFocus();
    await u.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('ChampHypothese : pas d’icône sans terme, ni en document', () => {
    const surface = descripteurParChemin('bien.surface');
    const dpe = descripteurParChemin('bien.dpe');
    render(
      <ChampHypothese descripteur={surface} texte="40" badge={null} onChange={() => undefined} />,
    );
    render(
      <ModeDocument>
        <ChampHypothese descripteur={dpe} texte="D" badge={null} onChange={() => undefined} />
      </ModeDocument>,
    );
    expect(screen.queryByRole('button', { name: /Explication/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('DPE')).toHaveValue('D');
  });
});
