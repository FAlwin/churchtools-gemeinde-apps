### Intern (Dienstplaner, E6b-2 L1 – Alwin, 02.11.2026)

- **Kern für „Live“: der Live-Stand von ChurchTools** (`shared/ct/liveAgenda.ts`) – noch nichts Sichtbares, die
  Ansicht kommt mit L2. Der Dienstplaner liest und schreibt **denselben** Stand wie die „Live-Agenda“ von ChurchTools
  (alte Schnittstelle `loadAgendaLivePosition`/`saveAgendaLivePosition`, gemessen 02.11.2026 in der Test-Instanz,
  `dienstplaner-planung/docs/messung-e6b-2-live.md`), kein eigener Speicher.
  - Liste wie ChurchTools: Stelle 0 = nicht gestartet, dann alle Punkte ohne Überschriften **samt weggelassenen**,
    zuletzt Ende – sonst zeigte dieselbe Stelle etwas anderes als die Live-Agenda.
  - „Weiter“/„Zurück“ überspringen Lieder ohne Dauer (wie ChurchTools) und weggelassene Punkte (Alwin); Zusatzzeit
    ±1 Min als Gesamtwert, ohne den Beginn des Punkts zu verschieben (gemessen).
  - Daraus Jetzt, „mit“ (Lieder ohne Dauer), Dann, Restzeit (läuft ins Minus), Abweichung in Worten („2 Min. später“,
    abgeschnitten wie ChurchTools) und Ende; solange niemand gestartet hat, „Jetzt“ nach der Uhr.
  - Steuern darf, wer an dem Termin auf einem gültigen Platz in einem Dienst mit „Live-Agenda steuern“ eingeteilt ist
    – genau die Regel von ChurchTools (`darfLiveSteuern`, `Dienst.liveSteuern`). ChurchTools selbst prüft beim
    Speichern nichts (gemessen, auch ohne Admin).
  - Schreiben liest nach („nicht angekommen“ statt stillem Erfolg); vorübergehende Fehler zerstören keinen Stand.
  - Nach einer Ablauf-Änderung rechnet `stelleNachziehen` die Stelle neu, damit der aktuelle Punkt derselbe bleibt.
- **Ein Anschluss an die alte Schnittstelle für Regeln in `shared/`** (`AltAnfragePort`, im Browser
  `dienstplaner/src/altPort.ts`): Vorlieben und Live-Agenda nutzen ihn; vorher stand der Anschluss der Vorlieben als
  eigene Kopie da. `ablaufBeginn` liefert den Beginn eines Punkts als Zeitpunkt (eine Regel mit `ablaufUhrzeit`);
  `isValid` am Platz steht jetzt in `RohPlatz` statt als Zusatz im Organigramm.
- Demo des Dienstplaners kennt die Live-Agenda (für L2).
