### Behoben (Dienstplaner)

- **Zähler direkt nach dem Start:** Nach „Abfrage starten“ stand oben „7 Personen bekommen Erinnerungen“ und unten „1 Person bekommt noch Erinnerungen“. Der Abgleich beim Öffnen las die Hilfsgruppe, während der Start noch Personen eintrug. Nach einem Start in diesem Fenster läuft kein Abgleich daneben; unten steht dieselbe Zahl wie oben. Beim erneuten Öffnen gleicht der Stand wie bisher ab.
- **Das Fenster „Abfrage“ wählt die richtige Dienstgruppe vor:** Hat eine der Dienstgruppen eine laufende Abfrage, ist die erste davon gewählt – nicht mehr immer die erste der Liste.

### Geändert (Dienstplaner)

- Das Band in „Wann kann ich?“ sagt bei nichts Offenem „· alles eingetragen“ statt „noch 0 von 4 offen“.
- Die Erinnerungs-Mails kommen von ChurchTools' Standard-Absender (`noreply@churchtools.de`), nicht von der Person, die die Abfrage startet: ChurchTools übernimmt den Absender im Schritt „E-Mail senden“ nicht (gemessen). Dokumentation und Testfälle sagen das jetzt ehrlich.

### Intern (Dienstplaner)

- Die Pfade zur Hilfsgruppe (`mitgliederPfad`, `routinenPfad`) stehen nur noch in `einrichtenAbfragen.ts`; `abfrageAutomatikLauf.ts` nimmt sie von dort.
