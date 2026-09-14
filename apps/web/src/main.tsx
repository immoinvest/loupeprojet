import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { enregistrerServiceWorker } from './hors-ligne';
import './index.css';

const racine = document.getElementById('root');
if (racine === null) {
  throw new Error('Élément #root introuvable');
}

createRoot(racine).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Hors ligne : en production seulement, une fois la page chargée.
enregistrerServiceWorker({
  production: import.meta.env.PROD,
  conteneur: 'serviceWorker' in navigator ? navigator.serviceWorker : undefined,
  quandCharge: (action) => {
    window.addEventListener('load', action, { once: true });
  },
});
