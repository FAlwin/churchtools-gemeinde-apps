### Intern

- **`useLaden` auch im Gebetsabend** (#845, Scheibe 3b): der nächste Termin und das Fenster „Einstellungen“ laden über
  den gemeinsamen Hook statt über eigene Ladeblöcke. Neu im Hook: `behalten` – beim Neuladen bleiben die alten Daten
  stehen, bis neue da sind, auch wenn das Neuladen scheitert. So springt die Termin-Karte nach dem Speichern der
  Einstellungen nicht um, und ein laufender Player wird nicht neu aufgebaut. Der Dienstplaner braucht dasselbe für
  „leise neu laden“. Der Wächter gegen Ladeblöcke von Hand gilt jetzt auch für den Gebetsabend.
- Neue Tests: der Termin bleibt beim Neuladen und bei einem gescheiterten Neuladen stehen; nach einem Konflikt
  speichert das Einstellungen-Fenster mit der Version des anderen; die Kalender lassen sich nicht holen → Fehler.
