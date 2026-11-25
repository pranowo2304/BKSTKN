import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { lockAppZoom } from './lib/lockZoom';
import { AppErrorBoundary } from './components/AppErrorBoundary';

// Lock zoom on mobile devices and touch browsers
lockAppZoom();

// Recover automatically once if a stale Service Worker / HTML references outdated JS chunks after deploy
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    const reloadKey = 'dana_kematian_chunk_reload_at';
    const lastReload = Number(sessionStorage.getItem(reloadKey) || '0');
    if (Date.now() - lastReload > 15000) {
      sessionStorage.setItem(reloadKey, String(Date.now()));
      if (typeof caches !== 'undefined') {
        caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).finally(() => {
          window.location.reload();
        });
      } else {
        window.location.reload();
      }
    }
  });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    (window as any).__deferredPwaPrompt = e;
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js')
        .then((reg) => {
          // Immediately check for updates
          reg.update().catch(() => {});
        })
        .catch((err) => {
          console.warn('PWA ServiceWorker registration notice:', err);
        });
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
