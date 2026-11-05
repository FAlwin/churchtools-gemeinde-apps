import { erweiterungStarten } from '@ui/erweiterung/starten';
import { App } from './App';
import './main.scss';

/**
 * Start des Gebetsabends (Bauplan Gebetsabend G1). Er läuft nur als ChurchTools-Erweiterung.
 * Was jede Erweiterung beim Start tut, steht in `ui/erweiterung/starten.tsx`.
 */
void erweiterungStarten({
  App,
  // Ohne Recht sagt die Verbindung das allgemein; hier passt es genauer.
  keinRecht:
    'ChurchTools erlaubt dir das nicht. Den Gebetsabend einrichten und starten darf die Technik deiner Gemeinde.',
  demo: import.meta.env.DEV ? () => import('./demo') : undefined,
});
