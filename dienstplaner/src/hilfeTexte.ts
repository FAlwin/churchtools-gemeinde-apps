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
      'Nur Dienstgruppen, die du in ChurchTools ganz sehen darfst.',
      `Deine eigenen Dienste findest du immer unter Start und ${DIENSTE_REITER}.`,
      'Planen darfst du als Bearbeiter oder Leiter der Gruppe oder als Admin des Termins.',
    ],
  },
  {
    titel: 'Werkzeugzeile',
    punkte: [
      'Links die Ansicht, in der Mitte der Zeitraum (dort auch „früheren / späteren Termin dazunehmen“), rechts Filter und „Mehr“ (drei Punkte).',
      'Im Menü „Mehr“: Ablauf bearbeiten, Vorlagen, Erinnern, Teilen und diese Hilfe. „Breite Spalten“ steht im Filter unter „Anzeige“.',
      'Die Lupe neben den Reitern hebt eine Person im ganzen Plan hervor.',
    ],
  },
  {
    titel: 'Eintragen',
    punkte: [
      'Matrix: freien Platz antippen → „Wer kann?“ → Entwurf.',
      '„Wer kann?“ sortiert nach den Antworten aus „Verfügbarkeit“: erst Ja, dann Vielleicht, dann keine Antwort; „Kann nicht / abwesend“ ist eingeklappt.',
      'Kleines Schild „Vertretung gesucht“ an einem freien Platz: Jemand hat abgesagt und im Team nach einer Vertretung gefragt (Hinweis: Wer abgesagt hat, wer gefragt wurde). Der Platz lässt sich ganz normal planen.',
      '„Personen“: leere Zelle antippen = Anfrage, nochmal = direkt, nochmal = weg.',
      'Belegten Platz antippen (auch in „Personen“): zurückziehen oder ersetzen.',
      '„Personen“, Zeile „Gäste“: Name eintragen – ohne ChurchTools-Konto, keine Anfrage.',
    ],
  },
  {
    titel: 'Antworten in „Personen“',
    punkte: [
      'Die Farbe der Zelle ist die Antwort aus „Verfügbarkeit“: grün = Ja, gelb = Vielleicht, rot schraffiert = Nein oder abwesend, weiß = keine Antwort.',
      'Darunter im Spaltenkopf: wie viele Personen Ja oder Vielleicht geantwortet haben. Notiz und „nur für …“ stehen im Tooltip der Zelle.',
    ],
  },
  {
    titel: 'Anfrage oder direkt',
    punkte: [
      'Rahmen gestrichelt = Anfrage, durchgezogen = direkt (ohne Rückfrage zugesagt).',
      'Symbol am Dienst („?“ oder Haken): womit neue Einteilungen beginnen – gilt auf diesem Gerät.',
    ],
  },
  {
    titel: 'Erinnern',
    punkte: [
      '„Erinnern“ schickt jedem, der für Termine im gezeigten Zeitraum noch nicht geantwortet hat, eine eigene Mail mit den offenen Terminen – Absender bist du.',
      'Wer an dem Termin schon eingeteilt ist, ein Ja/Vielleicht eingetragen hat oder in ChurchTools abwesend ist, wird nicht erinnert. Eine Gruppe, deren Antworten du nicht sehen darfst, ist gesperrt.',
      'Das Fenster zeigt vorher, wer die Mail bekommt, mit Vorschau. Verschickt wird wirklich – bei einem Fehler hält es an und schickt nichts doppelt.',
    ],
  },
  {
    titel: 'Plätze und Zauberstab',
    punkte: [
      'Regler in der Gruppenzeile: Plätze, Dienste ein/aus, Vorlage – wirkt sofort (Plätze auch über die Zeile „Plätze“ in „Personen“).',
      'Zauberstab: schlägt Personen für freie Plätze vor, als Entwurf – wer in „Verfügbarkeit“ Ja gesagt hat, kommt zuerst.',
      'Stift am Namen: Vorlieben der Person – wirkt sofort.',
    ],
  },
  {
    titel: 'Senden',
    punkte: [
      'Entwürfe gehen erst mit „Ansehen und senden“ an ChurchTools.',
      '„Alle verwerfen“ löscht alle Entwürfe auf einmal, ohne zu senden.',
      'Teilen und PDF zeigen nur, was schon in ChurchTools steht.',
    ],
  },
  {
    titel: 'Ansicht',
    punkte: [
      'Schraffiert = abwesend, rot umrandet = abwesend und trotzdem eingeteilt.',
      'Filter: auch einzelne Dienste ausblenden.',
      'Fokus („Person hervorheben“): alle Einsätze einer Person gelb umrandet.',
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
    titel: 'Werkzeugzeile',
    punkte: [
      'Links „Meine | Alle“, rechts Filter und „Mehr“ (drei Punkte).',
      'Im Filter lassen sich Kalender und Terminarten ausblenden.',
      'Bei „Meine“ steht im Menü „Mehr“ der Eintrag „Teilen“: alle kommenden eigenen Dienste als PDF.',
      'Ist die Liste leer, führt „Alle Termine zeigen“ direkt zu „Alle“; „Weitere Wochen laden“ steht unter der Liste.',
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
      '„Alle verwerfen“ löscht die Entwürfe dieses Termins, ohne zu senden.',
      'Entwürfe anderer Termine sendest du unter „Planen“.',
    ],
  },
];
