import React from 'react';
import ReactDOM from 'react-dom/client';
import { verbindungEinrichten } from '@ui/ct/verbindung';
import { folgeChurchToolsThema } from '@ui/design/thema';
import { untenNachfuehren } from '@ui/fenster/appHeight';
import { App } from './App';
import './main.scss';

/**
 * Start der Anmeldungen (#474). Sie laufen nur als ChurchTools-Erweiterung – die Klasse `ct-extension`
 * legt die App in den Bereich unter der ChurchTools-Leiste (`ui/design/_grundregeln.scss`).
 */
document.documentElement.classList.add('ct-extension');
// Platz für den Home-Strich messen (`--home-strich`): In der ChurchTools-App vom Home-Bildschirm meldet iOS ihn nicht
// (29.10.2026) – sonst läge die Reiterleiste am Handy unter dem Strich.
untenNachfuehren();
// Hell oder dunkel, wie in ChurchTools eingestellt (14.10.2026, `docs/entwicklung/dunkelmodus.md`).
folgeChurchToolsThema();

// Ohne Recht: anlegen, einrichten, Kalender (A3) – deshalb allgemein, mit dem Weg zum Recht.
verbindungEinrichten({
  keinRecht:
    'ChurchTools erlaubt dir das nicht. Frag die Leitung deiner Gruppe oder die Verantwortlichen deiner Gemeinde nach dem passenden Recht.',
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
