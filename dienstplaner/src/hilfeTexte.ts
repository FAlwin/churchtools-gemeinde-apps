import type { HilfeAbschnitt } from '@ui/bedienung/HilfeKnopf';
import { ALLE_REITER } from './reiter';

/**
 * Die Texte der Hilfe „?“ (17.11.2026) – vorher lange Absätze unter den Seiten. Je Abschnitt zwei, drei Stichpunkte.
 * Nur Erklärungen zur ganzen Seite stehen hier; kurze Hinweise in Fenstern und an Bedienelementen bleiben dort.
 */

/** Der Name des Reiters mit den eigenen Diensten – aus der Reiterliste, damit die Hilfe eine Umbenennung mitmacht. */
const DIENSTE_REITER = ALLE_REITER.find((r) => r.id === 'termine')?.label ?? 'Dienste';

export const HILFE_PLANEN: readonly HilfeAbschnitt[] = [
  {
    titel: 'Was du siehst',
    punkte: [
      `Welche Dienste du siehst, entscheidet ChurchTools: Hier stehen nur Dienstgruppen, die du ganz sehen darfst. Deine eigenen Dienste findest du immer unter Start und ${DIENSTE_REITER}.`,
      'Planen darfst du, wo du die Dienstgruppe bearbeiten darfst, die Gruppe eines Dienstes leitest oder Admin des Termins bist.',
      '„Personen“ zeigt dieselben Termine als Raster: eine Zeile je Person und Dienst, mit Einteilung, Abwesenheit und dem, was noch offen ist. Einen Dienst antippen klappt seinen Block zu.',
      'Abwesenheiten sind schraffiert, mit dem Grund als Text; wer abwesend und eingeteilt ist, steht rot umrahmt da. In abgesagten Terminen trägst du nichts ein.',
    ],
  },
  {
    titel: 'Eintragen',
    punkte: [
      'Freien Platz antippen zeigt „Wer kann?“ – dort trägst du jemanden als Entwurf ein.',
      'Belegten Platz antippen: zurückziehen oder durch jemand anderen ersetzen, ebenfalls als Entwurf.',
      'In „Personen“ eine leere Zelle antippen trägt die Person dort als Entwurf ein. War sie am Tag schon in einem anderen Dienst oder ist abwesend, fragt ein Fenster vorher nach.',
      'Zweiter Klick auf den eigenen Entwurf: von „?“ (Anfrage) auf „✓“ (direkt); ein dritter nimmt ihn weg. Ist der Dienst auf „direkt“ gestellt, beginnt schon der erste Klick direkt.',
    ],
  },
  {
    titel: 'Anfrage oder direkt',
    punkte: [
      'Das runde Symbol am Dienstnamen zeigt, womit neue Einteilungen beginnen: „?“ = Anfrage, Haken = direkt (ohne Rückfrage als zugesagt).',
      'Antippen öffnet die Einstellung. Sie gilt nur auf diesem Gerät und für neue Entwürfe – auch für den Zauberstab.',
      'Im Plan: Rahmen gestrichelt = Anfrage, durchgezogen = direkt.',
    ],
  },
  {
    titel: 'Plätze und Zauberstab',
    punkte: [
      'Der Regler in der Gruppenzeile ändert die Anzahl der Plätze – sofort. Dort schaltest du auch Dienste ein und aus oder übernimmst eine Vorlage.',
      'Ist ein Dienst voll, geht „Platz dazunehmen“ vorerst nur über den Regler in der Matrix; bestehende Einteilungen ändert man ebenfalls in der Matrix.',
      'Der Zauberstab schlägt für die freien Plätze Personen vor – nach der Rangfolge von ChurchTools, als Entwurf. In „Personen“ steht er an jedem Dienst und gilt nur für diesen.',
      'Der Stift neben einem Namen ändert dessen Vorlieben – sofort in ChurchTools.',
    ],
  },
  {
    titel: 'Senden',
    punkte: [
      'Erst mit „Ansehen und senden“ geht etwas an ChurchTools. Dort steht je Entwurf „Anfrage“ oder „direkt“; die Angefragten bekommen eine Mitteilung von ChurchTools.',
      'Entwürfe zählen schon mit – in „N frei“, „Einsätze“ und „Noch offen“.',
      'Beim Teilen und im PDF gilt nur, was in ChurchTools steht.',
    ],
  },
  {
    titel: 'Filter und Fokus',
    punkte: [
      'Im Filter lässt sich unter jeder Gruppe auch ein einzelner Dienst ausblenden – er fehlt dann in Matrix und „Personen“ und zählt nicht mit.',
      'Fokus auf eine Person: Suchfeld „Person hervorheben“, das Fokus-Symbol am Namen (am Handy lang drücken), „Im Plan hervorheben“ im Fenster eines belegten Platzes oder „im Plan zeigen“ in „Wer kann?“.',
      'Alle Einsätze der Person sind dann in Matrix und „Personen“ gelb umrandet; „Fokus aus“ beendet ihn.',
    ],
  },
];

export const HILFE_DIENSTE: readonly HilfeAbschnitt[] = [
  {
    titel: 'Was du siehst',
    punkte: [
      'Welche Termine du unter „Alle“ siehst, entscheidet ChurchTools (Kalender-Rechte).',
      'Termine, in denen du eingeteilt bist, siehst du immer.',
    ],
  },
  {
    titel: 'Filter und Teilen',
    punkte: [
      'Im Filter lassen sich Kalender und Terminarten ausblenden.',
      'Bei „Meine“ teilt „Teilen“ alle kommenden eigenen Dienste als PDF.',
    ],
  },
];

export const HILFE_TERMIN: readonly HilfeAbschnitt[] = [
  {
    titel: 'Eintragen',
    punkte: [
      'Freien Platz antippen zeigt „Wer kann?“ – dort trägst du jemanden als Entwurf ein.',
      'Belegten Platz antippen: zurückziehen oder ersetzen.',
      'Der Zauberstab in der Gruppenüberschrift plant nur diesen Termin.',
    ],
  },
  {
    titel: 'Senden',
    punkte: [
      'Gesendet wird erst mit „Ansehen und senden“ – nur, was an diesem Termin steht.',
      'Entwürfe anderer Termine sendest du unter „Planen“.',
    ],
  },
];
