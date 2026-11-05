import { erweiterungStarten } from '@ui/erweiterung/starten';
import { App } from './App';
import './main.scss';

/**
 * Start des Organigramms (Bauplan O1). Es läuft nur als ChurchTools-Erweiterung.
 * Was jede Erweiterung beim Start tut, steht in `ui/erweiterung/starten.tsx`.
 */
void erweiterungStarten({
  App,
  keinRecht:
    'ChurchTools erlaubt dir das nicht. Gruppen ändern dürfen die Gruppen-Admins deiner Gemeinde.',
  demo: import.meta.env.DEV ? () => import('./demo') : undefined,
});
