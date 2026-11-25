import { erweiterungStarten } from '@ui/erweiterung/starten';
import { App } from './App';
import './main.scss';

/**
 * Start der Website-Erweiterung (Bauplan Website W3a-1). Sie läuft nur als ChurchTools-Erweiterung.
 * Was jede Erweiterung beim Start tut, steht in `ui/erweiterung/starten.tsx` (#845).
 */
void erweiterungStarten({
  App,
  // Ersatztext für jedes fehlende Recht ohne eigenen Text – trifft also auch das Lesen. Einrichten, Bearbeiten, Rechte und
  // Mails sagen es genauer (`einrichten.ts`, `shared/website/*`, `rechte.ts`, `mailVersand.ts`).
  keinRecht:
    'ChurchTools erlaubt dir das nicht. Frag die Leitung der Website-Gruppe oder die Verantwortlichen deiner Gemeinde nach dem passenden Recht.',
  demo: import.meta.env.DEV ? () => import('./demo') : undefined,
});
