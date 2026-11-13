import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { registerServiceWorker } from './lib/push';
import { captureInstallPrompt } from './screens/InstallScreen';
import '@fontsource-variable/dm-sans';
import './index.css';

registerServiceWorker();
captureInstallPrompt();

// A posição da rolagem é do app (cada tela começa no topo), não do navegador.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
