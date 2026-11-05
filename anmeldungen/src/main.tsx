import { erweiterungStarten } from '@ui/erweiterung/starten';
import { App } from './App';
import './main.scss';

/**
 * Start der Anmeldungen (#474). Sie laufen nur als ChurchTools-Erweiterung.
 * Was jede Erweiterung beim Start tut, steht in `ui/erweiterung/starten.tsx`.
 */
void erweiterungStarten({
  App,
  // Ohne Recht: anlegen, einrichten, Kalender (A3) – deshalb allgemein, mit dem Weg zum Recht.
  keinRecht:
    'ChurchTools erlaubt dir das nicht. Frag die Leitung deiner Gruppe oder die Verantwortlichen deiner Gemeinde nach dem passenden Recht.',
  demo: import.meta.env.DEV ? () => import('./demo') : undefined,
});
