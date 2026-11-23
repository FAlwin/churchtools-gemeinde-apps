### Neu (Dienstplaner)

- **Neuer Reiter „Einstellungen“** (ganz rechts, am Handy unten rechts). Darin **„Live-Ansicht – für alle“** mit drei Betriebsarten: **bis Beginn nach der Uhr, ab Beginn klicken** (Standard), **immer nach der Uhr** (wie bisher) und **von Anfang an klicken**. Alle sehen die Wahl, **ändern dürfen nur Planer**; sie gilt für alle Geräte (offene „Live“-Ansichten folgen nach höchstens 30 Sekunden). Ohne gespeicherten Wert oder bei einem Lesefehler gilt der Standard; ein vorübergehender Fehler ändert nichts. In ChurchTools braucht die Ablage „Einstellungen“ des Dienstplaners dafür Rechte (siehe `docs/betrieb/DIENSTPLANER.md`).
- **„Live“ wartet ab Beginn auf „Weiter“** (Standard-Betriebsart): Bis zum Beginn des Termins läuft „Jetzt“ nach der Uhr durch den Vorlauf. Ab Beginn bleibt die Ansicht am letzten Punkt stehen, das Etikett heißt **„Wartet auf „Weiter““**, die Restzeit läuft rot ins Minus. „Weiter“ startet dann den Punkt **nach** dem gezeigten; unten stehen schon vor dem Start ‹ Zurück / Weiter ›. Bei „von Anfang an klicken“ läuft nichts von selbst („Wartet auf „Starten““).
- **Zeitkonto statt „Gesamt“:** Rechts unter dem Kreis steht jetzt das Zeitkonto – **sekundengenau und laufend**, „+0:20“ grün = gespart, „−2:10“ rot = Rückstand. Ein überzogener Punkt verbraucht das Konto sofort, nicht erst beim Klick. Es gilt gegen den **ursprünglichen** Plan; „− 1 / + 1 Min“ ändert nur den Kreis. Nach dem Ende zeigt es den Endstand. Bei „immer nach der Uhr“ ist vor dem Start kein Konto zu sehen.

### Geändert (Dienstplaner)

- **Die alte Anzeige „Gesamt … Min. früher/später“ entfällt** (sie rechnete in ganzen Minuten und zeigte bei einem Termin in der Zukunft Unsinn wie „5689 Min. früher“). Auch „Fertig um …“ nennt die Abweichung nicht mehr in Worten, sondern das Zeitkonto zeigt den Endstand.
- **Standard-Verhalten von „Live“ vor dem Start:** Ohne gespeicherte Einstellung gilt jetzt „bis Beginn nach der Uhr, ab Beginn klicken“ (vorher lief „Jetzt“ immer nach der Uhr durch den ganzen Ablauf – das ist die Betriebsart „Immer nach der Uhr“).
- Die Demo (`?demo`) hat den Termin „Gottesdienst (Live-Probe)“, der immer 2–3 Minuten nach dem Laden beginnt (mit Vorlauf), damit Betriebsarten und Zeitkonto zu sehen sind.

### Intern (Dienstplaner)

- Eine Rechnung für Betriebsart und Zeitkonto in `shared/ct/liveAgenda.ts` (`liveLage` mit `betriebsart`, `konto`, `kontoSek`, `kontoText`); die Einstellung liegt als Dokument mit Version in der Kategorie `dienstplaner-einstellungen` (`shared/dienstplan/liveEinstellungen.ts`, dieselbe Mechanik wie „Was das Organigramm zeigt“).
