import { erweiterungStarten } from '@ui/erweiterung/starten';
import { App } from './App';
import './main.scss';

/**
 * Start der Protokolle (Bauplan S1). Sie laufen nur als ChurchTools-Erweiterung.
 * Was jede Erweiterung beim Start tut, steht in `ui/erweiterung/starten.tsx`.
 */
void erweiterungStarten({
  App,
  // Ersatztext für jedes fehlende Recht ohne eigenen Text – trifft also z. B. auch einen Termin, den ChurchTools nicht
  // zeigt. Protokolle, To-Dos, Termine und Gruppentreffen ändern sagen es genauer (`schreiben.ts`, `bearbeiten.ts` …).
  keinRecht:
    'ChurchTools erlaubt dir das nicht. Frag die Leitung deiner Gruppe oder die Verantwortlichen deiner Gemeinde nach dem passenden Recht.',
  demo: import.meta.env.DEV ? () => import('./demo') : undefined,
});
