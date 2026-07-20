import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

// Registra o Service Worker para modo offline (PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Limpa service workers e caches antigos antes de registrar (evita cache stale)
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((reg) => reg.unregister());
    });
    if (window.caches) {
      caches.keys().then((names) => names.forEach((name) => caches.delete(name)));
    }
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}