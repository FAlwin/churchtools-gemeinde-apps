import { erweiterungStarten } from '@ui/erweiterung/starten';
import { App } from './App';
import './main.scss';

/**
 * Start der Website-Erweiterung (Bauplan Website W3a-1). Sie läuft nur als ChurchTools-Erweiterung.
 * Was jede Erweiterung beim Start tut, steht in `ui/erweiterung/starten.tsx` (#845).
 */
void erweiterungStarten({
  App,
  // Ohne Recht sagt die Verbindung das allgemein; hier passt es genauer.
  keinRecht:
    'ChurchTools erlaubt dir das nicht. Die Website einrichten darf nur ein Admin; bearbeiten dürfen sie Admins und die Leitung der Website-Gruppe.',
  demo: import.meta.env.DEV ? () => import('./demo') : undefined,
});
