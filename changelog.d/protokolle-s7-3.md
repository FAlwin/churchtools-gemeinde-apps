### Neu (Protokolle, S7-3)

- **Board** im Reiter „To-Dos“ (Alwin 30.10.2026): „Liste | Board“; nach Status (Offen · In Arbeit · Erledigt) oder nach
  Person, „+ Neues To-Do“ je Spalte mit Vorbelegung.
- **Ziehen:** Maus über die ganze Karte, am Handy lange drücken (~0,4 s). Nach Status ändert es den Status, nach Person
  tauscht es nur die gezogene Person. Gibt ein Mitglied sein eigenes To-Do ab, fragt die Seite vorher.
- **Sortieren:** Dringlichkeit · Bis-Datum · Alphabetisch · Manuell (eigene Reihenfolge per Ziehen, auch in der Liste).
- **Verlauf „Zuständig“:** jeder Wechsel der Zuständigen steht jetzt im Verlauf – im Board, im Fenster, im Editor und
  beim Verschieben in eine andere Gruppe.
- **Gemerkt je Benutzer, auf allen Geräten:** Ansicht, Einteilung, Filter, Sortierung und Reihenfolge liegen in einer
  Datei am eigenen ChurchTools-Konto (vorher nur im Gerät).

- Beim Prüfen in der Test-Instanz gefunden und behoben: Ein To-Do mit zwei Zuständigen steht nach Person in zwei
  Spalten; Umordnen in der einen trug die Person der anderen aus (gleiche Zieh-Kennung). Jetzt je Spalte eindeutig.

### Intern

- `shared/ct/personenAblage.ts` verallgemeinert (Präfix/Dateiname als Parameter, `holeDaten`, `mischeEin`) statt einer
  zweiten Ablage; der Browser-Anschluss liegt jetzt in `ui/ct/ablagePort.ts` (Musik-App und Protokolle).
- `useZiehSensorenLangDruecken` und `WahlKnopf` in `ui/bedienung` für alle Apps.
