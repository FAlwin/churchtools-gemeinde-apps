import React from 'react';
import ReactDOM from 'react-dom/client';
import { verbindungEinrichten } from '@ui/ct/verbindung';
import { folgeChurchToolsThema } from '@ui/design/thema';
import { App } from './App';
import './main.scss';

/**
 * Start der Sitzungen (Bauplan S1). Sie laufen nur als ChurchTools-Erweiterung – die Klasse `ct-extension` legt
 * die App in den Bereich unter der ChurchTools-Leiste (`ui/design/_grundregeln.scss`).
 */
document.documentElement.classList.add('ct-extension');
// Hell oder dunkel wie ChurchTools (`docs/entwicklung/dunkelmodus.md`).
folgeChurchToolsThema();

// Ohne Recht sagt die Verbindung das allgemein; hier passt es genauer.
verbindungEinrichten({
  keinRecht:
    'ChurchTools erlaubt dir das nicht. Protokolle sehen die Rollen, die ein Admin beim Einrichten der Gruppe freigegeben hat.',
});

async function starten(): Promise<void> {
  // Nur beim Entwickeln: `?demo` spielt ChurchTools nach, damit die Seite ohne Instanz zu sehen ist.
  // In der gebauten Erweiterung fällt dieser Zweig samt `demo.ts` weg (`import.meta.env.DEV`).
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('demo')) {
    const { demoStarten } = await import('./demo');
    demoStarten(new URLSearchParams(location.search).get('demo') ?? '');
  }
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void starten();
