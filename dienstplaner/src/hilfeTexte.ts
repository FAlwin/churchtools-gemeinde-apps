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
    titel: 'Eintragen',
    punkte: [
      'Matrix: freien Platz antippen → „Wer kann?“ → Entwurf.',
      '„Personen“: leere Zelle antippen = Anfrage, nochmal = direkt, nochmal = weg.',
      'Belegten Platz antippen (auch in „Personen“): zurückziehen oder ersetzen.',
      '„Personen“, Zeile „Gäste“: Name eintragen – ohne ChurchTools-Konto, keine Anfrage.',
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
    titel: 'Plätze und Zauberstab',
    punkte: [
      'Regler in der Gruppenzeile: Plätze, Dienste ein/aus, Vorlage – wirkt sofort (Plätze auch über die Zeile „Plätze“ in „Personen“).',
      'Zauberstab: schlägt Personen für freie Plätze vor, als Entwurf.',
      'Stift am Namen: Vorlieben der Person – wirkt sofort.',
    ],
  },
  {
    titel: 'Senden',
    punkte: [
      'Entwürfe gehen erst mit „Ansehen und senden“ an ChurchTools.',
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
