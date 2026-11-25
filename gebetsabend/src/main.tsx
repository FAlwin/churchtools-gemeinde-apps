import { erweiterungStarten } from '@ui/erweiterung/starten';
import { App } from './App';
import './main.scss';

/**
 * Start des Gebetsabends (Bauplan Gebetsabend G1). Er läuft nur als ChurchTools-Erweiterung.
 * Was jede Erweiterung beim Start tut, steht in `ui/erweiterung/starten.tsx` (#845).
 */
void erweiterungStarten({
  App,
  // Ersatztext für jedes fehlende Recht ohne eigenen Text – trifft also auch Zuhörer, nicht nur die Technik. Einrichten,
  // Starten/Beenden und die Einstellungen sagen es genauer (`einrichten.ts`, `speicher.ts`).
  keinRecht:
    'ChurchTools erlaubt dir das nicht. Frag die Technik oder die Verantwortlichen deiner Gemeinde nach dem passenden Recht.',
  demo: import.meta.env.DEV ? () => import('./demo') : undefined,
});
