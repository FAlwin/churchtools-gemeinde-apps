import React from 'react';
import ReactDOM from 'react-dom/client';
import { verbindungEinrichten } from '@ui/ct/verbindung';
import { folgeChurchToolsThema } from '@ui/design/thema';
import { untenNachfuehren } from '@ui/fenster/appHeight';
import { App } from './App';
import './main.scss';

/**
 * Start des Organigramms (Bauplan O1). Es läuft nur als ChurchTools-Erweiterung – die Klasse `ct-extension`
 * legt die App in den Bereich unter der ChurchTools-Leiste (`ui/design/_grundregeln.scss`).
 */
document.documentElement.classList.add('ct-extension');
// Platz für den Home-Strich messen (`--home-strich`): In der ChurchTools-App vom Home-Bildschirm meldet iOS ihn nicht
// (29.10.2026) – sonst läge die Reiterleiste am Handy unter dem Strich.
untenNachfuehren();
// Hell oder dunkel wie ChurchTools – wie Anmeldungen und Dienstplaner.
folgeChurchToolsThema();

// Ohne Recht sagt die Verbindung das allgemein; hier passt es genauer.
verbindungEinrichten({
  keinRecht:
    'ChurchTools erlaubt dir das nicht. Gruppen ändern dürfen die Gruppen-Admins deiner Gemeinde.',
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
