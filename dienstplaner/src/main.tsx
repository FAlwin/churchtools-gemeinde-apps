import { erweiterungStarten } from '@ui/erweiterung/starten';
import { App } from './App';
import './main.scss';

/**
 * Start des Dienstplaners (Bauplan E2). Er läuft vorerst nur als ChurchTools-Erweiterung.
 * Was jede Erweiterung beim Start tut, steht in `ui/erweiterung/starten.tsx`.
 */
void erweiterungStarten({
  App,
  // Ersatztext für jedes fehlende Recht ohne eigenen Text – trifft also auch Mitarbeitende, nicht nur Planer. Das Einteilen
  // (`dienstPort`) und das Öffnen eines Termins (`ladeTermin`) sagen es genauer.
  keinRecht:
    'ChurchTools erlaubt dir das nicht. Frag die Leitung deiner Dienstgruppe oder die Verantwortlichen deiner Gemeinde nach dem passenden Recht.',
  demo: import.meta.env.DEV ? () => import('./demo') : undefined,
});
