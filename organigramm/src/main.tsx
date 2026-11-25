import { erweiterungStarten } from '@ui/erweiterung/starten';
import { App } from './App';
import './main.scss';

/**
 * Start des Organigramms (Bauplan O1). Es läuft nur als ChurchTools-Erweiterung.
 * Was jede Erweiterung beim Start tut, steht in `ui/erweiterung/starten.tsx`.
 */
void erweiterungStarten({
  App,
  // Ersatztext für jedes fehlende Recht ohne eigenen Text – trifft also auch das Lesen, nicht nur das Ändern. Gruppen
  // ändern, Mitglieder pflegen und Einrichten sagen es genauer (`struktur.ts`, `mitgliedschaft.ts`, `einrichtenSchreiben.ts`).
  keinRecht:
    'ChurchTools erlaubt dir das nicht. Frag die Leitung deines Bereichs oder die Verantwortlichen deiner Gemeinde nach dem passenden Recht.',
  demo: import.meta.env.DEV ? () => import('./demo') : undefined,
});
