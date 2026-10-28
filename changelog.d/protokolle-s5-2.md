### Neu (Protokolle, S5-2)

- **Nächste Sitzung festlegen** (Alwin 28.10.2026, Entwurf 7): Im Protokoll steht oben im Bereich „Termine“ die nächste
  Sitzung – mit Einladungen und Zusagen; ist noch keine festgelegt, hat die Leitung dort den Knopf **„Nächste Sitzung
  festlegen“**. Das Fenster ist vorbelegt **wie die letzte Sitzung** (Titel, Uhrzeit, Dauer; Datum im Abstand der
  letzten beiden Sitzungen, sonst vier Wochen, frühestens morgen). Eingeladen sind **alle aktiven Mitglieder**, einzeln
  abwählbar; das Fenster sagt vorher, dass die Einladung **sofort** per Mail rausgeht (wer festlegt und sich einlädt,
  hat gleich zugesagt und bekommt keine). Angelegt werden der **Kalendertermin mit Besprechungsanfrage**, das
  **Gruppentreffen** und die **geplante Sitzung**, die beides verknüpft – „Protokoll beginnen“ macht daraus später den
  Entwurf.
- **Neue Sitzung** (außerordentlich): derselbe Ablauf über den Knopf „Neue Sitzung“ im Reiter „Sitzungen“ – nur für die
  Leitung und nur, wenn die Gruppe einen Kalender hat; vorbelegt wie die letzte Sitzung, die schon stattgefunden hat
  (nicht nach einer schon geplanten). Danach öffnet sich die neue Sitzung.
- **Nie doppelt einladen:** Ist unklar, ob ChurchTools den Termin angelegt hat (keine Antwort, Zeitüberschreitung),
  sieht die Erweiterung im Kalender nach und macht mit dem gefundenen Termin weiter; findet sie keinen, sagt sie „bitte
  im Kalender nachsehen“ statt „noch einmal versuchen“. Scheitern danach Gruppentreffen oder Verknüpfung, bleibt der
  Termin stehen und das Fenster sagt, was fehlt – zurückgerollt wird nie (einen Termin zu löschen schickt allen
  Eingeladenen „Termin gelöscht“, gemessen 28.10.2026).

### Behoben (Protokolle)

- „Protokoll beginnen“ (S5-1): Übernahm ChurchTools das neue Protokoll nicht, stand im Fenster „ChurchTools antwortet
  gerade nicht“ statt der eigentlichen Meldung – jetzt „ChurchTools hat das neue Protokoll nicht übernommen“. Beim Bau
  von S5-2 gefunden.

### Intern

- `@ui/ct/fehler`: neue Klasse `Unklar` – für Fälle, in denen ein zweiter Versuch Schaden anrichtet; `fehlerMeldung`
  zeigt ihre Meldung ohne „Erneut versuchen“.
- Termine bringen ihr Ende mit (`Termin.ende`, `Sitzung.ende`) – für die Dauer der nächsten Sitzung.
