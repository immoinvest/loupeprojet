import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
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
