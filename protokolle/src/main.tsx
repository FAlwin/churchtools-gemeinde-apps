import { erweiterungStarten } from '@ui/erweiterung/starten';
import { App } from './App';
import './main.scss';

/**
 * Start der Protokolle (Bauplan S1). Sie laufen nur als ChurchTools-Erweiterung.
 * Was jede Erweiterung beim Start tut, steht in `ui/erweiterung/starten.tsx`.
 */
void erweiterungStarten({
  App,
  keinRecht:
    'ChurchTools erlaubt dir das nicht. Protokolle sehen die Rollen, die ein Admin beim Einrichten der Gruppe freigegeben hat.',
  demo: import.meta.env.DEV ? () => import('./demo') : undefined,
});
