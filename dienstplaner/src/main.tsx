import { erweiterungStarten } from '@ui/erweiterung/starten';
import { App } from './App';
import './main.scss';

/**
 * Start des Dienstplaners (Bauplan E2). Er läuft vorerst nur als ChurchTools-Erweiterung.
 * Was jede Erweiterung beim Start tut, steht in `ui/erweiterung/starten.tsx`.
 */
void erweiterungStarten({
  App,
  // Ohne Recht sagt die Verbindung das allgemein; hier passt es genauer.
  keinRecht:
    'ChurchTools erlaubt dir das nicht. Dienste planen darf, wer die Dienstgruppe bearbeiten darf oder die Gruppe des Dienstes leitet.',
  demo: import.meta.env.DEV ? () => import('./demo') : undefined,
});
