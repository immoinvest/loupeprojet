import { euros, pourcentage } from '../lib/formatage';
import { calculerRentabilite, type ChampSimulateur } from '../lib/simulateur';

const CHAMPS: readonly ChampSimulateur[] = ['prix', 'departement', 'travaux', 'loyer', 'charges'];

/** Branche chaque simulateur de la page : recalcul à chaque saisie, erreurs sous les champs. */
for (const formulaire of document.querySelectorAll<HTMLFormElement>('form[data-simulateur]')) {
  const champ = (nom: string): HTMLInputElement | null =>
    formulaire.querySelector<HTMLInputElement>(`[name="${nom}"]`);

  const mettreAJour = (): void => {
    const calcul = calculerRentabilite({
      prix: champ('prix')?.value ?? '',
      departement: champ('departement')?.value ?? '',
      travaux: champ('travaux')?.value ?? '',
      loyer: champ('loyer')?.value ?? '',
      charges: champ('charges')?.value ?? '',
    });
    for (const nom of CHAMPS) {
      const message = calcul.ok ? undefined : calcul.erreurs[nom];
      champ(nom)?.setAttribute('aria-invalid', message === undefined ? 'false' : 'true');
      const erreur = formulaire.querySelector(`[data-erreur="${nom}"]`);
      if (erreur !== null) erreur.textContent = message ?? '';
    }
    const sorties = calcul.ok
      ? {
          frais: euros(calcul.resultat.fraisAcquisition),
          cout: euros(calcul.resultat.coutTotal),
          brut: pourcentage(calcul.resultat.brut),
          net: pourcentage(calcul.resultat.net),
        }
      : { frais: '—', cout: '—', brut: '—', net: '—' };
    for (const [nom, texte] of Object.entries(sorties)) {
      const sortie = formulaire.querySelector(`[data-sortie="${nom}"]`);
      if (sortie !== null) sortie.textContent = texte;
    }
  };

  formulaire.addEventListener('input', mettreAJour);
  formulaire.addEventListener('submit', (evenement) => {
    evenement.preventDefault();
    mettreAJour();
  });
  formulaire.hidden = false;
  mettreAJour();
}
