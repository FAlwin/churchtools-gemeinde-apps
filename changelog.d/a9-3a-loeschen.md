### Neu (Anmeldungen, A9-3a)

- **Daten löschen nach Datum** – beide Abläufe in ChurchTools bekommen „warten bis zum Löschdatum“ und „entfernen“
  (Löschdatum = Ende des Termins, sonst Beginn, plus Frist in Monaten; `loeschDatum`). Die Karte „Datenschutz“ zeigt das
  Datum, wie es in ChurchTools steht; ohne Termin „kein Löschdatum“.
- **Rückfrage vor dem sofortigen Löschen** – liegt das neue Datum heute oder früher, entfernt ChurchTools beim Speichern
  alle Anmeldungen (gemessen 28.10.2026). Das Fenster „Daten löschen“ fragt darum mit der Zahl („Jetzt 3 Anmeldungen
  löschen“, ohne „Rückgängig“); der Abgleich beim Öffnen schreibt so ein Datum nie und zeigt stattdessen „schon
  erreicht“ (Alwin, 28.10.2026, E3).
- **Schon Angemeldete werden mit gelöscht** – ihr Ablauf war abgeschlossen; die Erweiterung bringt sie beim Einrichten
  ohne Mail ins Warten (Mail kurz aus, `restart: ['finished']`, Mail wieder an – auch nach einem Fehler; E6).
- Termin oder Frist geändert → der Abgleich zieht das Datum nach. Termin entfernt → Warten und Entfernen fallen weg,
  Wartende werden beendet (`finish`), nicht entfernt.
